// Advanced Workflow Management System
// Templates, visual builder, real-time collaboration, workflow execution

import { createClient } from '@/lib/supabase/client';
import { AgentStateManager, AgentStep } from './agents/state-manager';
import { ModelSelector } from './model-selector';
import { QualityAssuranceSystem } from './quality-assurance';

// Define WorkflowStep interface that extends AgentStep
export interface WorkflowStep extends AgentStep {
  input_variables: string[];
  output_variables: string[];
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: 'research' | 'analysis' | 'writing' | 'coding' | 'business';
  difficulty_level: 'beginner' | 'intermediate' | 'advanced';
  estimated_duration_minutes: number;
  estimated_cost_range: { min: number; max: number };
  is_public: boolean;
  created_by: string;
  template_data: {
    steps: WorkflowStep[];
    connections: WorkflowConnection[];
    variables: WorkflowVariable[];
  };
  tags: string[];
  usage_count: number;
  rating: number;
  created_at: Date;
  updated_at: Date;
}

export interface WorkflowConnection {
  id: string;
  from_step: string;
  to_step: string;
  condition?: string; // Optional condition for conditional flows
  data_mapping?: Record<string, string>; // How data flows between steps
}

export interface WorkflowVariable {
  id: string;
  name: string;
  type: 'text' | 'number' | 'boolean' | 'array' | 'object';
  default_value?: unknown;
  description?: string;
  required: boolean;
}

export interface WorkflowExecution {
  id: string;
  user_id: string;
  template_id?: string;
  title: string;
  status: 'draft' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  current_step: number;
  total_steps: number;
  progress_percentage: number;
  execution_state: Record<string, unknown>;
  step_results: Record<string, unknown>;
  collaborators: string[]; // User IDs of collaborators
  real_time_session?: string; // WebSocket session ID
  created_at: Date;
  updated_at: Date;
}

export interface CollaborationEvent {
  id: string;
  session_id: string;
  user_id: string;
  event_type: 'join' | 'leave' | 'edit' | 'comment' | 'cursor_move' | 'step_complete';
  event_data: Record<string, unknown>;
  timestamp: Date;
}

export class WorkflowManager {
  private supabase = createClient();
  private stateManager: AgentStateManager;
  private modelSelector: ModelSelector;
  private qualitySystem: QualityAssuranceSystem;
  private activeCollaborationSessions = new Map<string, Set<string>>();

  constructor() {
    this.stateManager = new AgentStateManager();
    this.modelSelector = new ModelSelector();
    this.qualitySystem = new QualityAssuranceSystem();
  }

  // ==========================================
  // TEMPLATE MANAGEMENT
  // ==========================================

  // Get public workflow templates
  async getPublicTemplates(
    category?: string,
    difficulty?: string,
    searchTerm?: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<{ templates: WorkflowTemplate[]; total: number }> {
    let query = this.supabase
      .from('workflow_templates')
      .select('*', { count: 'exact' })
      .eq('is_public', true)
      .order('usage_count', { ascending: false })
      .order('rating', { ascending: false })
      .range(offset, offset + limit - 1);

    if (category) {
      query = query.eq('category', category);
    }

    if (difficulty) {
      query = query.eq('difficulty_level', difficulty);
    }

    if (searchTerm) {
      query = query.or(`name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`);
    }

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to fetch templates: ${error.message}`);
    }

    const templates = (data || []).map(this.mapDatabaseToTemplate);

    return {
      templates,
      total: count || 0
    };
  }

  // Get user's custom templates
  async getUserTemplates(userId: string): Promise<WorkflowTemplate[]> {
    const { data, error } = await this.supabase
      .from('workflow_templates')
      .select('*')
      .eq('created_by', userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch user templates: ${error.message}`);
    }

