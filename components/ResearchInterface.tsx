'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Send } from 'lucide-react';

interface ResearchInterfaceProps {
  sessionId: string;
  onClose: () => void;
}

interface UsageData {
  total: {
    cost: number;
    inputTokens: number;
    outputTokens: number;
  };
}

export default function ResearchInterface({ onClose }: ResearchInterfaceProps) {
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [usage, setUsage] = useState<UsageData | null>(null);

  const runResearch = async () => {
    if (!prompt.trim()) return;

    setIsLoading(true);
    setResponse('');
    setUsage(null);

    try {
      const response = await fetch('/api/deep-research', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt }),
      });

      if (!response.ok) {
        throw new Error('Research failed');
      }

      const reader = response.body?.getReader();
      if (!reader) return;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = new TextDecoder().decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              setIsLoading(false);
              return;
            }

            try {
              const parsed = JSON.parse(data);
              if (parsed.type === 'content') {
                setResponse(prev => prev + parsed.content);
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
      setResponse('Error: Failed to run research. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">AI Research Session</h2>
            <Button variant="outline" onClick={onClose}>Close</Button>
          </div>

          <div className="space-y-4">
            {/* Research Input */}
            <div>
              <label className="block text-sm font-medium mb-2">Research Topic</label>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="What would you like to research? Be specific about your requirements..."
                rows={3}
                className="w-full"
              />
              <Button 
                onClick={runResearch} 
                disabled={isLoading || !prompt.trim()}
                className="mt-2"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Start Research
              </Button>
            </div>

            {/* Research Output */}
            {(response || isLoading) && (
              <div>
                <label className="block text-sm font-medium mb-2">Research Results</label>
                <div className="border rounded-lg p-4 min-h-[300px] max-h-[400px] overflow-y-auto bg-gray-50 dark:bg-gray-900">
                  {isLoading && !response && (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                        <p className="text-sm text-gray-600">Running multi-agent research...</p>
                      </div>
                    </div>
                  )}
                  {response && (
                    <div className="whitespace-pre-wrap text-sm">
                      {response}
                      {isLoading && <span className="animate-pulse">▊</span>}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Usage Statistics */}
            {usage && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div className="text-center">
                  <div className="text-lg font-semibold">${usage.total.cost.toFixed(4)}</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">Total Cost</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-semibold">{usage.total.inputTokens + usage.total.outputTokens}</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">Total Tokens</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-semibold">2 Models</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">Gemini + GPT-4</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
} 