'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
  Pause,
  Settings,
  FileText as Template,
  History,
  BarChart3,
  Workflow,
  Share2,
  Download,
  Plus
} from 'lucide-react';
import { WorkflowTemplateManager, WorkflowTemplate } from '@/lib/workflow-templates';
// import { ModelSelector } from '@/lib/model-selector';
import { MemorySystem, Memory } from '@/lib/memory';
import { UsageMonitor } from '@/lib/cost-management';
import ResearchInterface from '@/components/ResearchInterface';

interface AgentDashboardProps {
  userId: string;
  userApiKeys?: Map<string, string>;
}

interface ActiveWorkflow {
  id: string;
  title: string;
  status: 'running' | 'paused' | 'completed' | 'failed';
  progress: number;
  current_step: string;
  estimated_cost: number;
  actual_cost: number;
  collaborators: string[];
  created_at: Date;
}

interface UsageStats {
  daily_cost: number;
  daily_limit: number;
  monthly_cost: number;
  monthly_limit: number;
  total_requests: number;
  favorite_models: string[];
  total_workflows: number;
}

export default function AgentDashboard({ userId }: AgentDashboardProps) {
  // State management
  const [activeTab, setActiveTab] = useState<'overview' | 'workflows' | 'templates' | 'analytics' | 'settings'>('overview');
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [activeWorkflows, setActiveWorkflows] = useState<ActiveWorkflow[]>([]);
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);
  const [recentMemories, setRecentMemories] = useState<Memory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showResearchInterface, setShowResearchInterface] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  // System instances
  const [templateManager] = useState(() => new WorkflowTemplateManager());
  const [memorySystem] = useState(() => new MemorySystem());
  const [usageMonitor] = useState(() => new UsageMonitor());

  const loadDashboardData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Use mock data instead of database calls for now
      console.log('Loading dashboard data with mock data...');
      
      // Mock featured templates
      const mockTemplates: WorkflowTemplate[] = [
        {
          id: '1',
          name: 'Deep Research Analysis',
          description: 'Comprehensive multi-agent research workflow with fact-checking and synthesis',
          category: 'research',
          difficulty_level: 'intermediate',
          estimated_duration_minutes: 5,
          estimated_cost_range: { min: 0.01, max: 0.08 },
          is_public: true,
          template_data: { steps: [], variables: [] },
          tags: ['research', 'analysis', 'multi-agent'],
          usage_count: 1247,
          rating: 4.8
        },
        {
          id: '2',
          name: 'Content Creation',
          description: 'AI-powered content generation with SEO optimization and tone adjustment',
          category: 'writing',
          difficulty_level: 'beginner',
          estimated_duration_minutes: 3,
          estimated_cost_range: { min: 0.005, max: 0.03 },
          is_public: true,
          template_data: { steps: [], variables: [] },
          tags: ['writing', 'content', 'seo'],
          usage_count: 892,
          rating: 4.6
        },
        {
          id: '3',
          name: 'Market Analysis',
          description: 'Complete market research with competitor analysis and trend identification',
          category: 'business',
          difficulty_level: 'advanced',
          estimated_duration_minutes: 8,
          estimated_cost_range: { min: 0.02, max: 0.12 },
          is_public: true,
          template_data: { steps: [], variables: [] },
          tags: ['business', 'market', 'analysis'],
          usage_count: 634,
          rating: 4.9
        }
      ];
      
      setTemplates(mockTemplates);

      // Mock usage statistics
      const mockStats = {
        daily_cost: 0.045,
        daily_limit: 10.00,
        monthly_cost: 1.23,
        monthly_limit: 100.00,
        total_requests: 47,
        favorite_models: ['gpt-4-turbo', 'claude-3-sonnet'],
        total_workflows: 3
      };
      setUsageStats(mockStats);

      // Mock recent memories
      const mockMemories: Memory[] = [
        {
          id: '1',
          user_id: userId,
          memory_type: 'conversation',
          content: 'User asked about AI research methodologies',
          importance_score: 0.8,
          context_tags: ['research', 'ai'],
          created_at: new Date(),
          last_accessed_at: new Date()
        }
      ];
      setRecentMemories(mockMemories);

      // Load active workflows (kept as mock)
      setActiveWorkflows([
        {
          id: '1',
          title: 'Market Research Analysis',
          status: 'running',
          progress: 65,
          current_step: 'Analysis Phase',
          estimated_cost: 0.08,
          actual_cost: 0.052,
          collaborators: [],
          created_at: new Date()
        }
      ]);

      console.log('Dashboard data loaded successfully with mock data');

    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      // Set some default data even if there's an error
      setTemplates([]);
      setUsageStats(null);
      setRecentMemories([]);
      setActiveWorkflows([]);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  // Load dashboard data
  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const startWorkflowFromTemplate = async (templateId: string) => {
    try {
      console.log(`Starting workflow from template: ${templateId}`);
      
      // Show immediate feedback
      alert(`Starting workflow: ${templates.find(t => t.id === templateId)?.name || 'Unknown'}\n\nThis will be implemented with the database integration.`);
      
      // For now, just simulate starting a workflow
      const mockSessionId = `session_${Date.now()}`;
      console.log(`Mock session created: ${mockSessionId}`);
      
      // You could add more visual feedback here
      // For example, showing a loading state or updating the UI
      
    } catch (error) {
      console.error('Failed to start workflow:', error);
      alert(`Failed to start workflow: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const pauseWorkflow = async (workflowId: string) => {
    try {
      console.log(`Pausing workflow ${workflowId}`);
      alert(`Pausing workflow: ${workflowId}\n\nThis will be implemented with the database integration.`);
    } catch (error) {
      console.error('Failed to pause workflow:', error);
      alert(`Failed to pause workflow: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600">        </div>
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
          }}
        />
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
              <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">
                <Zap className="h-3 w-3 mr-1" />
                Pro
              </Badge>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Usage indicator */}
              {usageStats && (
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
              )}
              
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
            { id: 'analytics', label: 'Analytics', icon: BarChart3 },
            { id: 'settings', label: 'Settings', icon: Settings }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as 'overview' | 'workflows' | 'templates' | 'analytics' | 'settings')}
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
                      ${usageStats?.daily_cost.toFixed(3) || '0.000'}
                    </p>
                  </div>
                  <DollarSign className="h-8 w-8 text-green-600" />
                </div>
              </Card>

              <Card className="p-6 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Requests</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{usageStats?.total_requests || 0}</p>
                  </div>
                  <BarChart3 className="h-8 w-8 text-purple-600" />
                </div>
              </Card>

              <Card className="p-6 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Memories</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{recentMemories.length}</p>
                  </div>
                  <Brain className="h-8 w-8 text-indigo-600" />
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
                  {activeWorkflows.map((workflow) => (
                    <div key={workflow.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <h3 className="font-medium text-gray-900 dark:text-white">{workflow.title}</h3>
                          <Badge variant={workflow.status === 'running' ? 'default' : 'secondary'}>
                            {workflow.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{workflow.current_step}</p>
                        
                        {/* Progress bar */}
                        <div className="mt-2">
                          <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
                            <span>Progress: {workflow.progress}%</span>
                            <span>${workflow.actual_cost.toFixed(3)} / ${workflow.estimated_cost.toFixed(3)}</span>
                          </div>
                          <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                            <div 
                              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${workflow.progress}%` }}
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
                          <Button size="sm" variant="outline">
                            <Play className="h-4 w-4" />
                          </Button>
                        )}
                        <Button size="sm" variant="outline">
                          <Share2 className="h-4 w-4" />
                        </Button>
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
                {templates.slice(0, 6).map((template) => (
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
                    
                    <Button 
                      size="sm" 
                      className="w-full"
                      onClick={() => startWorkflowFromTemplate(template.id)}
                    >
                      Start Workflow
                    </Button>
                  </div>
                ))}
              </div>
            </Card>

            {/* Recent Activity & Memory */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="p-6 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Recent Memories</h2>
                {recentMemories.length === 0 ? (
                  <div className="text-center py-4">
                    <Brain className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-600 dark:text-gray-400 text-sm">No memories stored yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recentMemories.map((memory, index) => (
                      <div key={index} className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant="outline" className="text-xs">
                            {memory.memory_type}
                          </Badge>
                          <span className="text-xs text-gray-500">
                            {memory.created_at.toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-sm text-gray-900 dark:text-white line-clamp-2">
                          {memory.content}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <Card className="p-6 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quick Actions</h2>
                <div className="space-y-3">
                  <Button className="w-full justify-start" variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Custom Workflow
                  </Button>
                  <Button className="w-full justify-start" variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    Export Workflow Results
                  </Button>
                  <Button className="w-full justify-start" variant="outline">
                    <Users className="h-4 w-4 mr-2" />
                    Invite Collaborators
                  </Button>
                  <Button className="w-full justify-start" variant="outline">
                    <History className="h-4 w-4 mr-2" />
                    View Workflow History
                  </Button>
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* Other tab contents would go here */}
        {activeTab === 'workflows' && (
          <Card className="p-6 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Workflow Management</h2>
            <p className="text-gray-600 dark:text-gray-400">Advanced workflow management interface coming soon...</p>
          </Card>
        )}

        {activeTab === 'templates' && (
          <Card className="p-6 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Workflow Templates</h2>
            <p className="text-gray-600 dark:text-gray-400">Template marketplace and builder coming soon...</p>
          </Card>
        )}

        {activeTab === 'analytics' && (
          <Card className="p-6 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Analytics & Insights</h2>
            <p className="text-gray-600 dark:text-gray-400">Advanced analytics dashboard coming soon...</p>
          </Card>
        )}

        {activeTab === 'settings' && (
          <Card className="p-6 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Platform Settings</h2>
            <p className="text-gray-600 dark:text-gray-400">Settings and configuration panel coming soon...</p>
          </Card>
        )}
      </div>
    </div>
    </>
  );
} 