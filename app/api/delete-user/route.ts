import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  // First, authenticate the user with regular client
  const supabase = await createClient(); // Regular client for authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized - Please log in' }, { status: 401 });
  }

  const { userId } = await req.json();

  if (!userId) {
    return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
  }

  // Security check: Users can only delete their own account
  if (user.id !== userId) {
    return NextResponse.json({ error: 'Forbidden - You can only delete your own account' }, { status: 403 });
  }

  try {
    // Use service role for the actual deletion operations
    const adminSupabase = await createClient(true);

    // Begin comprehensive data cleanup
    console.log(`Starting comprehensive data cleanup for user: ${userId}`);

    // 1. Delete workflow sessions and related data
    const { error: workflowError } = await adminSupabase
      .from('workflow_sessions')
      .delete()
      .eq('user_id', userId);

    if (workflowError) {
      console.error('Failed to delete workflow sessions:', workflowError);
    }

    // 2. Delete user API keys (encrypted keys will be automatically removed)
    const { error: apiKeysError } = await adminSupabase
      .from('user_api_keys')
      .delete()
      .eq('user_id', userId);

    if (apiKeysError) {
      console.error('Failed to delete user API keys:', apiKeysError);
    }

    // 3. Delete user AI provider configurations
    const { error: providerConfigsError } = await adminSupabase
      .from('user_ai_provider_configs')
      .delete()
      .eq('user_id', userId);

    if (providerConfigsError) {
      console.error('Failed to delete provider configurations:', providerConfigsError);
    }

    // 4. Delete user usage data and summaries
    const { error: usageSummariesError } = await adminSupabase
      .from('usage_summaries')
      .delete()
      .eq('user_id', userId);

    if (usageSummariesError) {
      console.error('Failed to delete usage summaries:', usageSummariesError);
    }

    const { error: usageLimitsError } = await adminSupabase
      .from('user_usage_limits')
      .delete()
      .eq('user_id', userId);

    if (usageLimitsError) {
      console.error('Failed to delete usage limits:', usageLimitsError);
    }

    const { error: usageAlertsError } = await adminSupabase
      .from('usage_alerts')
      .delete()
      .eq('user_id', userId);

    if (usageAlertsError) {
      console.error('Failed to delete usage alerts:', usageAlertsError);
    }

    // 5. Delete user configuration
    const { error: userConfigError } = await adminSupabase
      .from('user_configuration')
      .delete()
      .eq('user_id', userId);

    if (userConfigError) {
      console.error('Failed to delete user configuration:', userConfigError);
    }

    // 6. Delete memory and context data
    const { error: memoryContextError } = await adminSupabase
      .from('memory_context')
      .delete()
      .eq('user_id', userId);

    if (memoryContextError) {
      console.error('Failed to delete memory context:', memoryContextError);
    }

    const { error: documentProcessingError } = await adminSupabase
      .from('document_processing')
      .delete()
      .eq('user_id', userId);

    if (documentProcessingError) {
      console.error('Failed to delete document processing data:', documentProcessingError);
    }

    // 7. Delete collaboration data
    const { error: teamMembersError } = await adminSupabase
      .from('team_members')
      .delete()
      .eq('user_id', userId);

    if (teamMembersError) {
      console.error('Failed to delete team memberships:', teamMembersError);
    }

    const { error: teamWorkspacesError } = await adminSupabase
      .from('team_workspaces')
      .delete()
      .eq('created_by', userId);

    if (teamWorkspacesError) {
      console.error('Failed to delete team workspaces:', teamWorkspacesError);
    }

    const { error: sharedResourcesError } = await adminSupabase
      .from('shared_resources')
      .delete()
      .eq('shared_by', userId);

    if (sharedResourcesError) {
      console.error('Failed to delete shared resources:', sharedResourcesError);
    }

    // 8. Delete billing and subscription data
    const { error: subscriptionsError } = await adminSupabase
      .from('user_subscriptions')
      .delete()
      .eq('user_id', userId);

    if (subscriptionsError) {
      console.error('Failed to delete user subscriptions:', subscriptionsError);
    }

    const { error: paymentMethodsError } = await adminSupabase
      .from('user_payment_methods')
      .delete()
      .eq('user_id', userId);

    if (paymentMethodsError) {
      console.error('Failed to delete payment methods:', paymentMethodsError);
    }

    const { error: billingAlertsError } = await adminSupabase
      .from('billing_alerts')
      .delete()
      .eq('user_id', userId);

    if (billingAlertsError) {
      console.error('Failed to delete billing alerts:', billingAlertsError);
    }

    // 9. Delete audit logs for the user
    const { error: auditLogsError } = await adminSupabase
      .from('audit_logs')
      .delete()
      .eq('user_id', userId);

    if (auditLogsError) {
      console.error('Failed to delete audit logs:', auditLogsError);
    }

    // 10. Delete user from the profiles table (this cascades to Stripe tables)
    const { error: profileError } = await adminSupabase
      .from('profiles')
      .delete()
      .eq('id', userId);

    if (profileError) {
      return NextResponse.json({ error: 'Failed to delete profile data' }, { status: 500 });
    }

    // 11. Finally, delete the user from Supabase Auth (requires service_role key)
    const { error: userError } = await adminSupabase.auth.admin.deleteUser(userId);

    if (userError) {
      return NextResponse.json({ error: 'Failed to delete user account' }, { status: 500 });
    }

    console.log(`Successfully completed comprehensive data cleanup for user: ${userId}`);

    return NextResponse.json({ 
      message: 'User account and all related data deleted successfully',
      details: {
        workflow_sessions: !workflowError,
        api_keys: !apiKeysError,
        provider_configs: !providerConfigsError,
        usage_data: !usageSummariesError && !usageLimitsError && !usageAlertsError,
        user_configuration: !userConfigError,
        memory_context: !memoryContextError && !documentProcessingError,
        collaboration_data: !teamMembersError && !teamWorkspacesError && !sharedResourcesError,
        billing_data: !subscriptionsError && !paymentMethodsError && !billingAlertsError,
        audit_logs: !auditLogsError,
        profile: !profileError,
        auth_user: !userError
      }
    }, { status: 200 });
    
  } catch (error) {
    console.error('Unexpected error during account deletion:', error);
    return NextResponse.json({ 
      error: 'An unexpected error occurred during account deletion',
      details: process.env.NODE_ENV === 'development' ? 
        (error instanceof Error ? error.message : 'Unknown error') : undefined
    }, { status: 500 });
  }
} 