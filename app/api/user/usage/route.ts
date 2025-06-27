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
    const period = searchParams.get('period') || 'daily';
    const limit = parseInt(searchParams.get('limit') || '30');

    // Get usage summaries
    const { data: usageSummaries, error: summaryError } = await supabase
      .from('usage_summaries')
      .select('*')
      .eq('user_id', user.id)
      .eq('period_type', period)
      .order('period_start', { ascending: false })
      .limit(limit);

    if (summaryError) {
      return NextResponse.json({ error: 'Failed to load usage summaries' }, { status: 500 });
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

    // Get active alerts
    const { data: usageAlerts, error: alertsError } = await supabase
      .from('usage_alerts')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_resolved', false)
      .order('created_at', { ascending: false })
      .limit(10);

    if (alertsError) {
      console.error('Failed to load usage alerts:', alertsError);
    }

    return NextResponse.json({
      usageSummaries: usageSummaries || [],
      usageLimits,
      usageAlerts: usageAlerts || []
    });

  } catch (error) {
    console.error('Usage API Error:', error);
    return NextResponse.json({ 
      error: 'Failed to load usage data' 
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

    // Update usage limits
    const { data: updatedLimits, error: updateError } = await supabase
      .from('user_usage_limits')
      .upsert({
        user_id: user.id,
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: 'Failed to update usage limits' }, { status: 500 });
    }

    return NextResponse.json({ usageLimits: updatedLimits });

  } catch (error) {
    console.error('Usage Update API Error:', error);
    return NextResponse.json({ 
      error: 'Failed to update usage limits' 
    }, { status: 500 });
  }
} 