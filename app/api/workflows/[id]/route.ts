import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const sessionId = params.id;
    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    const { data: session, error } = await supabase
      .from('workflow_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Workflow session not found' }, { status: 404 });
      }
      return NextResponse.json({ error: 'Failed to retrieve workflow session' }, { status: 500 });
    }

    return NextResponse.json({ session });

  } catch (error) {
    console.error(`Workflow GET /api/workflows/${params.id} Error:`, error);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const sessionId = params.id;
    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    const { status, current_step_name } = await req.json();

    if (!status) {
      return NextResponse.json({ error: 'A new status is required' }, { status: 400 });
    }

    const updateData: { status: string; current_step_name?: string, completed_at?: string } = { status };
    if (current_step_name) {
      updateData.current_step_name = current_step_name;
    }
    if (status === 'cancelled' || status === 'failed' || status === 'completed') {
      updateData.completed_at = new Date().toISOString();
    }

    const { data: updatedSession, error: updateError } = await supabase
      .from('workflow_sessions')
      .update(updateData)
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: 'Failed to update workflow session' }, { status: 500 });
    }

    return NextResponse.json({ session: updatedSession });

  } catch (error) {
    console.error(`Workflow PATCH /api/workflows/${params.id} Error:`, error);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
} 