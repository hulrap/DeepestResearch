'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useSettings } from '@/lib/settings/use-settings';
import { Loader2, Send, Clock, DollarSign, AlertTriangle, CheckCircle, XCircle, Pause as PauseIcon, Play } from 'lucide-react';
import { WorkflowSession, UsageSummary } from '@/lib/settings/types';

interface ResearchInterfaceProps {
  sessionId: string;
  onClose: () => void;
}

interface Step {
  step: string;
  result: string;
  timestamp: Date;
}

export default function ResearchInterface({ sessionId, onClose }: ResearchInterfaceProps) {
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [workflowState, setWorkflowState] = useState<WorkflowSession | null>(null);
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [stepHistory, setStepHistory] = useState<Step[]>([]);
  let currentStepName = '';

  const {
    profile,
    userConfiguration,
    refreshAll
  } = useSettings();

  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const startPolling = useCallback((id: string) => {
    stopPolling(); 
    pollingRef.current = setInterval(async () => {
      const res = await fetch(`/api/workflows/${id}`);
      if (res.ok) {
        const { session } = await res.json();
        setWorkflowState(session);
        if (session.status === 'completed' || session.status === 'failed' || session.status === 'cancelled') {
          stopPolling();
          setIsLoading(false);
          setIsExecuting(false);
          await refreshAll();
        }
      }
    }, 3000); 
  }, [refreshAll]);

  const loadSession = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/workflows/${id}`);
      if (!res.ok) {
        throw new Error('Failed to load session');
      }
      const { session } = await res.json();
      setWorkflowState(session);
      
      if (session.status === 'running' || session.status === 'pending') {
        startPolling(id);
      } else {
        setIsLoading(false);
      }
      
      if (session.initial_prompt) {
        setPrompt(session.initial_prompt);
      }

    } catch (error) {
      console.error('Failed to load session:', error);
      setIsLoading(false);
    }
  }, [startPolling]);

  const stopPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
    }
  };

  useEffect(() => {
    if (sessionId) {
      loadSession(sessionId);
    }
    return () => {
      stopPolling();
    };
  }, [sessionId, loadSession]);

  const canStartWorkflow = () => {
    if (!userConfiguration || !usage) return true;
    return usage.total_cost_usd < userConfiguration.effective_daily_cost_limit;
  };

  const runResearch = async () => {
    if (!prompt.trim()) return;

    if (!canStartWorkflow()) {
      alert('Daily usage limit reached. Please upgrade your plan or wait until tomorrow.');
      return;
    }

    setIsExecuting(true);
    setResponse('');
    setStepHistory([]);
    startPolling(sessionId);

    try {
      const response = await fetch('/api/deep-research', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          prompt,
          session_id: sessionId,
          user_id: profile?.id
        }),
      });

      if (!response.ok) {
        throw new Error('Research failed to start');
      }

      const reader = response.body?.getReader();
      if (!reader) return;

      let currentResponse = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = new TextDecoder().decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
                stopPolling();
                await loadSession(sessionId); 
                setIsExecuting(false);
                return;
            }
            try {
              const parsed = JSON.parse(data);
              if (parsed.type === 'content') {
                currentResponse += parsed.content;
                setResponse(currentResponse);
              } else if (parsed.type === 'step') {
                const stepInfo = parsed.step;
                if (currentStepName && stepInfo.number > 1) {
                  setStepHistory(prev => [...prev, {
                    step: currentStepName,
                    result: 'Completed',
                    timestamp: new Date()
                  }]);
                }
                currentStepName = stepInfo.name;
              } else if (parsed.type === 'usage') {
                setUsage(parsed.usage);
              }
            } catch {
              // Ignore parsing errors
            }
          }
        }
      }
    } catch (error) {
      console.error('Research error:', error);
      setResponse(`Error: ${error instanceof Error ? error.message : 'Failed to run research.'}`);
      await updateWorkflowStatus('failed', 'Workflow failed due to network error');
    } finally {
      setIsExecuting(false);
      stopPolling();
    }
  };

  const updateWorkflowStatus = async (status: 'paused' | 'cancelled' | 'failed', current_step_name?: string) => {
    if (!workflowState) return;

    stopPolling();
    setIsExecuting(false);
    
    try {
      const res = await fetch(`/api/workflows/${workflowState.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, current_step_name }),
      });

      if (!res.ok) {
        throw new Error(`Failed to update workflow to ${status}`);
      }
      
      const { session } = await res.json();
      setWorkflowState(session);
      await refreshAll();
    } catch (error) {
      console.error('Failed to update workflow status:', error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'failed':
      case 'cancelled': return <XCircle className="h-5 w-5 text-red-500" />;
      case 'running': return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
      case 'paused': return <PauseIcon className="h-5 w-5 text-yellow-500" />;
      default: return <Clock className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-700 bg-green-100 dark:text-green-300 dark:bg-green-900/50 border-green-200 dark:border-green-800';
      case 'failed':
      case 'cancelled':
        return 'text-red-700 bg-red-100 dark:text-red-300 dark:bg-red-900/50 border-red-200 dark:border-red-800';
      case 'running':
        return 'text-blue-700 bg-blue-100 dark:text-blue-300 dark:bg-blue-900/50 border-blue-200 dark:border-blue-800';
      case 'paused':
        return 'text-yellow-700 bg-yellow-100 dark:text-yellow-300 dark:bg-yellow-900/50 border-yellow-200 dark:border-yellow-800';
      default:
        return 'text-gray-700 bg-gray-100 dark:text-gray-300 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600';
    }
  };

  if (isLoading && !workflowState) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="text-center text-white">
          <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4" />
          <p>Loading Research Session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-6xl max-h-[95vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <h2 className="text-xl font-semibold">{workflowState?.title || "AI Research Session"}</h2>
              {workflowState && (
                <div className="flex items-center space-x-2">
                  {getStatusIcon(workflowState.status)}
                  <Badge className={getStatusColor(workflowState.status)}>{workflowState.status}</Badge>
                </div>
              )}
            </div>
            <div className="flex items-center space-x-2">
              {workflowState?.status === 'running' && (
                <>
                  <Button variant="outline" size="sm" onClick={() => updateWorkflowStatus('paused', 'User paused workflow')}>
                    <PauseIcon className="h-4 w-4 mr-2" /> Pause
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => updateWorkflowStatus('cancelled', 'User cancelled workflow')}>
                    Cancel
                  </Button>
                </>
              )}
               {workflowState?.status === 'paused' && (
                  <Button variant="outline" size="sm" onClick={runResearch}>
                    <Play className="h-4 w-4 mr-2" /> Resume
                  </Button>
               )}
              <Button variant="outline" onClick={onClose}>Close</Button>
            </div>
          </div>

          {workflowState && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span>Progress: Step {workflowState.current_step} of {workflowState.total_steps || 'N/A'}</span>
                <span>{workflowState.progress_percentage}% complete</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                  style={{ width: `${workflowState.progress_percentage}%` }}
                ></div>
              </div>
              <p className="text-sm text-gray-600">{workflowState.current_step_name || 'Idle'}</p>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-hidden flex">
          <div className="flex-1 p-6 overflow-y-auto">
            <div className="space-y-4">
              {!response && workflowState?.status !== 'running' && (
                <div>
                  <label className="block text-sm font-medium mb-2">Research Topic</label>
                  <Textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="What would you like to research? Be specific about your requirements..."
                    rows={3}
                    className="w-full"
                    disabled={workflowState?.status === 'completed' || workflowState?.status === 'failed' || workflowState?.status === 'cancelled'}
                  />
                  
                  {userConfiguration && (
                    <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <div className="flex items-center space-x-2 text-sm">
                        <DollarSign className="h-4 w-4 text-blue-600" />
                        <span>Daily limit: ${userConfiguration.effective_daily_cost_limit}</span>
                        <span>•</span>
                        <span>Used: ${usage?.total_cost_usd.toFixed(4) || '0.0000'}</span>
                      </div>
                    </div>
                  )}
                  
                  <Button 
                    onClick={runResearch} 
                    disabled={isExecuting || !prompt.trim() || !canStartWorkflow()}
                    className="mt-2"
                  >
                    {isExecuting ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Send className="h-4 w-4 mr-2" />
                    )}
                    {workflowState?.status === 'paused' ? 'Resume' : 'Start Research'}
                  </Button>
                </div>
              )}

              {response && (
                <div>
                  <label className="block text-sm font-medium mb-2">Research Results</label>
                  <div className="border rounded-lg p-4 min-h-[300px] max-h-[400px] overflow-y-auto bg-gray-50 dark:bg-gray-900">
                     <div className="whitespace-pre-wrap text-sm">
                        {response}
                        {isExecuting && <span className="animate-pulse">▊</span>}
                      </div>
                  </div>
                </div>
              )}
              
               {(isExecuting && !response) && (
                 <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                      <p className="text-sm text-gray-600">Running multi-agent research...</p>
                    </div>
                  </div>
               )}
            </div>
          </div>
          
          {(workflowState || usage) && (
            <div className="w-80 border-l p-6 overflow-y-auto bg-gray-50 dark:bg-gray-900">
              {usage && (
                <div className="mb-6">
                  <h3 className="font-medium mb-3">Usage Statistics</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="text-center p-3 bg-white dark:bg-gray-800 rounded-lg">
                      <div className="text-lg font-semibold">${usage.total_cost_usd.toFixed(4)}</div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">Total Cost</div>
                    </div>
                    <div className="text-center p-3 bg-white dark:bg-gray-800 rounded-lg">
                      <div className="text-lg font-semibold">{(usage.total_input_tokens + usage.total_output_tokens).toLocaleString()}</div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">Total Tokens</div>
                    </div>
                    <div className="text-center p-3 bg-white dark:bg-gray-800 rounded-lg">
                      <div className="text-lg font-semibold">{usage.total_requests}</div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">API Requests</div>
                    </div>
                    <div className="text-center p-3 bg-white dark:bg-gray-800 rounded-lg">
                      <div className="text-lg font-semibold">{usage.avg_latency_ms}ms</div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">Avg Latency</div>
                    </div>
                  </div>
                </div>
              )}

              {stepHistory.length > 0 && (
                <div>
                  <h3 className="font-medium mb-3">Step History</h3>
                  <div className="space-y-2">
                    {stepHistory.map((step, index) => (
                      <div key={index} className="p-2 bg-white dark:bg-gray-800 rounded text-sm">
                        <div className="font-medium">{step.step}</div>
                        <div className="text-green-600 text-xs">{step.result}</div>
                        <div className="text-gray-500 text-xs">{step.timestamp.toLocaleTimeString()}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {workflowState?.error_state && (
                <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 rounded-lg">
                  <div className="flex items-center mb-2">
                    <AlertTriangle className="h-4 w-4 text-red-500 mr-2" />
                    <span className="font-medium text-red-800 dark:text-red-200">Workflow Error</span>
                  </div>
                  <p className="text-sm text-red-700 dark:text-red-300">
                    {(workflowState.error_state as { message?: string })?.message || 'An unknown error occurred'}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
} 