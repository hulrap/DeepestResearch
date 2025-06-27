import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = await createClient();
  
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all active AI providers
    const { data: providers, error: providersError } = await supabase
      .from('ai_providers')
      .select('*')
      .eq('is_active', true)
      .order('display_name');

    if (providersError) {
      return NextResponse.json({ error: 'Failed to load providers' }, { status: 500 });
    }

    // Get user's provider configurations
    const { data: userProviderConfigs, error: configsError } = await supabase
      .from('user_ai_provider_configs')
      .select('*')
      .eq('user_id', user.id)
      .order('user_priority', { ascending: false });

    if (configsError && configsError.code !== 'PGRST116') {
      console.error('Failed to load provider configs:', configsError);
    }

    // Get available models
    const { data: availableModels, error: modelsError } = await supabase
      .from('ai_models')
      .select('*')
      .eq('is_active', true)
      .eq('is_deprecated', false)
      .order('default_performance_score', { ascending: false });

    if (modelsError) {
      return NextResponse.json({ error: 'Failed to load models' }, { status: 500 });
    }

    return NextResponse.json({
      providers: providers || [],
      userProviderConfigs: userProviderConfigs || [],
      availableModels: availableModels || []
    });

  } catch (error) {
    console.error('Providers API Error:', error);
    return NextResponse.json({ 
      error: 'Failed to load provider data' 
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

    const configData = await req.json();
    const { provider_id, ...config } = configData;

    if (!provider_id) {
      return NextResponse.json({ error: 'Provider ID is required' }, { status: 400 });
    }

    // Upsert user provider configuration
    const { data: providerConfig, error: configError } = await supabase
      .from('user_ai_provider_configs')
      .upsert({
        user_id: user.id,
        provider_id,
        ...config,
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (configError) {
      return NextResponse.json({ error: 'Failed to save provider configuration' }, { status: 500 });
    }

    return NextResponse.json({ 
      message: 'Provider configuration saved successfully',
      config: providerConfig
    });

  } catch (error) {
    console.error('Provider Config API Error:', error);
    return NextResponse.json({ 
      error: 'Failed to save provider configuration' 
    }, { status: 500 });
  }
} 