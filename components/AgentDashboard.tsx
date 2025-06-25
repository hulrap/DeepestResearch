'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Bot, 
  Brain, 
  Zap, 
  DollarSign, 
  Users, 
  Clock, 
  Star,
  Play,
  Settings,
  FileText as Template,
  BarChart3,
  Workflow,
  Plus
} from 'lucide-react';

interface AgentDashboardProps {
  userId?: string;
}

interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  estimated_duration_minutes: number;
  estimated_cost_range: { min: number; max: number };
  rating: number;
  usage_count: number;
}

interface UsageStats {
  daily_cost: number;
  daily_limit: number;
  monthly_cost: number;
  total_requests: number;
}

export default function AgentDashboard({}: AgentDashboardProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'workflows' | 'templates' | 'analytics'>('overview');
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [usageStats] = useState<UsageStats>({
    daily_cost: 0.045,
    daily_limit: 10.00,
    monthly_cost: 1.23,
    total_requests: 47
  });

  useEffect(() => {
    // Load sample templates
    setTemplates([
      {
        id: '1',
        name: 'Deep Research Analysis',
        description: 'Comprehensive multi-agent research workflow with fact-checking and synthesis',
        category: 'research',
        estimated_duration_minutes: 5,
        estimated_cost_range: { min: 0.01, max: 0.08 },
        rating: 4.8,
        usage_count: 1247
      },
      {
        id: '2',
        name: 'Content Creation',
        description: 'AI-powered content generation with SEO optimization and tone adjustment',
        category: 'writing',
        estimated_duration_minutes: 3,
        estimated_cost_range: { min: 0.005, max: 0.03 },
        rating: 4.6,
        usage_count: 892
      },
      {
        id: '3',
        name: 'Market Analysis',
        description: 'Complete market research with competitor analysis and trend identification',
        category: 'business',
        estimated_duration_minutes: 8,
        estimated_cost_range: { min: 0.02, max: 0.12 },
        rating: 4.9,
        usage_count: 634
      }
    ]);
  }, []);

  const startWorkflow = (templateId: string) => {
    console.log(`Starting workflow from template ${templateId}`);
    // This would integrate with the workflow system
  };

  return (
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
              <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">
                <Zap className="h-3 w-3 mr-1" />
                Pro
              </Badge>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 text-sm">
                <DollarSign className="h-4 w-4 text-green-600" />
                <span className="text-gray-600 dark:text-gray-300">
                  ${usageStats.daily_cost.toFixed(3)} / ${usageStats.daily_limit.toFixed(2)}
                </span>
                <div className="w-16 h-2 bg-gray-200 rounded-full">
                  <div 
                    className="h-2 bg-green-500 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, (usageStats.daily_cost / usageStats.daily_limit) * 100)}%` }}
                  />
                </div>
              </div>
              
              <Button variant="outline" size="sm">
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
            { id: 'analytics', label: 'Analytics', icon: BarChart3 }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as 'overview' | 'workflows' | 'templates' | 'analytics')}
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

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="p-6 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Active Workflows</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">3</p>
                  </div>
                  <Workflow className="h-8 w-8 text-blue-600" />
                </div>
              </Card>
              
              <Card className="p-6 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Daily Cost</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      ${usageStats.daily_cost.toFixed(3)}
                    </p>
                  </div>
                  <DollarSign className="h-8 w-8 text-green-600" />
                </div>
              </Card>

              <Card className="p-6 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Requests</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{usageStats.total_requests}</p>
                  </div>
                  <BarChart3 className="h-8 w-8 text-purple-600" />
                </div>
              </Card>

              <Card className="p-6 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">AI Models</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">12</p>
                  </div>
                  <Brain className="h-8 w-8 text-indigo-600" />
                </div>
              </Card>
            </div>

            {/* Featured Templates */}
            <Card className="p-6 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Featured Workflow Templates</h2>
                <Button size="sm" onClick={() => setActiveTab('templates')}>
                  Browse All
                </Button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {templates.map((template) => (
                  <div key={template.id} className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
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
                          ${template.estimated_cost_range.min.toFixed(3)}-${template.estimated_cost_range.max.toFixed(3)}
                        </div>
                      </div>
                      <div className="flex items-center">
                        <Star className="h-3 w-3 text-yellow-500 mr-1" />
                        <span className="text-xs text-gray-600 dark:text-gray-400">{template.rating.toFixed(1)}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        <Users className="h-3 w-3 inline mr-1" />
                        {template.usage_count} uses
                      </span>
                    </div>
                    
                    <Button 
                      size="sm" 
                      className="w-full"
                      onClick={() => startWorkflow(template.id)}
                    >
                      <Play className="h-4 w-4 mr-2" />
                      Start Workflow
                    </Button>
                  </div>
                ))}
              </div>
            </Card>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="p-6 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quick Actions</h2>
                <div className="space-y-3">
                  <Button className="w-full justify-start" variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Custom Workflow
                  </Button>
                  <Button className="w-full justify-start" variant="outline">
                    <Settings className="h-4 w-4 mr-2" />
                    Configure AI Models
                  </Button>
                  <Button className="w-full justify-start" variant="outline">
                    <Users className="h-4 w-4 mr-2" />
                    Invite Team Members
                  </Button>
                </div>
              </Card>

              <Card className="p-6 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Recent Activity</h2>
                <div className="space-y-3">
                  <div className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">Research workflow completed</p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">2 minutes ago</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">New template created</p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">1 hour ago</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">Team member joined</p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">3 hours ago</p>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* Other tabs */}
        {activeTab === 'workflows' && (
          <Card className="p-6 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Active Workflows</h2>
            <p className="text-gray-600 dark:text-gray-400">Workflow management interface coming soon...</p>
          </Card>
        )}

        {activeTab === 'templates' && (
          <Card className="p-6 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Workflow Templates</h2>
            <p className="text-gray-600 dark:text-gray-400">Template marketplace coming soon...</p>
          </Card>
        )}

        {activeTab === 'analytics' && (
          <Card className="p-6 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Analytics & Insights</h2>
            <p className="text-gray-600 dark:text-gray-400">Advanced analytics dashboard coming soon...</p>
          </Card>
        )}
      </div>
    </div>
  );
} 