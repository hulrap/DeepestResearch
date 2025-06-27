'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { 
  UserProfile, 
  UserConfiguration,
  AIProvider,
  UserAIProviderConfig,
  AIModel,
  UserAPIKey, 
  UsageLimits, 
  UsageSummary,
  UsageAlert,
  SubscriptionPlan,
  UserSubscription,
  WorkflowTemplate,
  WorkflowSession,
  ProfileUpdateData,
  UserConfigurationUpdateData,
  APIKeyCreateData,
  UsageLimitsUpdateData
} from './types';

interface UseSettingsReturn {
  // Profile data
  profile: UserProfile | null;
  userConfiguration: UserConfiguration | null;
  isLoading: boolean;
  error: string | null;
  
  // AI Providers and Models
  providers: AIProvider[];
  userProviderConfigs: UserAIProviderConfig[];
  availableModels: AIModel[];
  userAPIKeys: UserAPIKey[];
  providersLoading: boolean;
  
  // Usage and limits
  usageLimits: UsageLimits | null;
  recentUsage: UsageSummary[];
  usageAlerts: UsageAlert[];
  usageLoading: boolean;
  
  // Billing and subscriptions
  currentSubscription: UserSubscription | null;
  availablePlans: SubscriptionPlan[];
  billingLoading: boolean;
  
  // Workflows
  featuredTemplates: WorkflowTemplate[];
  activeWorkflows: WorkflowSession[];
  workflowsLoading: boolean;
  
  // Actions
  updateProfile: (data: ProfileUpdateData) => Promise<void>;
  updateUserConfiguration: (data: UserConfigurationUpdateData) => Promise<void>;
  addAPIKey: (data: APIKeyCreateData) => Promise<void>;
  removeAPIKey: (keyId: string) => Promise<void>;
  updateUsageLimits: (data: UsageLimitsUpdateData) => Promise<void>;
  updateProviderConfig: (providerId: string, config: Partial<UserAIProviderConfig>) => Promise<void>;
  dismissAlert: (alertId: string) => Promise<void>;
  
  // Refresh functions
  refreshAll: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshProviders: () => Promise<void>;
  refreshUsageData: () => Promise<void>;
  refreshBillingData: () => Promise<void>;
  refreshWorkflows: () => Promise<void>;
}

