'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bot, DollarSign, Workflow, Star } from 'lucide-react';

export default function AIDashboard() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-3">
            <Bot className="h-8 w-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">AI Agent Platform</h1>
            <Badge className="bg-green-100 text-green-800">Pro</Badge>
          </div>
          <div className="flex items-center space-x-2 text-sm">
            <DollarSign className="h-4 w-4 text-green-600" />
            <span>$0.045 / $10.00 daily</span>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Workflows</p>
                <p className="text-2xl font-bold">3</p>
              </div>
              <Workflow className="h-8 w-8 text-blue-600" />
            </div>
          </Card>
          
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Daily Cost</p>
                <p className="text-2xl font-bold">$0.045</p>
              </div>
              <DollarSign className="h-8 w-8 text-green-600" />
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Requests</p>
                <p className="text-2xl font-bold">47</p>
              </div>
              <Bot className="h-8 w-8 text-purple-600" />
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Models</p>
                <p className="text-2xl font-bold">12</p>
              </div>
              <Star className="h-8 w-8 text-yellow-600" />
            </div>
          </Card>
        </div>

        {/* Templates */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Featured Templates</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                name: 'Deep Research',
                description: 'Multi-agent research with fact-checking',
                category: 'research',
                rating: 4.8
              },
              {
                name: 'Content Creation',
                description: 'AI-powered content with SEO optimization',
                category: 'writing',
                rating: 4.6
              },
              {
                name: 'Market Analysis',
                description: 'Complete market research and trends',
                category: 'business',
                rating: 4.9
              }
            ].map((template, index) => (
              <div key={index} className="p-4 bg-gray-50 rounded-lg">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-medium">{template.name}</h3>
                  <Badge variant="outline">{template.category}</Badge>
                </div>
                <p className="text-sm text-gray-600 mb-3">{template.description}</p>
                <div className="flex justify-between items-center">
                  <div className="flex items-center">
                    <Star className="h-4 w-4 text-yellow-500 mr-1" />
                    <span className="text-sm">{template.rating}</span>
                  </div>
                  <Button size="sm">Start</Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
} 