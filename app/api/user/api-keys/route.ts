import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function GET() {
  const supabase = await createClient();
  
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: apiKeys, error: keysError } = await supabase
      .from('user_api_keys')
      .select(`
        *,
        ai_providers!inner(
          name,
          display_name,
          documentation_url
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (keysError) {
      return NextResponse.json({ error: 'Failed to load API keys' }, { status: 500 });
    }

    // Transform data to match frontend expectations
    const transformedKeys = apiKeys.map(key => ({
      id: key.id,
      user_id: key.user_id,
      provider_id: key.provider_id,
      provider_name: key.ai_providers.name,
      provider_display_name: key.ai_providers.display_name,
      key_name: key.key_name,
      key_hash: key.key_hash,
      custom_rate_limits: key.custom_rate_limits,
      daily_usage_limit: key.daily_usage_limit,
      monthly_usage_limit: key.monthly_usage_limit,
      is_active: key.is_active,
      is_verified: key.is_verified,
      verification_attempts: key.verification_attempts,
      last_verification_at: key.last_verification_at,
      last_used_at: key.last_used_at,
      usage_count: key.usage_count,
      total_cost_usd: key.total_cost_usd,
      total_tokens: key.total_tokens,
      expires_at: key.expires_at,
      auto_rotate_enabled: key.auto_rotate_enabled,
      usage_alerts_enabled: key.usage_alerts_enabled,
      created_at: key.created_at,
      updated_at: key.updated_at
    }));

    return NextResponse.json({ apiKeys: transformedKeys });

  } catch (error) {
    console.error('API Keys GET Error:', error);
    return NextResponse.json({ 
      error: 'Failed to load API keys' 
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

    // Expect the raw API key from the client
    const { provider_id, api_key, key_name, custom_rate_limits, daily_usage_limit, monthly_usage_limit, expires_at, auto_rotate_enabled, usage_alerts_enabled } = await req.json();

    if (!provider_id || !api_key) {
      return NextResponse.json({ error: 'Provider ID and API key are required' }, { status: 400 });
    }

    // The backend is responsible for all crypto operations.
    // 1. Hash the key for integrity checks.
    const keyHash = crypto.createHash('sha256').update(api_key).digest('hex');

    // 2. The database will handle encryption via a trigger or function.
    //    We just need to pass the raw key to the `api_key_to_encrypt` column.
    //    The database schema should have a trigger that populates `encrypted_api_key`.
    
    // Check if provider exists and is active
    const { data: provider, error: providerError } = await supabase
      .from('ai_providers')
      .select('id')
      .eq('id', provider_id)
      .eq('is_active', true)
      .single();

    if (providerError || !provider) {
      return NextResponse.json({ error: 'Invalid or inactive provider' }, { status: 400 });
    }

    // Insert new API key, providing the raw key to the temporary encryption column.
    const { data: newApiKey, error: insertError } = await supabase
      .from('user_api_keys')
      .insert({
        user_id: user.id,
        provider_id,
        key_name: key_name || null,
        key_hash: keyHash,
        // The raw key is sent to a column that a DB trigger will use for encryption.
        // The actual encrypted key will be stored in `encrypted_api_key`.
        // This temporary column should be configured to be nulled out by the trigger.
        api_key_to_encrypt: api_key, 
        custom_rate_limits: custom_rate_limits || null,
        daily_usage_limit: daily_usage_limit || null,
        monthly_usage_limit: monthly_usage_limit || null,
        expires_at: expires_at || null,
        auto_rotate_enabled: auto_rotate_enabled || false,
        usage_alerts_enabled: usage_alerts_enabled || true,
        is_active: true,
        is_verified: false, // Will be verified on first use
        verification_attempts: 0,
        usage_count: 0,
        total_cost_usd: 0,
        total_tokens: 0
      })
      .select()
      .single();

    if (insertError) {
      console.error("Insert Error:", insertError);
      // Check for specific error codes if needed, e.g., unique constraint violation
      if (insertError.code === '23505') { // unique_violation
          return NextResponse.json({ error: 'This API key may already exist.' }, { status: 409 });
      }
      return NextResponse.json({ error: 'Failed to save API key' }, { status: 500 });
    }

    return NextResponse.json({ 
      message: 'API key added successfully',
      apiKey: {
        id: newApiKey.id,
        provider_id: newApiKey.provider_id,
        key_name: newApiKey.key_name,
        is_active: newApiKey.is_active,
        created_at: newApiKey.created_at
      }
    });

  } catch (error) {
    console.error('API Keys POST Error:', error);
    return NextResponse.json({ 
      error: 'Failed to add API key' 
    }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const supabase = await createClient();
  
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const keyId = searchParams.get('id');

    if (!keyId) {
      return NextResponse.json({ error: 'API key ID is required' }, { status: 400 });
    }

    // Delete API key (only if it belongs to the user)
    const { error: deleteError } = await supabase
      .from('user_api_keys')
      .delete()
      .eq('id', keyId)
      .eq('user_id', user.id);

    if (deleteError) {
      return NextResponse.json({ error: 'Failed to delete API key' }, { status: 500 });
    }

    return NextResponse.json({ message: 'API key deleted successfully' });

  } catch (error) {
    console.error('API Keys DELETE Error:', error);
    return NextResponse.json({ 
      error: 'Failed to delete API key' 
    }, { status: 500 });
  }
} 