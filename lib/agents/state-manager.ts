// Agent State Management System
// Handles workflow persistence, error recovery, parallel execution, and context passing

import { createClient } from '@/lib/supabase/client';
import { UnifiedAIClient } from '@/lib/adapters/unified-ai-client';
import { UsageMonitor } from '@/lib/cost-management';

export interface WorkflowContext {
  input: unknown;
  output: unknown;
  metadata: Record<string, unknown>;
  history: Array<{
    step: string;
    timestamp: Date;
    input: unknown;
    output: unknown;
    duration_ms: number;
  }>;
}

export interface AgentStep {
  id: string;
  name: string;
  type: 'sequential' | 'parallel' | 'conditional';
  agent_type: string;
  model: string;
  prompt_template: string;
  dependencies: string[];
  timeout_ms: number;
  retry_count: number;
  context_requirements: string[];
}

export interface WorkflowState {
  id: string;
  user_id: string;
  template_id: string;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  current_step: string;
  steps: AgentStep[];
  context: WorkflowContext;
  progress: number;
  total_cost: number;
  error_message?: string;
  created_at: Date;
  updated_at: Date;
  metadata: Record<string, unknown>;
}

export interface ExecutionResult {
  success: boolean;
  output: unknown;
  error?: string;
  metadata: Record<string, unknown>;
  duration_ms: number;
}

export interface ParallelExecutionResult {
  step_id: string;
  result: ExecutionResult;
}

export class AgentStateManager {
  private supabase = createClient();
  private aiClient: UnifiedAIClient;
  private usageMonitor: UsageMonitor;
  private activeWorkflows = new Map<string, WorkflowState>();
  private executionQueue = new Map<string, Promise<ExecutionResult>>();

  constructor() {
    this.aiClient = new UnifiedAIClient();
    this.usageMonitor = new UsageMonitor();
  }

