import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = await createClient();
  
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile with all related data
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError) {
      return NextResponse.json({ error: 'Failed to load profile' }, { status: 500 });
    }

    // Get user configuration
    const { data: userConfiguration, error: configError } = await supabase
      .from('user_configuration')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (configError && configError.code !== 'PGRST116') {
      console.error('Failed to load user configuration:', configError);
    }

    // Get usage limits
    const { data: usageLimits, error: limitsError } = await supabase
      .from('user_usage_limits')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (limitsError && limitsError.code !== 'PGRST116') {
      console.error('Failed to load usage limits:', limitsError);
    }

    // Get current subscription
    const { data: subscription, error: subError } = await supabase
      .from('user_subscriptions')
      .select(`
        *,
        subscription_plans(*)
      `)
      .eq('user_id', user.id)
      .in('status', ['active', 'trialing'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subError && subError.code !== 'PGRST116') {
      console.error('Failed to load subscription:', subError);
    }

    return NextResponse.json({
      profile,
      userConfiguration,
      usageLimits,
      subscription
    });

  } catch (error) {
    console.error('Profile API Error:', error);
    return NextResponse.json({ 
      error: 'Failed to load profile data' 
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

    // Update profile
    const { data: updatedProfile, error: updateError } = await supabase
      .from('profiles')
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
    }

    return NextResponse.json({ profile: updatedProfile });

  } catch (error) {
    console.error('Profile Update API Error:', error);
    return NextResponse.json({ 
      error: 'Failed to update profile' 
    }, { status: 500 });
  }
} 