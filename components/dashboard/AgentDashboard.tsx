'use client';

import React, { useState } from 'react';
import { useSettings } from '@/lib/settings/use-settings';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Bot, 
  Zap, 
  DollarSign, 
  Clock, 
  Star,
  Play,
  Pause,
  Settings,
  FileText as Template,
  Workflow,
  Plus,
  BarChart3,
  Loader2,
  X
} from 'lucide-react';
import ResearchInterface from '@/components/ResearchInterface';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { WorkflowTemplate, WorkflowSession } from '@/lib/settings/types';

export default function AgentDashboard() {
  const [activeTab, setActiveTab] = useState<'overview' | 'workflows' | 'templates' | 'settings'>('overview');
  const [showResearchInterface, setShowResearchInterface] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  
  const [showModelModal, setShowModelModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<WorkflowTemplate | null>(null);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [isStartingWorkflow, setIsStartingWorkflow] = useState(false);

  const {
    profile,
    userConfiguration,
    featuredTemplates,
    activeWorkflows,
    availableModels,
    isLoading: isSettingsLoading,
    refreshAll,
  } = useSettings();

  const handleStartWorkflowClick = (template: WorkflowTemplate) => {
    setSelectedTemplate(template);
    if (availableModels.length > 0) {
      setSelectedModelId(availableModels[0].id);
    }
    setShowModelModal(true);
  };

  const startWorkflow = async () => {
    if (!selectedTemplate || !selectedModelId) {
      alert('Please select a template and a model.');
      return;
    }

    setIsStartingWorkflow(true);
    try {
      const response = await fetch('/api/workflows', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          template_id: selectedTemplate.id,
          model_id: selectedModelId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create workflow session.');
      }

      const { session } = await response.json();
      
      setCurrentSessionId(session.id);
      setShowResearchInterface(true);
      setShowModelModal(false);
      await refreshAll();

    } catch (error) {
      console.error('Failed to start workflow:', error);
      alert(`Failed to start workflow: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsStartingWorkflow(false);
      setSelectedTemplate(null);
      setSelectedModelId(null);
    }
  };

  const openWorkflowSession = (sessionId: string) => {
    setCurrentSessionId(sessionId);
    setShowResearchInterface(true);
  };

  const pauseWorkflow = async (workflowId: string) => {
    try {
      console.log(`Pausing workflow ${workflowId}`);
      alert(`Pausing workflow: ${workflowId}\n\nThis will be implemented with a real API call.`);
      await refreshAll();
    } catch (error) {
      console.error('Failed to pause workflow:', error);
      alert(`Failed to pause workflow: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  if (isSettingsLoading && !profile) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <Loader2 className="h-12 w-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-lg font-medium text-gray-700 dark:text-gray-300">Loading Your Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {showResearchInterface && currentSessionId && (
        <ResearchInterface
          sessionId={currentSessionId}
          onClose={() => {
            setShowResearchInterface(false);
            setCurrentSessionId(null);
            refreshAll(); 
          }}
        />
      )}

      {showModelModal && selectedTemplate && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md p-6 bg-white dark:bg-gray-800">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Start Workflow</h3>
              <Button variant="ghost" size="icon" onClick={() => setShowModelModal(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-4">
              <p>You are about to start the &quot;<strong>{selectedTemplate.name}</strong>&quot; workflow.</p>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Select Primary AI Model</label>
                <Select value={selectedModelId || ''} onValueChange={setSelectedModelId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a model..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableModels.length > 0 ? (
                      availableModels.map((model) => (
                        <SelectItem key={model.id} value={model.id}>
                          {model.display_name} ({model.provider_name})
                        </SelectItem>
                      ))
                    ) : (
                      <div className="p-4 text-sm text-gray-500">No configured models found. Please add an API key in settings.</div>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <Button 
                className="w-full"
                onClick={startWorkflow} 
                disabled={isStartingWorkflow || !selectedModelId}
              >
                {isStartingWorkflow ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                Confirm and Start
              </Button>
            </div>
          </Card>
        </div>
      )}

      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        {/* Header */}
        <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-b sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <Bot className="h-8 w-8 text-blue-600" />
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">AI Agent Platform</h1>
                </div>
                {userConfiguration?.subscription_plan && (
                  <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">
                    <Zap className="h-3 w-3 mr-1" />
                    {userConfiguration.subscription_plan}
                  </Badge>
                )}
              </div>
              
              <div className="flex items-center space-x-4">
                {userConfiguration && (
                  <div className="flex items-center space-x-2 text-sm">
                    <DollarSign className="h-4 w-4 text-green-600" />
                    <span className="text-gray-600 dark:text-gray-300">
                      ${userConfiguration.current_daily_cost.toFixed(3)} / ${userConfiguration.effective_daily_cost_limit.toFixed(2)}
                    </span>
                    <div className="w-16 h-2 bg-gray-200 rounded-full">
                      <div 
                        className="h-2 bg-green-500 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(100, (userConfiguration.current_daily_cost / userConfiguration.effective_daily_cost_limit) * 100)}%` }}
                      />
                    </div>
                  </div>
                )}
                
                <Button variant="outline" size="sm" onClick={() => setActiveTab('settings')}>
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex space-x-1 bg-white/50 dark:bg-gray-800/50 p-1 rounded-lg mb-8">
            {[
              { id: 'overview', label: 'Overview', icon: BarChart3 },
              { id: 'workflows', label: 'Active Workflows', icon: Workflow },
              { id: 'templates', label: 'Templates', icon: Template },
              { id: 'settings', label: 'Settings', icon: Settings }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as 'overview' | 'workflows' | 'templates' | 'settings')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-white text-blue-600 shadow-sm dark:bg-gray-700 dark:text-blue-400'
                    : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {activeTab === 'overview' && (
            <div className="space-y-8">
              {/* Quick Stats */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card className="p-6 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Active Workflows</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">{activeWorkflows.length}</p>
                    </div>
                    <Workflow className="h-8 w-8 text-blue-600" />
                  </div>
                </Card>
                
                <Card className="p-6 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Daily Cost</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        ${userConfiguration?.current_daily_cost.toFixed(3) || '0.000'}
                      </p>
                    </div>
                    <DollarSign className="h-8 w-8 text-green-600" />
                  </div>
                </Card>

                <Card className="p-6 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Monthly Cost</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        ${userConfiguration?.current_monthly_cost.toFixed(3) || '0.000'}
                      </p>
                    </div>
                    <BarChart3 className="h-8 w-8 text-purple-600" />
                  </div>
                </Card>

                <Card className="p-6 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Plan</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">{userConfiguration?.subscription_plan || 'Free'}</p>
                    </div>
                    <Zap className="h-8 w-8 text-indigo-600" />
                  </div>
                </Card>
              </div>

              {/* Active Workflows */}
              <Card className="p-6 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Active Workflows</h2>
                  <Button size="sm" onClick={() => setActiveTab('workflows')}>
                    View All
                  </Button>
                </div>
                
                {activeWorkflows.length === 0 ? (
                  <div className="text-center py-8">
                    <Workflow className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 dark:text-gray-400">No active workflows</p>
                    <Button className="mt-4" onClick={() => setActiveTab('templates')}>
                      <Plus className="h-4 w-4 mr-2" />
                      Start New Workflow
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {activeWorkflows.map((workflow: WorkflowSession) => (
                      <div key={workflow.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <div className="flex-1 cursor-pointer" onClick={() => openWorkflowSession(workflow.id)}>
                          <div className="flex items-center space-x-3">
                            <h3 className="font-medium text-gray-900 dark:text-white">{workflow.title || 'Untitled Workflow'}</h3>
                            <Badge variant={workflow.status === 'running' ? 'default' : 'secondary'}>
                              {workflow.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{workflow.current_step_name || 'Idle'}</p>
                          
                          <div className="mt-2">
                            <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
                              <span>Progress: {workflow.progress_percentage}%</span>
                              <span>${workflow.actual_total_cost.toFixed(3)} / ${(workflow.estimated_total_cost || 0).toFixed(3)}</span>
                            </div>
                            <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                              <div 
                                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${workflow.progress_percentage}%` }}
                              />
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2 ml-4">
                          {workflow.status === 'running' ? (
                            <Button size="sm" variant="outline" onClick={() => pauseWorkflow(workflow.id)}>
                              <Pause className="h-4 w-4" />
                            </Button>
                          ) : (
                            <Button size="sm" variant="outline" onClick={() => openWorkflowSession(workflow.id)}>
                              <Play className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {/* Featured Templates */}
              <Card className="p-6 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Featured Templates</h2>
                  <Button size="sm" onClick={() => setActiveTab('templates')}>
                    Browse All
                  </Button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {featuredTemplates.slice(0, 6).map((template) => (
                    <div key={template.id} className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg flex flex-col justify-between">
                      <div>
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <h3 className="font-medium text-gray-900 dark:text-white mb-1">{template.name}</h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">{template.description}</p>
                          </div>
                          <Badge variant="outline" className="ml-2">
                            {template.category}
                          </Badge>
                        </div>
                        
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-4 text-xs text-gray-600 dark:text-gray-400">
                            <div className="flex items-center">
                              <Clock className="h-3 w-3 mr-1" />
                              {template.estimated_duration_minutes}min
                            </div>
                            <div className="flex items-center">
                              <DollarSign className="h-3 w-3 mr-1" />
                              ${template.estimated_cost_range.min.toFixed(2)}-${template.estimated_cost_range.max.toFixed(2)}
                            </div>
                          </div>
                          <div className="flex items-center">
                            <Star className="h-3 w-3 text-yellow-500 mr-1" />
                            <span className="text-xs text-gray-600 dark:text-gray-400">{template.rating?.toFixed(1) || 'N/A'}</span>
                          </div>
                        </div>
                      </div>
                      
                      <Button 
                        size="sm" 
                        className="w-full mt-2"
                        onClick={() => handleStartWorkflowClick(template)}
                      >
                        Start Workflow
                      </Button>
                    </div>
                  ))}
                </div>
              </Card>

            </div>
          )}

          {activeTab === 'workflows' && (
            <Card className="p-6 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">All Active Workflows</h2>
               <p className="text-gray-600 dark:text-gray-400">A detailed list of all your active workflows will be shown here.</p>
            </Card>
          )}

          {activeTab === 'templates' && (
            <Card className="p-6 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Workflow Template Marketplace</h2>
              <p className="text-gray-600 dark:text-gray-400">Template marketplace and builder coming soon...</p>
            </Card>
          )}

          {activeTab === 'settings' && (
            <div className="max-w-4xl mx-auto">
               <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">Platform Settings</h2>
               <p className="text-gray-600 dark:text-gray-400">A settings panel will be embedded here. For now, please use the main settings page.</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
} 