  // Create a new workflow
  async createWorkflow(
    userId: string,
    templateId: string,
    initialInput: unknown,
    metadata: Record<string, unknown> = {}
  ): Promise<string> {
    const workflowId = `workflow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Load workflow template
    const { data: template } = await this.supabase
      .from('workflow_templates')
      .select('*')
      .eq('id', templateId)
      .single();

    if (!template) {
      throw new Error(`Workflow template ${templateId} not found`);
    }

    const steps: AgentStep[] = template.steps || [];
    
    const workflowState: WorkflowState = {
      id: workflowId,
      user_id: userId,
      template_id: templateId,
      status: 'pending',
      current_step: steps[0]?.id || '',
      steps,
      context: {
        input: initialInput,
        output: null,
        metadata,
        history: []
      },
      progress: 0,
      total_cost: 0,
      created_at: new Date(),
      updated_at: new Date(),
      metadata
    };

    // Store in database
    await this.supabase
      .from('workflow_executions')
      .insert({
        id: workflowId,
        user_id: userId,
        template_id: templateId,
        status: 'pending',
        current_step: workflowState.current_step,
        context: workflowState.context,
        steps: workflowState.steps,
        progress: 0,
        total_cost: 0,
        metadata
      });

    // Store in memory
    this.activeWorkflows.set(workflowId, workflowState);

    return workflowId;
  }

  // Resume a workflow from database
  async resumeWorkflow(workflowId: string): Promise<WorkflowState> {
    // Check if already in memory
    if (this.activeWorkflows.has(workflowId)) {
      return this.activeWorkflows.get(workflowId)!;
    }

    // Load from database
    const { data: workflow } = await this.supabase
      .from('workflow_executions')
      .select('*')
      .eq('id', workflowId)
      .single();

    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    const workflowState: WorkflowState = {
      id: workflow.id,
      user_id: workflow.user_id,
      template_id: workflow.template_id,
      status: workflow.status,
      current_step: workflow.current_step,
      steps: workflow.steps || [],
      context: workflow.context || { input: null, output: null, metadata: {}, history: [] },
      progress: workflow.progress || 0,
      total_cost: workflow.total_cost || 0,
      error_message: workflow.error_message,
      created_at: new Date(workflow.created_at),
      updated_at: new Date(workflow.updated_at),
      metadata: workflow.metadata || {}
    };

    this.activeWorkflows.set(workflowId, workflowState);
    return workflowState;
  }

  // Execute a single step
  async executeStep(
    workflowId: string,
    stepId: string,
    context: WorkflowContext
  ): Promise<ExecutionResult> {
    const workflow = await this.resumeWorkflow(workflowId);
    const step = workflow.steps.find(s => s.id === stepId);
    
    if (!step) {
      throw new Error(`Step ${stepId} not found in workflow ${workflowId}`);
    }

    const startTime = Date.now();
    
    try {
      // Update workflow status
      await this.updateWorkflowStatus(workflowId, 'running', stepId);

      // Execute the step
      const result = await this.performStepExecution(step, context);
      
      const duration = Date.now() - startTime;

      // Update context with result
      context.history.push({
        step: stepId,
        timestamp: new Date(),
        input: context.input,
        output: result.output,
        duration_ms: duration
      });

      context.output = result.output;

      // Update workflow state
      await this.updateWorkflowContext(workflowId, context);

      return {
        success: true,
        output: result.output,
        metadata: result.metadata,
        duration_ms: duration
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      await this.updateWorkflowStatus(workflowId, 'failed', stepId, errorMessage);
      
      return {
        success: false,
        output: null,
        error: errorMessage,
        metadata: {},
        duration_ms: duration
      };
    }
  }

  // Execute multiple steps in parallel
  async executeParallelSteps(
    workflowId: string,
    stepIds: string[],
    context: WorkflowContext
  ): Promise<ParallelExecutionResult[]> {
    const workflow = await this.resumeWorkflow(workflowId);
    const steps = workflow.steps.filter(s => stepIds.includes(s.id));

    if (steps.length !== stepIds.length) {
      throw new Error('Some steps not found in workflow');
    }

    // Execute all steps in parallel
    const promises = steps.map(async (step): Promise<ParallelExecutionResult> => {
      const result = await this.executeStep(workflowId, step.id, { ...context });
      return {
        step_id: step.id,
        result
      };
    });

    return Promise.all(promises);
  }

  // Update workflow status
  async updateWorkflowStatus(
    workflowId: string,
    status: WorkflowState['status'],
    currentStep?: string,
    errorMessage?: string
  ): Promise<void> {
    const workflow = this.activeWorkflows.get(workflowId);
    
    if (workflow) {
      workflow.status = status;
      workflow.updated_at = new Date();
      
      if (currentStep) {
        workflow.current_step = currentStep;
      }
      
      if (errorMessage) {
        workflow.error_message = errorMessage;
      }
    }

    // Update database
    const updates: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString()
    };

    if (currentStep) {
      updates.current_step = currentStep;
    }

    if (errorMessage) {
      updates.error_message = errorMessage;
    }

    await this.supabase
      .from('workflow_executions')
      .update(updates)
      .eq('id', workflowId);
  }

  // Update workflow context
  async updateWorkflowContext(workflowId: string, context: WorkflowContext): Promise<void> {
    const workflow = this.activeWorkflows.get(workflowId);
    
    if (workflow) {
      workflow.context = context;
      workflow.updated_at = new Date();
    }

    await this.supabase
      .from('workflow_executions')
      .update({
        context,
        updated_at: new Date().toISOString()
      })
      .eq('id', workflowId);
  }

  // Get workflow state
  async getWorkflowState(workflowId: string): Promise<WorkflowState | null> {
    return this.activeWorkflows.get(workflowId) || await this.resumeWorkflow(workflowId);
  }

  // Cancel workflow
  async cancelWorkflow(workflowId: string): Promise<void> {
    await this.updateWorkflowStatus(workflowId, 'cancelled');
    
    // Clean up execution queue
    if (this.executionQueue.has(workflowId)) {
      this.executionQueue.delete(workflowId);
    }
  }

  // Pause workflow
  async pauseWorkflow(workflowId: string): Promise<void> {
    await this.updateWorkflowStatus(workflowId, 'paused');
  }

  // Resume paused workflow
  async resumePausedWorkflow(workflowId: string): Promise<void> {
    await this.updateWorkflowStatus(workflowId, 'running');
  }

  // Get workflow progress
  async getWorkflowProgress(workflowId: string): Promise<{
    progress: number;
    current_step: string;
    total_steps: number;
    completed_steps: number;
  }> {
    const workflow = await this.getWorkflowState(workflowId);
    
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    const totalSteps = workflow.steps.length;
    const completedSteps = workflow.context.history.length;
    const progress = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

    return {
      progress,
      current_step: workflow.current_step,
      total_steps: totalSteps,
      completed_steps: completedSteps
    };
  }

  // Retry failed step
  async retryFailedStep(workflowId: string, stepId: string): Promise<ExecutionResult> {
    const workflow = await this.resumeWorkflow(workflowId);
    const step = workflow.steps.find(s => s.id === stepId);
    
    if (!step) {
      throw new Error(`Step ${stepId} not found`);
    }

    // Reset step retry count
    step.retry_count = Math.max(0, step.retry_count - 1);
    
    return this.executeStep(workflowId, stepId, workflow.context);
  }

  // Clean up completed workflows
  async cleanupWorkflows(olderThanDays: number = 7): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    // Remove from database
    await this.supabase
      .from('workflow_executions')
      .delete()
      .eq('status', 'completed')
      .lt('updated_at', cutoffDate.toISOString());

    // Remove from memory
    for (const [workflowId, workflow] of this.activeWorkflows) {
      if (workflow.status === 'completed' && workflow.updated_at < cutoffDate) {
        this.activeWorkflows.delete(workflowId);
      }
    }
  }

  // Error recovery: Auto-retry failed steps
  async autoRetryFailedSteps(): Promise<void> {
    for (const [workflowId, workflow] of this.activeWorkflows) {
      if (workflow.status === 'failed') {
        const currentStep = workflow.steps.find(s => s.id === workflow.current_step);
        
        if (currentStep && currentStep.retry_count > 0) {
          console.log(`Auto-retrying failed step ${currentStep.id} in workflow ${workflowId}`);
          
          try {
            await this.retryFailedStep(workflowId, currentStep.id);
          } catch (error) {
            console.error(`Auto-retry failed for step ${currentStep.id}:`, error);
          }
        }
      }
    }
  }

  // Get workflow statistics
  async getWorkflowStats(): Promise<{
    total: number;
    running: number;
    completed: number;
    failed: number;
    paused: number;
  }> {
    const { data: stats } = await this.supabase
      .from('workflow_executions')
      .select('status')
      .neq('status', 'cancelled');

    const counts = {
      total: stats?.length || 0,
      running: 0,
      completed: 0,
      failed: 0,
      paused: 0
    };

    stats?.forEach(workflow => {
      switch (workflow.status) {
        case 'running':
          counts.running++;
          break;
        case 'completed':
          counts.completed++;
          break;
        case 'failed':
          counts.failed++;
          break;
        case 'paused':
          counts.paused++;
          break;
      }
    });

    return counts;
  }

  // Private helper methods
  private async performStepExecution(
    step: AgentStep,
    context: WorkflowContext
  ): Promise<ExecutionResult> {
    try {
      // Get the unified AI client for this step
      const prompt = this.interpolatePromptWithContext(step.prompt_template, context);
      
      // This would integrate with the actual AI model execution
      const response = await this.executeAIStep(step, prompt);
      
      return {
        success: true,
        output: response.content,
        metadata: {
          model: step.model,
          agent_type: step.agent_type,
          tokens_used: response.tokens_used,
          cost: response.cost,
          latency_ms: response.latency_ms
        },
        duration_ms: response.latency_ms
      };
    } catch (error) {
      return {
        success: false,
        output: null,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: {},
        duration_ms: 0
      };
    }
  }
  
  private interpolatePromptWithContext(template: string, context: WorkflowContext): string {
    let prompt = template;
    
    // Replace context variables in the prompt
    prompt = prompt.replace(/\{\{input\}\}/g, String(context.input || ''));
    prompt = prompt.replace(/\{\{output\}\}/g, String(context.output || ''));
    
    // Replace variables from metadata
    Object.entries(context.metadata).forEach(([key, value]) => {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      prompt = prompt.replace(regex, String(value));
    });
    
    // Replace variables from step history
    context.history.forEach((historyItem) => {
      const stepKey = historyItem.step.replace(/[^a-zA-Z0-9_]/g, '_');
      prompt = prompt.replace(
        new RegExp(`\\{\\{${stepKey}\\.output\\}\\}`, 'g'), 
        String(historyItem.output || '')
      );
    });
    
    return prompt;
  }
  
  private async executeAIStep(step: AgentStep, prompt: string): Promise<{
    content: string;
    tokens_used: { input_tokens: number; output_tokens: number };
    cost: number;
    latency_ms: number;
  }> {
    // This would integrate with the unified AI client
    // For now, return a realistic mock response
    const startTime = Date.now();
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 500));
    
    const inputTokens = Math.floor(prompt.length / 4); // Rough token estimate
    const outputTokens = Math.floor(Math.random() * 1000 + 100);
    
    return {
      content: `Generated response for step: ${step.name}\nAgent type: ${step.agent_type}\nPrompt length: ${prompt.length} chars`,
      tokens_used: {
        input_tokens: inputTokens,
        output_tokens: outputTokens
      },
      cost: this.calculateStepCost(step.model, inputTokens, outputTokens),
      latency_ms: Date.now() - startTime
    };
  }
  
  private calculateStepCost(model: string, inputTokens: number, outputTokens: number): number {
    // Basic cost calculation - would be more sophisticated in production
    const costPerInputToken = 0.00001; // $0.01 per 1K tokens
    const costPerOutputToken = 0.00003; // $0.03 per 1K tokens
    
    return (inputTokens * costPerInputToken) + (outputTokens * costPerOutputToken);
  }

  // Context passing between steps
  private async passContextToStep(
    fromStep: string,
    toStep: string,
    context: WorkflowContext
  ): Promise<WorkflowContext> {
    // Extract relevant context from previous step
    const previousResult = context.history.find(h => h.step === fromStep);
    
    if (previousResult) {
      // Add previous step output to current context
      context.metadata[`${fromStep}_output`] = previousResult.output;
    }

    return context;
  }

  // Dependency resolution
  private async resolveDependencies(
    stepId: string,
    workflow: WorkflowState
  ): Promise<boolean> {
    const step = workflow.steps.find(s => s.id === stepId);
    
    if (!step || !step.dependencies.length) {
      return true;
    }

    // Check if all dependencies are completed
    const completedSteps = workflow.context.history.map(h => h.step);
    
    return step.dependencies.every(dep => completedSteps.includes(dep));
  }

  // Backup and restore workflow state
  async backupWorkflowState(workflowId: string): Promise<void> {
    const workflow = await this.getWorkflowState(workflowId);
    
    if (workflow) {
      await this.supabase
        .from('workflow_backups')
        .insert({
          workflow_id: workflowId,
          state_snapshot: workflow,
          created_at: new Date().toISOString()
        });
    }
  }

  async restoreWorkflowState(workflowId: string, backupId?: string): Promise<void> {
    let backupQuery = this.supabase
      .from('workflow_backups')
      .select('*')
      .eq('workflow_id', workflowId);

    if (backupId) {
      backupQuery = backupQuery.eq('id', backupId);
    } else {
      backupQuery = backupQuery.order('created_at', { ascending: false }).limit(1);
    }

    const { data: backup } = await backupQuery.single();

    if (backup && backup.state_snapshot) {
      const restoredState = backup.state_snapshot as WorkflowState;
      this.activeWorkflows.set(workflowId, restoredState);
      
      // Update database with restored state
      await this.supabase
        .from('workflow_executions')
        .update({
          status: restoredState.status,
          current_step: restoredState.current_step,
          context: restoredState.context,
          progress: restoredState.progress,
          updated_at: new Date().toISOString()
        })
        .eq('id', workflowId);
    }
  }


} 