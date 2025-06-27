'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { 
  UserProfile, 
  AIProvider, 
  UserAPIKey, 
  UsageLimits, 
  UsageSummary,
  StripeSubscription,
  StripePrice,
  ProfileUpdateData,
  APIKeyCreateData,
  UsageLimitsUpdateData
} from './types';

interface UseSettingsReturn {
  // Profile data
  profile: UserProfile | null;
  isLoading: boolean;
  error: string | null;
  
  // AI Providers and API Keys
  providers: AIProvider[];
  userAPIKeys: UserAPIKey[];
  providersLoading: boolean;
  
  // Usage and limits
  usageLimits: UsageLimits | null;
  recentUsage: UsageSummary[];
  usageLoading: boolean;
  
  // Billing
  subscription: StripeSubscription | null;
  availablePlans: StripePrice[];
  billingLoading: boolean;
  
  // Actions
  updateProfile: (data: ProfileUpdateData) => Promise<void>;
  addAPIKey: (data: APIKeyCreateData) => Promise<void>;
  removeAPIKey: (keyId: string) => Promise<void>;
  updateUsageLimits: (data: UsageLimitsUpdateData) => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshAPIKeys: () => Promise<void>;
  refreshUsageData: () => Promise<void>;
  refreshBillingData: () => Promise<void>;
}

export function useSettings(): UseSettingsReturn {
  // Core state
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // AI providers and API keys
  const [providers, setProviders] = useState<AIProvider[]>([]);
  const [userAPIKeys, setUserAPIKeys] = useState<UserAPIKey[]>([]);
  const [providersLoading, setProvidersLoading] = useState(false);
  
  // Usage tracking
  const [usageLimits, setUsageLimits] = useState<UsageLimits | null>(null);
  const [recentUsage, setRecentUsage] = useState<UsageSummary[]>([]);
  const [usageLoading, setUsageLoading] = useState(false);
  
  // Billing
  const [subscription, setSubscription] = useState<StripeSubscription | null>(null);
  const [availablePlans, setAvailablePlans] = useState<StripePrice[]>([]);
  const [billingLoading, setBillingLoading] = useState(false);

  const supabase = createClient();

  // Load user profile
  const loadProfile = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        setProfile(null);
        return;
      }

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
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  // Load AI providers
  const loadProviders = useCallback(async () => {
    try {
      setProvidersLoading(true);
      
      const { data: providersData, error: providersError } = await supabase
        .from('ai_providers')
        .select('*')
        .eq('is_active', true)
        .order('display_name');

      if (providersError) {
        throw new Error('Failed to load AI providers');
      }

      setProviders(providersData || []);
    } catch (err) {
      console.error('Error loading providers:', err);
    } finally {
      setProvidersLoading(false);
    }
  }, [supabase]);

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
        is_active: key.is_active,
        created_at: key.created_at,
        updated_at: key.updated_at,
      }));

      setUserAPIKeys(transformedKeys);
    } catch (err) {
      console.error('Error loading API keys:', err);
    }
  }, [profile?.id, supabase]);

  // Load usage limits and recent usage
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

      // Load recent usage (last 30 days)
      const { data: summaryData, error: summaryError } = await supabase
        .from('daily_usage_summaries')
        .select('*')
        .eq('user_id', profile.id)
        .gte('date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
        .order('date', { ascending: false });

      if (summaryError) {
        throw new Error('Failed to load usage summary');
      }

      setRecentUsage(summaryData || []);
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
        .from('stripe_subscriptions')
        .select(`
          *,
          stripe_prices!inner(
            stripe_products!inner(name)
          )
        `)
        .eq('user_id', profile.id)
        .in('status', ['active', 'trialing'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (subError && subError.code !== 'PGRST116') {
        throw new Error('Failed to load subscription');
      }

      if (subscriptionData) {
        const transformedSubscription: StripeSubscription = {
          ...subscriptionData,
          product_name: subscriptionData.stripe_prices?.stripe_products?.name || 'Unknown Plan'
        };
        setSubscription(transformedSubscription);
      } else {
        setSubscription(null);
      }

      // Load available plans
      const { data: pricesData, error: pricesError } = await supabase
        .from('stripe_prices')
        .select(`
          *,
          stripe_products!inner(
            name,
            description
          )
        `)
        .eq('active', true)
        .order('unit_amount', { ascending: true });

      if (pricesError) {
        throw new Error('Failed to load pricing plans');
      }

      const transformedPlans: StripePrice[] = (pricesData || []).map(price => ({
        id: price.id,
        product_id: price.product_id,
        unit_amount: price.unit_amount,
        currency: price.currency,
        recurring_interval: price.recurring_interval,
        type: price.type,
        active: price.active,
        product_name: price.stripe_products?.name || 'Unknown Plan',
        product_description: price.stripe_products?.description || ''
      }));

      setAvailablePlans(transformedPlans);
    } catch (err) {
      console.error('Error loading billing data:', err);
    } finally {
      setBillingLoading(false);
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

  // Add API key
  const addAPIKey = useCallback(async (data: APIKeyCreateData) => {
    if (!profile?.id) {
      throw new Error('No profile loaded');
    }

    try {
      setError(null);

      const { error: insertError } = await supabase
        .from('user_api_keys')
        .insert({
          user_id: profile.id,
          ...data,
        });

      if (insertError) {
        throw new Error('Failed to add API key');
      }

      // Refresh API keys
      await loadAPIKeys();

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add API key';
      setError(errorMessage);
      throw err;
    }
  }, [profile?.id, supabase, loadAPIKeys]);

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

  // Public refresh functions
  const refreshProfile = useCallback(() => loadProfile(), [loadProfile]);
  const refreshAPIKeys = useCallback(() => loadAPIKeys(), [loadAPIKeys]);
  const refreshUsageData = useCallback(() => loadUsageData(), [loadUsageData]);
  const refreshBillingData = useCallback(() => loadBillingData(), [loadBillingData]);

  // Initial load
  useEffect(() => {
    loadProfile();
    loadProviders();
  }, [loadProfile, loadProviders]);

  // Load dependent data when profile is loaded
  useEffect(() => {
    if (profile?.id) {
      loadAPIKeys();
      loadUsageData();
      loadBillingData();
    }
  }, [profile?.id, loadAPIKeys, loadUsageData, loadBillingData]);

  return {
    // Profile data
    profile,
    isLoading,
    error,
    
    // AI Providers and API Keys
    providers,
    userAPIKeys,
    providersLoading,
    
    // Usage and limits
    usageLimits,
    recentUsage,
    usageLoading,
    
    // Billing
    subscription,
    availablePlans,
    billingLoading,
    
    // Actions
    updateProfile,
    addAPIKey,
    removeAPIKey,
    updateUsageLimits,
    refreshProfile,
    refreshAPIKeys,
    refreshUsageData,
    refreshBillingData,
  };
} 