export function useSettings(): UseSettingsReturn {
  // Core state
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [userConfiguration, setUserConfiguration] = useState<UserConfiguration | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // AI providers and models
  const [providers, setProviders] = useState<AIProvider[]>([]);
  const [userProviderConfigs, setUserProviderConfigs] = useState<UserAIProviderConfig[]>([]);
  const [availableModels, setAvailableModels] = useState<AIModel[]>([]);
  const [userAPIKeys, setUserAPIKeys] = useState<UserAPIKey[]>([]);
  const [providersLoading, setProvidersLoading] = useState(false);
  
  // Usage tracking
  const [usageLimits, setUsageLimits] = useState<UsageLimits | null>(null);
  const [recentUsage, setRecentUsage] = useState<UsageSummary[]>([]);
  const [usageAlerts, setUsageAlerts] = useState<UsageAlert[]>([]);
  const [usageLoading, setUsageLoading] = useState(false);
  
  // Billing
  const [currentSubscription, setCurrentSubscription] = useState<UserSubscription | null>(null);
  const [availablePlans, setAvailablePlans] = useState<SubscriptionPlan[]>([]);
  const [billingLoading, setBillingLoading] = useState(false);
  
  // Workflows
  const [featuredTemplates, setFeaturedTemplates] = useState<WorkflowTemplate[]>([]);
  const [activeWorkflows, setActiveWorkflows] = useState<WorkflowSession[]>([]);
  const [workflowsLoading, setWorkflowsLoading] = useState(false);

  const supabase = createClient();

  // Load user profile and configuration
  const loadProfile = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        setProfile(null);
        setUserConfiguration(null);
        return;
      }

      // Load profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileError) {
        if (profileError.code === 'PGRST116') {
          // Profile doesn't exist, create it
          const { data: newProfile, error: createError } = await supabase
            .from('profiles')
            .insert({
              id: user.id,
              email: user.email,
              is_active: true,
              email_verified: !!user.email_confirmed_at,
              onboarding_completed: false,
              onboarding_step: 0,
            })
            .select()
            .single();

          if (createError) {
            throw new Error('Failed to create profile');
          }

          setProfile(newProfile);
        } else {
          throw new Error('Failed to load profile');
        }
      } else {
        setProfile(profileData);
      }

      // Load user configuration
      const { data: configData, error: configError } = await supabase
        .from('user_configuration')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (configError && configError.code !== 'PGRST116') {
        console.error('Failed to load user configuration:', configError);
      } else {
        setUserConfiguration(configData);
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  // Load AI providers and user configurations
  const loadProviders = useCallback(async () => {
    if (!profile?.id) return;

    try {
      setProvidersLoading(true);
      
      // Load all active providers
      const { data: providersData, error: providersError } = await supabase
        .from('ai_providers')
        .select('*')
        .eq('is_active', true)
        .order('display_name');

      if (providersError) {
        throw new Error('Failed to load AI providers');
      }

      setProviders(providersData || []);

      // Load user's provider configurations
      const { data: userConfigsData, error: userConfigsError } = await supabase
        .from('user_ai_provider_configs')
        .select('*')
        .eq('user_id', profile.id)
        .order('user_priority', { ascending: false });

      if (userConfigsError && userConfigsError.code !== 'PGRST116') {
        throw new Error('Failed to load provider configurations');
      }

      setUserProviderConfigs(userConfigsData || []);

      // Load available models with provider name
      const { data: modelsData, error: modelsError } = await supabase
        .from('ai_models')
        .select(`
          *,
          ai_providers (
            name
          )
        `)
        .eq('is_active', true)
        .eq('is_deprecated', false)
        .order('default_performance_score', { ascending: false });

      if (modelsError) {
        throw new Error('Failed to load AI models');
      }
      
      const transformedModels = (modelsData || []).map(model => ({
        ...model,
        provider_name: model.ai_providers.name
      }));

      setAvailableModels(transformedModels);

    } catch (err) {
      console.error('Error loading providers:', err);
    } finally {
      setProvidersLoading(false);
    }
  }, [profile?.id, supabase]);

  // Load user's API keys
  const loadAPIKeys = useCallback(async () => {
    if (!profile?.id) return;

    try {
      const { data: keysData, error: keysError } = await supabase
        .from('user_api_keys')
        .select(`
          *,
          ai_providers!inner(
            name,
            display_name
          )
        `)
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false });

      if (keysError) {
        throw new Error('Failed to load API keys');
      }

      // Transform the joined data
      const transformedKeys: UserAPIKey[] = (keysData || []).map(key => ({
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
        updated_at: key.updated_at,
      }));

      setUserAPIKeys(transformedKeys);
    } catch (err) {
      console.error('Error loading API keys:', err);
    }
  }, [profile?.id, supabase]);

  // Load usage data
  const loadUsageData = useCallback(async () => {
    if (!profile?.id) return;

    try {
      setUsageLoading(true);
      
      // Load usage limits
      const { data: limitsData, error: limitsError } = await supabase
        .from('user_usage_limits')
        .select('*')
        .eq('user_id', profile.id)
        .single();

      if (limitsError && limitsError.code !== 'PGRST116') {
        throw new Error('Failed to load usage limits');
      }

      setUsageLimits(limitsData || null);

      // Load recent usage summaries (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: summaryData, error: summaryError } = await supabase
        .from('usage_summaries')
        .select('*')
        .eq('user_id', profile.id)
        .eq('period_type', 'daily')
        .gte('period_start', thirtyDaysAgo.toISOString())
        .order('period_start', { ascending: false });

      if (summaryError) {
        throw new Error('Failed to load usage summary');
      }

      setRecentUsage(summaryData || []);

      // Load active usage alerts
      const { data: alertsData, error: alertsError } = await supabase
        .from('usage_alerts')
        .select('*')
        .eq('user_id', profile.id)
        .eq('is_resolved', false)
        .order('created_at', { ascending: false })
        .limit(10);

      if (alertsError) {
        throw new Error('Failed to load usage alerts');
      }

      setUsageAlerts(alertsData || []);

    } catch (err) {
      console.error('Error loading usage data:', err);
    } finally {
      setUsageLoading(false);
    }
  }, [profile?.id, supabase]);

  // Load billing data
  const loadBillingData = useCallback(async () => {
    if (!profile?.id) return;

    try {
      setBillingLoading(true);
      
      // Load current subscription
      const { data: subscriptionData, error: subError } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', profile.id)
        .in('status', ['active', 'trialing'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (subError && subError.code !== 'PGRST116') {
        throw new Error('Failed to load subscription');
      }

      setCurrentSubscription(subscriptionData);

      // Load available plans
      const { data: plansData, error: plansError } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');

      if (plansError) {
        throw new Error('Failed to load subscription plans');
      }

      setAvailablePlans(plansData || []);

    } catch (err) {
      console.error('Error loading billing data:', err);
    } finally {
      setBillingLoading(false);
    }
  }, [profile?.id, supabase]);

  // Load workflow data
  const loadWorkflows = useCallback(async () => {
    if (!profile?.id) return;

    try {
      setWorkflowsLoading(true);
      
      // Load featured templates
      const { data: templatesData, error: templatesError } = await supabase
        .from('workflow_templates')
        .select('*')
        .eq('is_public', true)
        .eq('is_featured', true)
        .eq('is_active', true)
        .order('rating', { ascending: false })
        .limit(6);

      if (templatesError) {
        throw new Error('Failed to load workflow templates');
      }

      setFeaturedTemplates(templatesData || []);

      // Load active workflows
      const { data: workflowsData, error: workflowsError } = await supabase
        .from('workflow_sessions')
        .select('*')
        .eq('user_id', profile.id)
        .in('status', ['running', 'paused'])
        .order('last_activity_at', { ascending: false })
        .limit(5);

      if (workflowsError) {
        throw new Error('Failed to load active workflows');
      }

      setActiveWorkflows(workflowsData || []);

    } catch (err) {
      console.error('Error loading workflow data:', err);
    } finally {
      setWorkflowsLoading(false);
    }
  }, [profile?.id, supabase]);

  // Update profile
  const updateProfile = useCallback(async (data: ProfileUpdateData) => {
    if (!profile?.id) {
      throw new Error('No profile loaded');
    }

    try {
      setError(null);
      
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          ...data,
          updated_at: new Date().toISOString(),
        })
        .eq('id', profile.id);

      if (updateError) {
        throw new Error('Failed to update profile');
      }

      // Update local state
      setProfile(prev => prev ? {
        ...prev,
        ...data,
        updated_at: new Date().toISOString(),
      } : null);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update profile';
      setError(errorMessage);
      throw err;
    }
  }, [profile?.id, supabase]);

  // Update user configuration
  const updateUserConfiguration = useCallback(async (data: UserConfigurationUpdateData) => {
    if (!profile?.id) {
      throw new Error('No profile loaded');
    }

    try {
      setError(null);

      const { data: upsertData, error: upsertError } = await supabase
        .from('user_configuration')
        .upsert({
          user_id: profile.id,
          ...data,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (upsertError) {
        throw new Error('Failed to update user configuration');
      }

      setUserConfiguration(upsertData);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update configuration';
      setError(errorMessage);
      throw err;
    }
  }, [profile?.id, supabase]);

  // Add API key
  const addAPIKey = useCallback(async (data: APIKeyCreateData) => {
    if (!profile?.id) {
      throw new Error('No profile loaded');
    }

    try {
      setError(null);

      const response = await fetch('/api/user/api-keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add API key');
      }

      // Refresh API keys from the server to get the updated list
      await loadAPIKeys();

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add API key';
      setError(errorMessage);
      throw err;
    }
  }, [profile?.id, loadAPIKeys]);

  // Remove API key
  const removeAPIKey = useCallback(async (keyId: string) => {
    try {
      setError(null);

      const { error: deleteError } = await supabase
        .from('user_api_keys')
        .delete()
        .eq('id', keyId);

      if (deleteError) {
        throw new Error('Failed to remove API key');
      }

      // Update local state
      setUserAPIKeys(prev => prev.filter(key => key.id !== keyId));

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to remove API key';
      setError(errorMessage);
      throw err;
    }
  }, [supabase]);

  // Update usage limits
  const updateUsageLimits = useCallback(async (data: UsageLimitsUpdateData) => {
    if (!profile?.id) {
      throw new Error('No profile loaded');
    }

    try {
      setError(null);

      const { data: upsertData, error: upsertError } = await supabase
        .from('user_usage_limits')
        .upsert({
          user_id: profile.id,
          ...data,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (upsertError) {
        throw new Error('Failed to update usage limits');
      }

      setUsageLimits(upsertData);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update usage limits';
      setError(errorMessage);
      throw err;
    }
  }, [profile?.id, supabase]);

  // Update provider configuration
  const updateProviderConfig = useCallback(async (providerId: string, config: Partial<UserAIProviderConfig>) => {
    if (!profile?.id) {
      throw new Error('No profile loaded');
    }

    try {
      setError(null);

      const { data: upsertData, error: upsertError } = await supabase
        .from('user_ai_provider_configs')
        .upsert({
          user_id: profile.id,
          provider_id: providerId,
          ...config,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (upsertError) {
        throw new Error('Failed to update provider configuration');
      }

      // Update local state
      setUserProviderConfigs(prev => {
        const existing = prev.find(c => c.provider_id === providerId);
        if (existing) {
          return prev.map(c => c.provider_id === providerId ? upsertData : c);
        } else {
          return [...prev, upsertData];
        }
      });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update provider configuration';
      setError(errorMessage);
      throw err;
    }
  }, [profile?.id, supabase]);

  // Dismiss alert
  const dismissAlert = useCallback(async (alertId: string) => {
    try {
      setError(null);

      const { error: updateError } = await supabase
        .from('usage_alerts')
        .update({
          is_dismissed: true,
          dismissed_at: new Date().toISOString(),
        })
        .eq('id', alertId);

      if (updateError) {
        throw new Error('Failed to dismiss alert');
      }

      // Update local state
      setUsageAlerts(prev => prev.map(alert => 
        alert.id === alertId 
          ? { ...alert, is_dismissed: true, dismissed_at: new Date().toISOString() }
          : alert
      ));

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to dismiss alert';
      setError(errorMessage);
      throw err;
    }
  }, [supabase]);

  // Public refresh functions
  const refreshProfile = useCallback(() => loadProfile(), [loadProfile]);
  const refreshProviders = useCallback(() => loadProviders(), [loadProviders]);
  const refreshUsageData = useCallback(() => loadUsageData(), [loadUsageData]);
  const refreshBillingData = useCallback(() => loadBillingData(), [loadBillingData]);
  const refreshWorkflows = useCallback(() => loadWorkflows(), [loadWorkflows]);

  const refreshAll = useCallback(async () => {
    await Promise.all([
      loadProfile(),
      loadProviders(),
      loadUsageData(),
      loadBillingData(),
      loadWorkflows(),
    ]);
  }, [loadProfile, loadProviders, loadUsageData, loadBillingData, loadWorkflows]);

  // Initial load
  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  // Load dependent data when profile is loaded
  useEffect(() => {
    if (profile?.id) {
      Promise.all([
        loadProviders(),
        loadAPIKeys(),
        loadUsageData(),
        loadBillingData(),
        loadWorkflows(),
      ]);
    }
  }, [profile?.id, loadProviders, loadAPIKeys, loadUsageData, loadBillingData, loadWorkflows]);

  return {
    // Profile data
    profile,
    userConfiguration,
    isLoading,
    error,
    
    // AI Providers and Models
    providers,
    userProviderConfigs,
    availableModels,
    userAPIKeys,
    providersLoading,
    
    // Usage and limits
    usageLimits,
    recentUsage,
    usageAlerts,
    usageLoading,
    
    // Billing
    currentSubscription,
    availablePlans,
    billingLoading,
    
    // Workflows
    featuredTemplates,
    activeWorkflows,
    workflowsLoading,
    
    // Actions
    updateProfile,
    updateUserConfiguration,
    addAPIKey,
    removeAPIKey,
    updateUsageLimits,
    updateProviderConfig,
    dismissAlert,
    
    // Refresh functions
    refreshAll,
    refreshProfile,
    refreshProviders,
    refreshUsageData,
    refreshBillingData,
    refreshWorkflows,
  };
} 