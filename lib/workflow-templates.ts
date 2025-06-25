// Workflow Template Management System
import { createClient } from '@/lib/supabase/client';

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: 'research' | 'analysis' | 'writing' | 'coding' | 'business';
  difficulty_level: 'beginner' | 'intermediate' | 'advanced';
  estimated_duration_minutes: number;
  estimated_cost_range: { min: number; max: number };
  is_public: boolean;
  template_data: {
      steps: Record<string, unknown>[];
  variables: Record<string, unknown>[];
  };
  tags: string[];
  usage_count: number;
  rating: number;
}

export class WorkflowTemplateManager {
  private supabase = createClient();

  // Get public workflow templates
  async getPublicTemplates(
    category?: string,
    searchTerm?: string,
    limit: number = 20
  ): Promise<WorkflowTemplate[]> {
    let query = this.supabase
      .from('workflow_templates')
      .select('*')
      .eq('is_public', true)
      .order('usage_count', { ascending: false })
      .limit(limit);

    if (category) {
      query = query.eq('category', category);
    }

    if (searchTerm) {
      query = query.or(`name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch templates: ${error.message}`);
    }

    return data || [];
  }

  // Create a new workflow template
  async createTemplate(
    userId: string,
    template: Omit<WorkflowTemplate, 'id' | 'usage_count' | 'rating'>
  ): Promise<string> {
    const { data, error } = await this.supabase
      .from('workflow_templates')
      .insert({
        ...template,
        created_by: userId,
        usage_count: 0,
        rating: 0,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create template: ${error.message}`);
    }

    return data.id;
  }

  // Clone a template
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
      created_at: new Date().toISOString()
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

  // Create workflow session from template
  async createWorkflowFromTemplate(
    templateId: string,
    userId: string,
    title: string,
    variables?: Record<string, unknown>
  ): Promise<string> {
    // Create a workflow session
    const { data: session, error } = await this.supabase
      .from('workflow_sessions')
      .insert({
        user_id: userId,
        template_id: templateId,
        title: title,
        status: 'pending',
        current_step: 0,
        total_steps: 3, // Default for research workflow
        progress_percentage: 0,
        execution_state: variables || {},
        estimated_total_cost: 0.05 // Default estimate
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create workflow session: ${error.message}`);
    }

         // Increment template usage (simplified approach)
     const { data: template } = await this.supabase
       .from('workflow_templates')
       .select('usage_count')
       .eq('id', templateId)
       .single();
     
     if (template) {
       await this.supabase
         .from('workflow_templates')
         .update({ usage_count: (template.usage_count || 0) + 1 })
         .eq('id', templateId);
     }

    return session.id;
  }

  // Get featured templates
  async getFeaturedTemplates(): Promise<WorkflowTemplate[]> {
    const { data, error } = await this.supabase
      .from('workflow_templates')
      .select('*')
      .eq('is_public', true)
      .order('rating', { ascending: false })
      .order('usage_count', { ascending: false })
      .limit(6);

    if (error) {
      throw new Error(`Failed to fetch featured templates: ${error.message}`);
    }

    return data || [];
  }
} 