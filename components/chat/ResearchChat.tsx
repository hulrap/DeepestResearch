'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useEffect, useRef, useState } from 'react';

interface UsageMetrics {
  gemini: {
    inputTokens: number;
    outputTokens: number;
    cost: number;
  };
  openai: {
    inputTokens: number;
    outputTokens: number;
    cost: number;
  };
  total: {
    inputTokens: number;
    outputTokens: number;
    cost: number;
  };
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  usage?: UsageMetrics;
}

function UsageDisplay({ usage }: { usage: UsageMetrics }) {
  return (
    <div className="mt-3 p-3 bg-slate-800/50 rounded-lg border border-purple-800/30 text-sm">
      <div className="text-purple-300 font-medium mb-2">📊 Token Usage & Costs</div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Gemini Stats */}
        <div className="space-y-1">
          <div className="text-blue-300 font-medium">🔵 Gemini Flash</div>
          <div className="text-gray-300">
            Input: {usage.gemini.inputTokens.toLocaleString()} tokens
          </div>
          <div className="text-gray-300">
            Output: {usage.gemini.outputTokens.toLocaleString()} tokens
          </div>
          <div className="text-green-300 font-medium">
            Cost: ${usage.gemini.cost.toFixed(6)}
          </div>
        </div>

        {/* OpenAI Stats */}
        <div className="space-y-1">
          <div className="text-orange-300 font-medium">🟠 GPT-4 Turbo</div>
          <div className="text-gray-300">
            Input: {usage.openai.inputTokens.toLocaleString()} tokens
          </div>
          <div className="text-gray-300">
            Output: {usage.openai.outputTokens.toLocaleString()} tokens
          </div>
          <div className="text-green-300 font-medium">
            Cost: ${usage.openai.cost.toFixed(6)}
          </div>
        </div>

        {/* Total Stats */}
        <div className="space-y-1">
          <div className="text-purple-300 font-medium">⚡ Total</div>
          <div className="text-white">
            Input: {usage.total.inputTokens.toLocaleString()} tokens
          </div>
          <div className="text-white">
            Output: {usage.total.outputTokens.toLocaleString()} tokens
          </div>
          <div className="text-green-200 font-bold">
            Total Cost: ${usage.total.cost.toFixed(6)}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ResearchChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: '',
    };

    setMessages(prev => [...prev, assistantMessage]);

    try {
      const response = await fetch('/api/deep-research', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: userMessage.content }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') {
                break;
              }
              try {
                const parsed = JSON.parse(data);
                
                if (parsed.type === 'content' && parsed.content) {
                  // Handle content updates
                  setMessages(prev => 
                    prev.map(msg => 
                      msg.id === assistantMessage.id 
                        ? { ...msg, content: msg.content + parsed.content }
                        : msg
                    )
                  );
                } else if (parsed.type === 'usage' && parsed.usage) {
                  // Handle usage data
                  setMessages(prev => 
                    prev.map(msg => 
                      msg.id === assistantMessage.id 
                        ? { ...msg, usage: parsed.usage }
                        : msg
                    )
                  );
                }
              } catch {
                // Ignore parsing errors for malformed chunks
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error:', error);
      setMessages(prev => 
        prev.map(msg => 
          msg.id === assistantMessage.id 
            ? { ...msg, content: 'Sorry, there was an error processing your request. Please check your API keys and try again.' }
            : msg
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  return (
    <Card className="w-full max-w-5xl mx-auto flex flex-col h-[85vh] bg-purple-950/20 border-purple-800/20">
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-center text-purple-300">
          Deep Research Assistant
        </CardTitle>
        <p className="text-center text-sm text-gray-400">
          Powered by Google Gemini + OpenAI GPT-4 • Real-time token tracking
        </p>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-4 overflow-hidden">
        <div ref={messagesContainerRef} className="flex-1 overflow-y-auto pr-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex items-center justify-center h-full text-center">
              <div className="space-y-4">
                <p className="text-purple-400 text-lg">Start a conversation with the Deep Research Assistant</p>
                <div className="text-sm text-gray-400 space-y-2">
                  <p>This system combines two AI models:</p>
                  <p>🔵 <strong>Gemini Flash</strong> - Initial research and analysis</p>
                  <p>🟠 <strong>GPT-4 Turbo</strong> - Refinement and comprehensive response</p>
                  <p>📊 Full token usage and cost tracking included</p>
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
                <p className="whitespace-pre-wrap">{m.content}</p>
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
            disabled={isLoading}
          />
          <Button type="submit" disabled={isLoading || !input.trim()} className="bg-purple-600 hover:bg-purple-700 text-white">
            {isLoading ? 'Researching...' : 'Research'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
} 