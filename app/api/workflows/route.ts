import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const supabase = await createClient();
  
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') || 'all'; // 'active', 'templates', 'all'
    const limit = parseInt(searchParams.get('limit') || '20');

    const response: { activeWorkflows?: unknown[]; featuredTemplates?: unknown[]; allTemplates?: unknown[] } = {};

    // Get active workflows
    if (type === 'active' || type === 'all') {
      const { data: activeWorkflows, error: workflowsError } = await supabase
        .from('workflow_sessions')
        .select('*')
        .eq('user_id', user.id)
        .in('status', ['running', 'paused'])
        .order('last_activity_at', { ascending: false })
        .limit(limit);

      if (workflowsError) {
        return NextResponse.json({ error: 'Failed to load active workflows' }, { status: 500 });
      }

      response.activeWorkflows = activeWorkflows || [];
    }

    // Get featured templates
    if (type === 'templates' || type === 'all') {
      const { data: featuredTemplates, error: templatesError } = await supabase
        .from('workflow_templates')
        .select('*')
        .eq('is_public', true)
        .eq('is_featured', true)
        .eq('is_active', true)
        .order('rating', { ascending: false })
        .limit(limit);

      if (templatesError) {
        return NextResponse.json({ error: 'Failed to load workflow templates' }, { status: 500 });
      }

      response.featuredTemplates = featuredTemplates || [];
    }

    // Get all templates if requested
    if (type === 'all-templates') {
      const { data: allTemplates, error: allTemplatesError } = await supabase
        .from('workflow_templates')
        .select('*')
        .eq('is_public', true)
        .eq('is_active', true)
        .order('usage_count', { ascending: false })
        .limit(limit);

      if (allTemplatesError) {
        return NextResponse.json({ error: 'Failed to load all templates' }, { status: 500 });
      }

      response.allTemplates = allTemplates || [];
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error('Workflows API Error:', error);
    return NextResponse.json({ 
      error: 'Failed to load workflow data' 
    }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const supabase = await createClient();
  
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { template_id, model_id, initial_prompt } = await req.json();

    if (!template_id) {
      return NextResponse.json({ error: 'Workflow template ID is required' }, { status: 400 });
    }

    // Verify template exists and is active
    const { data: template, error: templateError } = await supabase
      .from('workflow_templates')
      .select('id, name, template_data')
      .eq('id', template_id)
      .eq('is_active', true)
      .single();

    if (templateError || !template) {
      return NextResponse.json({ error: 'Invalid or inactive workflow template' }, { status: 400 });
    }

    // Create a new workflow session
    const { data: newSession, error: insertError } = await supabase
      .from('workflow_sessions')
      .insert({
        user_id: user.id,
        template_id: template.id,
        status: 'pending',
        initial_prompt: initial_prompt || null,
        // The selected model could be stored here, e.g., in a 'configuration' jsonb column
        configuration: {
          selected_model_id: model_id || null,
        },
        // Extract total steps from template data if available
        total_steps: template.template_data?.steps?.length || 10, // Default fallback
      })
      .select()
      .single();

    if (insertError) {
      console.error('Workflow session insert error:', insertError);
      return NextResponse.json({ error: 'Failed to create workflow session' }, { status: 500 });
    }

    return NextResponse.json({ 
      message: 'Workflow session created successfully',
      session: newSession
    });

  } catch (error) {
    console.error('Workflows POST Error:', error);
    return NextResponse.json({ 
      error: 'Failed to create workflow' 
    }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const supabase = await createClient();
  
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, status, ...updateData } = await req.json();

    if (!id) {
      return NextResponse.json({ error: 'Workflow ID is required' }, { status: 400 });
    }

    // Update workflow (only if it belongs to the user)
    const { data: updatedWorkflow, error: updateError } = await supabase
      .from('workflow_sessions')
      .update({
        ...updateData,
        status,
        last_activity_at: new Date().toISOString(),
        ...(status === 'completed' && { completed_at: new Date().toISOString() }),
        ...(status === 'cancelled' && { cancelled_at: new Date().toISOString() })
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: 'Failed to update workflow' }, { status: 500 });
    }

    return NextResponse.json({ 
      message: 'Workflow updated successfully',
      workflow: updatedWorkflow
    });

  } catch (error) {
    console.error('Workflow Update API Error:', error);
    return NextResponse.json({ 
      error: 'Failed to update workflow' 
    }, { status: 500 });
  }
} 