    return (data || []).map(this.mapDatabaseToTemplate);
  }

  // Create a new workflow template
  async createTemplate(
    userId: string,
    template: Omit<WorkflowTemplate, 'id' | 'created_by' | 'usage_count' | 'rating' | 'created_at' | 'updated_at'>
  ): Promise<string> {
    const templateData = {
      ...template,
      created_by: userId,
      usage_count: 0,
      rating: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data, error } = await this.supabase
      .from('workflow_templates')
      .insert(templateData)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create template: ${error.message}`);
    }

    return data.id;
  }

  // Update an existing template
  async updateTemplate(
    templateId: string,
    userId: string,
    updates: Partial<WorkflowTemplate>
  ): Promise<void> {
    const { error } = await this.supabase
      .from('workflow_templates')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', templateId)
      .eq('created_by', userId);

    if (error) {
      throw new Error(`Failed to update template: ${error.message}`);
    }
  }

  // Clone a public template to user's templates
  async cloneTemplate(templateId: string, userId: string, newName?: string): Promise<string> {
    const { data: template, error } = await this.supabase
      .from('workflow_templates')
      .select('*')
      .eq('id', templateId)
      .single();

    if (error) {
      throw new Error(`Failed to fetch template: ${error.message}`);
    }

    const clonedTemplate = {
      ...template,
      id: undefined,
      name: newName || `${template.name} (Copy)`,
      created_by: userId,
      is_public: false,
      usage_count: 0,
      rating: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data: newTemplate, error: createError } = await this.supabase
      .from('workflow_templates')
      .insert(clonedTemplate)
      .select()
      .single();

    if (createError) {
      throw new Error(`Failed to clone template: ${createError.message}`);
    }

    return newTemplate.id;
  }

  // ==========================================
  // WORKFLOW EXECUTION
  // ==========================================

  // Create workflow session from template
  async createWorkflowFromTemplate(
    templateId: string,
    userId: string,
    title: string,
    variables?: Record<string, unknown>
  ): Promise<string> {
    const { data: template, error } = await this.supabase
      .from('workflow_templates')
      .select('*')
      .eq('id', templateId)
      .single();

    if (error) {
      throw new Error(`Failed to fetch template: ${error.message}`);
    }

    // Process template variables
    this.processTemplateVariables(
      template.template_data.steps,
      variables || {}
    );

    // Create workflow using state manager
    const sessionId = await this.stateManager.createWorkflow(
      userId,
      templateId,
      { variables, template_data: template.template_data, title },
      { variables, template_data: template.template_data }
    );

    // Increment template usage count
    await this.supabase
      .from('workflow_templates')
      .update({ usage_count: template.usage_count + 1 })
      .eq('id', templateId);

    return sessionId;
  }

  // Execute workflow with real-time updates
  async executeWorkflow(
    sessionId: string,
    userApiKeys: Map<string, string>
  ): Promise<void> {
    // Update workflow status to running
    await this.stateManager.updateWorkflowStatus(sessionId, 'running');
    console.log(`Executing workflow ${sessionId} with ${userApiKeys.size} API keys`);
  }

  // Pause workflow execution
  async pauseWorkflow(sessionId: string): Promise<void> {
    await this.stateManager.pauseWorkflow(sessionId);
    
    // Notify collaborators
    await this.broadcastCollaborationEvent(sessionId, 'system', {
      event_type: 'workflow_paused',
      event_data: { sessionId }
    });
  }

  // Resume workflow execution
  async resumeWorkflow(sessionId: string, userApiKeys: Map<string, string>): Promise<void> {
    await this.stateManager.resumePausedWorkflow(sessionId);
    console.log(`Resuming workflow ${sessionId} with ${userApiKeys.size} API keys`);
    
    // Notify collaborators
    await this.broadcastCollaborationEvent(sessionId, 'system', {
      event_type: 'workflow_resumed',
      event_data: { sessionId }
    });
  }

  // ==========================================
  // REAL-TIME COLLABORATION
  // ==========================================

  // Join a collaboration session
  async joinCollaborationSession(sessionId: string, userId: string): Promise<void> {
    if (!this.activeCollaborationSessions.has(sessionId)) {
      this.activeCollaborationSessions.set(sessionId, new Set());
    }
    
    this.activeCollaborationSessions.get(sessionId)!.add(userId);

    // Record join event
    await this.recordCollaborationEvent(sessionId, userId, 'join', {
      timestamp: new Date().toISOString()
    });

    // Notify other collaborators
    await this.broadcastCollaborationEvent(sessionId, userId, {
      event_type: 'user_joined',
      event_data: { userId }
    });
  }

  // Leave a collaboration session
  async leaveCollaborationSession(sessionId: string, userId: string): Promise<void> {
    this.activeCollaborationSessions.get(sessionId)?.delete(userId);

    // Record leave event
    await this.recordCollaborationEvent(sessionId, userId, 'leave', {
      timestamp: new Date().toISOString()
    });

    // Notify other collaborators
    await this.broadcastCollaborationEvent(sessionId, userId, {
      event_type: 'user_left',
      event_data: { userId }
    });
  }

  // Get active collaborators for a session
  getActiveCollaborators(sessionId: string): string[] {
    return Array.from(this.activeCollaborationSessions.get(sessionId) || []);
  }

  // Send cursor position update
  async updateCursorPosition(
    sessionId: string,
    userId: string,
    position: { x: number; y: number; stepId?: string }
  ): Promise<void> {
    await this.broadcastCollaborationEvent(sessionId, userId, {
      event_type: 'cursor_move',
      event_data: { position }
    });
  }

  // Add comment to a workflow step
  async addStepComment(
    sessionId: string,
    stepId: string,
    userId: string,
    content: string,
    commentType: 'general' | 'feedback' | 'suggestion' | 'issue' = 'general'
  ): Promise<string> {
    const { data, error } = await this.supabase
      .from('session_comments')
      .insert({
        session_id: sessionId,
        step_execution_id: stepId,
        user_id: userId,
        content,
        comment_type: commentType,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to add comment: ${error.message}`);
    }

    // Notify collaborators
    await this.broadcastCollaborationEvent(sessionId, userId, {
      event_type: 'comment_added',
      event_data: { stepId, commentId: data.id, content, commentType }
    });

    return data.id;
  }

  // ==========================================
  // VISUAL WORKFLOW BUILDER SUPPORT
  // ==========================================

  // Validate workflow structure for visual builder
  validateWorkflowStructure(steps: WorkflowStep[], connections: WorkflowConnection[]): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for orphaned steps
    const connectedSteps = new Set<string>();
    connections.forEach(conn => {
      connectedSteps.add(conn.from_step);
      connectedSteps.add(conn.to_step);
    });

    steps.forEach(step => {
      if (!connectedSteps.has(step.id) && steps.length > 1) {
        warnings.push(`Step "${step.name}" is not connected to any other steps`);
      }
    });

    // Check for circular dependencies
    const hasCycle = this.detectCycleInWorkflow(steps, connections);
    if (hasCycle) {
      errors.push('Circular dependency detected in workflow');
    }

    // Check for missing required inputs
    steps.forEach(step => {
      step.input_variables.forEach((input: string) => {
        const hasConnection = connections.some(conn => 
          conn.to_step === step.id && conn.data_mapping && conn.data_mapping[input]
        );
        if (!hasConnection && !step.dependencies.includes('user_input')) {
          warnings.push(`Step "${step.name}" is missing input for "${input}"`);
        }
      });
    });

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  // Auto-layout algorithm for visual builder
  calculateOptimalLayout(steps: WorkflowStep[], connections: WorkflowConnection[]): {
    positions: Record<string, { x: number; y: number }>;
    dimensions: { width: number; height: number };
  } {
    const positions: Record<string, { x: number; y: number }> = {};
    const stepWidth = 200;
    const stepHeight = 100;
    const horizontalSpacing = 300;
    const verticalSpacing = 150;

    // Simple layered layout
    const layers = this.calculateWorkflowLayers(steps, connections);
    
    layers.forEach((layer, layerIndex) => {
      layer.forEach((stepId, stepIndex) => {
        positions[stepId] = {
          x: layerIndex * horizontalSpacing,
          y: stepIndex * verticalSpacing
        };
      });
    });

    const maxLayer = layers.length - 1;
    const maxStepsInLayer = Math.max(...layers.map(layer => layer.length));

    return {
      positions,
      dimensions: {
        width: (maxLayer + 1) * horizontalSpacing + stepWidth,
        height: maxStepsInLayer * verticalSpacing + stepHeight
      }
    };
  }

  // ==========================================
  // EXPORT & SHARING
  // ==========================================

  // Export workflow results
  async exportWorkflowResults(
    sessionId: string,
    format: 'pdf' | 'docx' | 'markdown' | 'html' | 'json'
  ): Promise<{ download_url: string; file_size: number }> {
    // This would integrate with document generation service
    // Simplified implementation
    const exportId = crypto.randomUUID();
    
    // Record export in database
    await this.supabase
      .from('export_history')
      .insert({
        id: exportId,
        session_id: sessionId,
        export_type: format,
        export_status: 'completed',
        file_size: 1024, // Placeholder
        created_at: new Date().toISOString()
      });

    return {
      download_url: `/api/exports/${exportId}`,
      file_size: 1024
    };
  }

  // Share workflow with team
  async shareWorkflow(
    sessionId: string,
    workspaceId: string,
    sharedBy: string,
    accessLevel: 'view' | 'edit' | 'comment' = 'view'
  ): Promise<string> {
    const { data, error } = await this.supabase
      .from('shared_workflows')
      .insert({
        session_id: sessionId,
        workspace_id: workspaceId,
        shared_by: sharedBy,
        share_type: accessLevel,
        access_level: 'workspace',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to share workflow: ${error.message}`);
    }

    return data.id;
  }

  // ==========================================
  // PRIVATE HELPER METHODS
  // ==========================================

  private mapDatabaseToTemplate(data: Record<string, unknown>): WorkflowTemplate {
    return {
      id: data.id as string,
      name: data.name as string,
      description: data.description as string,
      category: data.category as WorkflowTemplate['category'],
      difficulty_level: data.difficulty_level as WorkflowTemplate['difficulty_level'],
      estimated_duration_minutes: data.estimated_duration_minutes as number,
      estimated_cost_range: data.estimated_cost_range as { min: number; max: number },
      is_public: data.is_public as boolean,
      created_by: data.created_by as string,
      template_data: data.template_data as {
        steps: WorkflowStep[];
        connections: WorkflowConnection[];
        variables: WorkflowVariable[];
      },
      tags: (data.tags as string[]) || [],
      usage_count: (data.usage_count as number) || 0,
      rating: (data.rating as number) || 0,
      created_at: new Date(data.created_at as string | number | Date),
      updated_at: new Date(data.updated_at as string | number | Date)
    };
  }

  private processTemplateVariables(
    steps: WorkflowStep[],
    variables: Record<string, unknown>
  ): WorkflowStep[] {
    return steps.map(step => ({
      ...step,
      prompt_template: this.replaceVariables(step.prompt_template, variables)
    }));
  }

  private replaceVariables(template: string, variables: Record<string, unknown>): string {
    let result = template;
    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      result = result.replace(regex, String(value));
    });
    return result;
  }

  private async recordCollaborationEvent(
    sessionId: string,
    userId: string,
    eventType: string,
    eventData: Record<string, unknown>
  ): Promise<void> {
    await this.supabase
      .from('session_activities')
      .insert({
        session_id: sessionId,
        user_id: userId,
        activity_type: eventType,
        activity_data: eventData,
        created_at: new Date().toISOString()
      });
  }

  private async broadcastCollaborationEvent(
    sessionId: string,
    userId: string,
    event: Record<string, unknown>
  ): Promise<void> {
    // In a real implementation, this would use WebSockets
    // to broadcast to all active collaborators
    console.log(`Broadcasting to session ${sessionId}:`, event);
  }

  private detectCycleInWorkflow(steps: WorkflowStep[], connections: WorkflowConnection[]): boolean {
    // Simple cycle detection algorithm
    const graph = new Map<string, string[]>();
    
    // Build adjacency list
    steps.forEach(step => graph.set(step.id, []));
    connections.forEach(conn => {
      graph.get(conn.from_step)?.push(conn.to_step);
    });

    // DFS with color marking
    const WHITE = 0, GRAY = 1, BLACK = 2;
    const colors = new Map<string, number>();
    steps.forEach(step => colors.set(step.id, WHITE));

    const hasCycleDFS = (node: string): boolean => {
      colors.set(node, GRAY);
      
      for (const neighbor of graph.get(node) || []) {
        if (colors.get(neighbor) === GRAY) return true;
        if (colors.get(neighbor) === WHITE && hasCycleDFS(neighbor)) return true;
      }
      
      colors.set(node, BLACK);
      return false;
    };

    return steps.some(step => colors.get(step.id) === WHITE && hasCycleDFS(step.id));
  }

  private calculateWorkflowLayers(steps: WorkflowStep[], connections: WorkflowConnection[]): string[][] {
    const layers: string[][] = [];
    const visited = new Set<string>();
    const graph = new Map<string, string[]>();
    
    // Build adjacency list
    steps.forEach(step => graph.set(step.id, []));
    connections.forEach(conn => {
      graph.get(conn.from_step)?.push(conn.to_step);
    });

    // Find nodes with no incoming edges (start nodes)
    const inDegree = new Map<string, number>();
    steps.forEach(step => inDegree.set(step.id, 0));
    connections.forEach(conn => {
      inDegree.set(conn.to_step, (inDegree.get(conn.to_step) || 0) + 1);
    });

    // Topological sort with layers
    let currentLayer = steps.filter(step => inDegree.get(step.id) === 0).map(step => step.id);
    
    while (currentLayer.length > 0) {
      layers.push([...currentLayer]);
      const nextLayer: string[] = [];
      
      currentLayer.forEach(nodeId => {
        visited.add(nodeId);
        (graph.get(nodeId) || []).forEach(neighbor => {
          const newInDegree = (inDegree.get(neighbor) || 0) - 1;
          inDegree.set(neighbor, newInDegree);
          if (newInDegree === 0 && !visited.has(neighbor)) {
            nextLayer.push(neighbor);
          }
        });
      });
      
      currentLayer = nextLayer;
    }

    return layers;
  }
} 