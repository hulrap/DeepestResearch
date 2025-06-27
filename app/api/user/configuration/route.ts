import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = await createClient();
  
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userConfiguration, error: configError } = await supabase
      .from('user_configuration')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (configError && configError.code !== 'PGRST116') {
      return NextResponse.json({ error: 'Failed to load configuration' }, { status: 500 });
    }

    return NextResponse.json({ userConfiguration });

  } catch (error) {
    console.error('Configuration API Error:', error);
    return NextResponse.json({ 
      error: 'Failed to load configuration' 
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

    const updateData = await req.json();

    // Upsert user configuration
    const { data: updatedConfig, error: updateError } = await supabase
      .from('user_configuration')
      .upsert({
        user_id: user.id,
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: 'Failed to update configuration' }, { status: 500 });
    }

    return NextResponse.json({ userConfiguration: updatedConfig });

  } catch (error) {
    console.error('Configuration Update API Error:', error);
    return NextResponse.json({ 
      error: 'Failed to update configuration' 
    }, { status: 500 });
  }
} 