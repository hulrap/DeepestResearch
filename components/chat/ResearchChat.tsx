'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useEffect, useRef, useState } from 'react';
import { useSettings } from '@/lib/settings/use-settings';

interface UsageMetrics {
  total_cost_usd: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_requests: number;
  provider_breakdown: Record<string, {
    cost: number;
    input_tokens: number;
    output_tokens: number;
    requests: number;
  }>;
  model_breakdown: Record<string, {
    cost: number;
    input_tokens: number;
    output_tokens: number;
    requests: number;
  }>;
  avg_latency_ms: number;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  usage?: UsageMetrics;
  timestamp: Date;
}

function UsageDisplay({ usage }: { usage: UsageMetrics }) {
  return (
    <div className="mt-3 p-3 bg-slate-800/50 rounded-lg border border-purple-800/30 text-sm">
      <div className="text-purple-300 font-medium mb-2">📊 Token Usage & Costs</div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Provider Breakdown */}
        {Object.entries(usage.provider_breakdown).map(([provider, data]) => (
          <div key={provider} className="space-y-1">
            <div className="text-blue-300 font-medium capitalize">
              {provider === 'google' ? '🔵 Gemini' : provider === 'openai' ? '🟠 OpenAI' : `🔷 ${provider}`}
            </div>
            <div className="text-gray-300">
              Input: {data.input_tokens.toLocaleString()} tokens
            </div>
            <div className="text-gray-300">
              Output: {data.output_tokens.toLocaleString()} tokens
            </div>
            <div className="text-green-300 font-medium">
              Cost: ${data.cost.toFixed(6)}
            </div>
          </div>
        ))}

        {/* Total Stats */}
        <div className="space-y-1">
          <div className="text-purple-300 font-medium">⚡ Total</div>
          <div className="text-white">
            Input: {usage.total_input_tokens.toLocaleString()} tokens
          </div>
          <div className="text-white">
            Output: {usage.total_output_tokens.toLocaleString()} tokens
          </div>
          <div className="text-green-200 font-bold">
            Total Cost: ${usage.total_cost_usd.toFixed(6)}
          </div>
          <div className="text-gray-300 text-xs">
            Latency: {usage.avg_latency_ms}ms • {usage.total_requests} requests
          </div>
        </div>
      </div>

      {/* Model Breakdown */}
      {Object.keys(usage.model_breakdown).length > 0 && (
        <div className="mt-3 pt-3 border-t border-purple-800/30">
          <div className="text-purple-300 font-medium mb-2">🤖 Models Used</div>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(usage.model_breakdown).map(([model, data]) => (
              <div key={model} className="flex justify-between text-xs">
                <span className="text-gray-300">{model}</span>
                <span className="text-green-300">${data.cost.toFixed(4)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function ResearchChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const {
    profile,
    userConfiguration,
    refreshAll
  } = useSettings();

  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Check if user can make requests
  const canMakeRequest = () => {
    if (!userConfiguration) return true;
    
    const totalCost = messages.reduce((sum, msg) => 
      sum + (msg.usage?.total_cost_usd ?? 0), 0
    );
    
    return totalCost < userConfiguration.effective_daily_cost_limit;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    if (!canMakeRequest()) {
      alert('Daily usage limit reached. Please check your settings or upgrade your plan.');
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: '',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, assistantMessage]);

    try {
      const response = await fetch('/api/deep-research', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          prompt: userMessage.content,
          user_id: profile?.id,
          session_id: `chat_${Date.now()}`
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (typeof data?.type === 'string' && typeof data?.content === 'string') {
                setMessages(prev => prev.map(msg => 
                  msg.id === assistantMessage.id 
                    ? { ...msg, content: msg.content + data.content }
                    : msg
                ));
              } else if (typeof data?.type === 'string' && data.type === 'step' && typeof data?.step === 'object') {
                // Handle step updates - could add step state here if needed
              } else if (typeof data?.type === 'string' && data.type === 'usage' && typeof data?.usage === 'object') {
                setMessages(prev => prev.map(msg => 
                  msg.id === assistantMessage.id 
                    ? { ...msg, usage: data.usage as UsageMetrics }
                    : msg
                ));
              }
            } catch (error) {
              console.error('Error parsing streaming data:', error);
            }
          }
        }
      }

      void refreshAll();
    } catch (error) {
      console.error('Error:', error);
      setMessages(prev => prev.map(msg => 
        msg.id === assistantMessage.id 
          ? { ...msg, content: 'Sorry, there was an error processing your request.' }
          : msg
      ));
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  // Calculate session totals
  const sessionTotals = messages.reduce((totals, msg) => {
    if (msg.usage) {
      totals.cost += msg.usage.total_cost_usd;
      totals.tokens += msg.usage.total_input_tokens + msg.usage.total_output_tokens;
      totals.requests += msg.usage.total_requests;
    }
    return totals;
  }, { cost: 0, tokens: 0, requests: 0 });

  return (
    <Card className="w-full max-w-5xl mx-auto flex flex-col h-[85vh] bg-purple-950/20 border-purple-800/20">
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-center text-purple-300">
          Deep Research Assistant
        </CardTitle>
        <div className="text-center space-y-1">
          <p className="text-sm text-gray-400">
            Powered by Multi-Agent AI • Real-time usage tracking
          </p>
          {userConfiguration && (
            <div className="flex justify-center items-center space-x-4 text-xs text-gray-500">
              <span>Daily limit: ${userConfiguration.effective_daily_cost_limit}</span>
              <span>Session cost: ${sessionTotals.cost.toFixed(4)}</span>
              <span>Tokens: {sessionTotals.tokens.toLocaleString()}</span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-4 overflow-hidden">
        <div ref={messagesContainerRef} className="flex-1 overflow-y-auto pr-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex items-center justify-center h-full text-center">
              <div className="space-y-4">
                <p className="text-purple-400 text-lg">Start a conversation with the Deep Research Assistant</p>
                <div className="text-sm text-gray-400 space-y-2">
                  <p>This system combines multiple AI models for comprehensive research:</p>
                  <p>🔵 <strong>Gemini</strong> - Fast initial analysis</p>
                  <p>🟠 <strong>GPT-4</strong> - Deep reasoning and synthesis</p>
                  <p>🔷 <strong>Claude</strong> - Additional perspectives</p>
                  <p>📊 Complete usage tracking and cost management</p>
                </div>
              </div>
            </div>
          )}
          {messages.map(m => (
            <div key={m.id} className={`flex gap-3 my-4 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {m.role !== 'user' && (
                <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                  AI
                </div>
              )}
              <div className={`rounded-lg p-3 max-w-2xl ${m.role === 'user' ? 'bg-purple-700 text-white' : 'bg-gray-800 text-gray-200'}`}>
                <div className="flex justify-between items-start mb-2">
                  <p className="whitespace-pre-wrap flex-1">{m.content}</p>
                  <span className="text-xs text-gray-400 ml-2">
                    {m.timestamp.toLocaleTimeString()}
                  </span>
                </div>
                {m.role === 'assistant' && m.usage && (
                  <UsageDisplay usage={m.usage} />
                )}
              </div>
            </div>
          ))}
        </div>
        <form onSubmit={handleSubmit} className="flex items-center gap-2 pt-4 border-t border-purple-800/30">
          <Input
            value={input}
            onChange={handleInputChange}
            placeholder="Ask a research question (e.g., 'Explain quantum computing applications in 2024')"
            className="flex-1 bg-gray-800 border-purple-700 text-white placeholder:text-gray-400"
            disabled={isLoading || !canMakeRequest()}
          />
          <Button 
            type="submit" 
            disabled={isLoading || !input.trim() || !canMakeRequest()} 
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            {isLoading ? 'Researching...' : 'Research'}
          </Button>
        </form>
        {!canMakeRequest() && (
          <div className="text-center text-sm text-orange-400 bg-orange-900/20 p-2 rounded">
            Daily usage limit reached. Please check your settings.
          </div>
        )}
      </CardContent>
    </Card>
  );
} 