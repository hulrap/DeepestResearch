'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useSettings } from '@/lib/settings/use-settings';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { createClient } from '@/lib/supabase/client';
import {
  getProfessionOptions,
  getExperienceLevelOptions,
  getSkillSuggestions
} from '@/lib/settings/data-sources';
import { useGeographicalData } from '@/lib/settings/use-geographical-data';
import {
  validateAndSanitizePhone,
  validateAndSanitizeUsername
} from '@/lib/security/input-validation';
import type { ExperienceLevel, ParticipationRole } from '@/lib/settings/types';
import { SettingsMobileDropdown } from '@/components/settings/SettingsMobileDropdown';

// Stripe data interfaces
interface StripeProductData {
  name: string;
  description?: string;
}

interface StripePriceWithProduct {
  stripe_products: StripeProductData[];
}

interface StripeSubscriptionData {
  status: string;
  current_period_end: string;
  stripe_prices: StripePriceWithProduct[];
}

interface StripeSubscriptionQueryResult {
  status: string;
  current_period_end: string;
  price_id: string;
  stripe_prices: {
    stripe_products: {
      name: string;
    }[];
  }[] | null;
}

interface StripePlanItem {
  id: string;
  unit_amount: number | null;
  currency: string;
  recurring_interval: string | null;
  type: string;
  product_id: string;
  active: boolean;
  stripe_products: StripeProductData[];
}

type SettingsSection = 'profile' | 'contact' | 'professional' | 'participation' | 'location' | 'finance' | 'settings';

export function UserSettings() {
  // All translation hooks at the top level
  const t = useTranslations('settings');
  const tCommon = useTranslations('common');
  const tProfessions = useTranslations('professions');
  const tSkills = useTranslations('skills');
  const tValidation = useTranslations('settings.errors.validation');
  const tLoading = useTranslations('settings.loadingStates');
  const tFinance = useTranslations('settings.finance');
  const tErrors = useTranslations('settings.errors');
  const tStripeErrors = useTranslations('errors.stripe');
  const tFinanceErrors = useTranslations('errors.finance');
  const locale = useLocale();

  const { profile, preferences, updateMultipleSettings, error, refreshProfile, profileCompletion, checkSectionCompletion } = useSettings(tValidation);
  const [activeSection, setActiveSection] = useState<SettingsSection>('participation');
  const [isSaving, setIsSaving] = useState(false);
  const [localChanges, setLocalChanges] = useState<Record<string, unknown>>({});
  const [skillInput, setSkillInput] = useState('');
  const [showSkillSuggestions, setShowSkillSuggestions] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [showChangeEmailModal, setShowChangeEmailModal] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [changeEmailError, setChangeEmailError] = useState<string | null>(null);
  const [changeEmailSuccess, setChangeEmailSuccess] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [changePasswordError, setChangePasswordError] = useState<string | null>(null);
  const [changePasswordSuccess, setChangePasswordSuccess] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [websiteError, setWebsiteError] = useState<string | null>(null);
  
  // Current subscription state
  const [currentSubscription, setCurrentSubscription] = useState<{
    productName: string;
    status: string;
    currentPeriodEnd: string;
  } | null>(null);
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  
  // Track one-time payments for profile completion
  const [hasOneTimePayment, setHasOneTimePayment] = useState(false);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  
  // Available plans state
  const [availablePlans, setAvailablePlans] = useState<Array<{
    id: string;
    product_name: string;
    product_description: string;
    unit_amount: number | null;
    currency: string;
    recurring_interval: string | null;
    type: string;
  }>>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [checkoutMessage, setCheckoutMessage] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  
  // Sync state (temporarily removed - not fully implemented)
  // const [isSyncing, setIsSyncing] = useState(false);
  // const [syncResult, setSyncResult] = useState<{ success: boolean; message: string } | null>(null);
  
  // Auto-navigation tracking
  const [previousCompletion, setPreviousCompletion] = useState<number>(0);
  const [sectionsCompleted, setSectionsCompleted] = useState<Set<SettingsSection>>(new Set());
  const [isAutoNavigating, setIsAutoNavigating] = useState(false);
  const [autoNavigationTarget, setAutoNavigationTarget] = useState<SettingsSection | null>(null);
  
  const supabase = createClient();

  // Rate limit checking
  const [fieldLimits, setFieldLimits] = useState<Record<string, { canChange: boolean; errorMessage?: string }>>({});

  // Fetch one-time payments for profile completion (legacy function - use fetchFinancialData instead)
  const fetchOneTimePayments = useCallback(async () => {
    if (!profile?.id) return;
    
    setPaymentsLoading(true);
    try {
      // Check for ACTUAL payments - either successful one-time payments OR active subscriptions
      const [paymentsResult, subscriptionsResult] = await Promise.all([
        supabase
          .from('stripe_payments')
          .select('id')
          .eq('customer_id', profile.id)
          .eq('status', 'succeeded')
          .limit(1),
        supabase
          .from('stripe_subscriptions')
          .select('id')
          .eq('user_id', profile.id)
          .in('status', ['active', 'trialing'])
          .limit(1)
      ]);
      
      // Apply same priority logic as fetchFinancialData
      const hasSuccessfulPayment = Boolean(paymentsResult.data && paymentsResult.data.length > 0);
      const hasActiveSubscription = Boolean(subscriptionsResult.data && subscriptionsResult.data.length > 0);
      
      // Only set hasOneTimePayment if there are payments AND no active subscription
      if (hasActiveSubscription) {
        setHasOneTimePayment(false); // Active subscription takes priority
      } else {
        setHasOneTimePayment(hasSuccessfulPayment); // Show payment status only when no subscription
      }
    } catch {
      setHasOneTimePayment(false);
    } finally {
      setPaymentsLoading(false);
    }
  }, [profile?.id, supabase]);

  // Fetch current subscription
  const fetchCurrentSubscription = useCallback(async () => {
    if (!profile?.id) return;
    
    setSubscriptionLoading(true);
    try {
      const { data, error } = await supabase
        .from('stripe_subscriptions')
        .select(`
          status,
          current_period_end,
          stripe_prices!inner(
            stripe_products!inner(
              name
            )
          )
        `)
        .eq('user_id', profile.id)
        .in('status', ['active', 'trialing'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        return;
      }

      if (data) {
        // Use the proper interface instead of complex type casting
        const subscriptionData = data as StripeSubscriptionData;
        setCurrentSubscription({
          productName: subscriptionData.stripe_prices[0].stripe_products[0].name,
          status: subscriptionData.status,
          currentPeriodEnd: subscriptionData.current_period_end
        });
      } else {
        setCurrentSubscription(null);
      }
    } catch {
      setCurrentSubscription(null);
    } finally {
      setSubscriptionLoading(false);
    }
  }, [profile?.id, supabase]);

  // Fetch available plans
  const fetchAvailablePlans = useCallback(async () => {
    setPlansLoading(true);
    try {
      // Single optimized query for active prices with product data
      const { data, error } = await supabase
        .from('stripe_prices')
        .select(`
          id,
          unit_amount,
          currency,
          recurring_interval,
          type,
          product_id,
          stripe_products (
            name,
            description
          )
        `)
        .eq('active', true)
        .order('unit_amount', { ascending: true });

      if (error) {
        throw error;
      }

      // Handle empty results gracefully
      if (!data || data.length === 0) {
        setAvailablePlans([]);
        return;
      }

      const formattedPlans = data.map((item, index) => {
        const planItem = item as StripePlanItem;
        const productData = planItem.stripe_products;
        
        let productName = tFinanceErrors('planFallbackName', { index: index + 1 });
        let productDescription = tFinanceErrors('planFallbackDescription');
        
        // Handle different possible structures from Supabase
        if (Array.isArray(productData) && productData.length > 0 && productData[0]) {
          productName = productData[0].name || productName;
          productDescription = productData[0].description || productDescription;
        } else if (productData && typeof productData === 'object' && 'name' in productData) {
          productName = (productData as StripeProductData).name || productName;
          productDescription = (productData as StripeProductData).description || productDescription;
        }

        return {
          id: planItem.id,
          product_name: productName,
          product_description: productDescription,
          unit_amount: planItem.unit_amount || 0,
          currency: planItem.currency,
          recurring_interval: planItem.recurring_interval,
          type: planItem.type
        };
      });
      
      setAvailablePlans(formattedPlans);
    } catch {
      setAvailablePlans([]);
    } finally {
      setPlansLoading(false);
    }
  }, [supabase, tFinanceErrors]);

  // Handle plan selection - Stripe handles custom amounts natively  
  const handleSelectPlan = useCallback(async (priceId: string) => {
    setCheckoutLoading(priceId);
    try {
      const response = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId, locale })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.details || data.error || tStripeErrors('failedToCreateCheckoutSession'));
      }

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(tStripeErrors('noCheckoutUrlReceived'));
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : tStripeErrors('failedToStartCheckout');
      alert(`${tStripeErrors('checkoutFailed')}: ${errorMessage}`);
    } finally {
      setCheckoutLoading(null);
    }
  }, [locale, tStripeErrors]);

  // Handle billing portal
  const handleManageSubscription = async () => {
    try {
      const response = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.details || data.error || tStripeErrors('failedToCreatePortalSession'));
      }

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(tStripeErrors('noPortalUrlReceived'));
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : tStripeErrors('failedToOpenBillingPortal');
      alert(`${tStripeErrors('billingPortalError')}: ${errorMessage}`);
    }
  };

  // Format price for display
  const formatPrice = (amount: number | null, currency: string, interval?: string | null) => {
    if (amount === null) {
      return tFinance('payAsYouWish');
    }
    
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100);
    
    if (interval) {
      return `${formatted}/${interval}`;
    }
    return formatted;
  };

  const checkFieldLimits = useCallback(async () => {
    if (!profile?.id) return;
    
    const limits = {
      username: { daily: 1 },
      first_name: { total: 3 },
      last_name: { total: 3 },
      bio: { daily: 10 },
      website: { daily: 5 },
      phone: { total: 3 }  // Allow first entry + 2 changes = 3 total entries
    };

    try {
      // Batch all field limit checks in parallel for better performance
      const limitChecks = Object.entries(limits).map(([field, limit]) => 
        supabase.rpc('check_field_change_limit', {
          user_id: profile.id,
          field_name_param: field,
          daily_limit: 'daily' in limit ? limit.daily : null,
          total_limit: 'total' in limit ? limit.total : null
        }).then(({ data }) => ({
          field,
          result: data ? {
            canChange: data.can_change,
            errorMessage: data.error_message
          } : { canChange: true }
        }))
      );

      const results = await Promise.all(limitChecks);
      
      const newLimits: Record<string, { canChange: boolean; errorMessage?: string }> = {};
      results.forEach(({ field, result }) => {
        newLimits[field] = result;
      });

      setFieldLimits(newLimits);
    } catch {
      // On any error, set permissive defaults
      const newLimits: Record<string, { canChange: boolean; errorMessage?: string }> = {};
      Object.keys(limits).forEach(field => {
        newLimits[field] = { canChange: true };
      });
      setFieldLimits(newLimits);
    }
  }, [profile?.id, supabase]);

  // Use secure validation functions instead of basic regex
  const validatePhone = (phone: string): boolean => {
    const { isValid } = validateAndSanitizePhone(phone);
    return isValid;
  };

  const validateUsername = (username: string): boolean => {
    const { isValid } = validateAndSanitizeUsername(username);
    return isValid;
  };

  const isUsernameAutoGenerated = useCallback((username: string, email: string): boolean => {
    if (!username || !email) return false;
    
    // Extract base from email (part before @) and clean it
    const emailBase = email.split('@')[0].toLowerCase().replace(/[^a-z0-9_-]/g, '');
    
    // Auto-generated username is EXACTLY the email base, nothing more, nothing less
    return username.toLowerCase() === emailBase;
  }, []);

  const handleChangeEmail = async () => {
    setChangeEmailError(null);
    setChangeEmailSuccess(false);
    if (!newEmail) {
      setChangeEmailError(t('fields.email.emailRequired'));
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({
        email: newEmail
      });

      if (error) {
        throw error;
      }

      setChangeEmailSuccess(true);
      setNewEmail('');
      // Optionally, sign out the user if Secure email change is enabled on Supabase
      // await supabase.auth.signOut(); 
    } catch (err) {
      setChangeEmailError(err instanceof Error ? err.message : tErrors('failedToChangeEmail'));
    }
  };

  const handleChangePassword = async () => {
    setChangePasswordError(null);
    setChangePasswordSuccess(false);
    if (!newPassword) {
      setChangePasswordError(t('fields.password.newPasswordRequired')); // Assuming a new translation key here
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setChangePasswordError(t('auth.signUp.passwordsDoNotMatch'));
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) {
        throw error;
      }

      setChangePasswordSuccess(true);
      setNewPassword('');
      setConfirmNewPassword('');
      // No need to sign out after password change
    } catch (err) {
      setChangePasswordError(err instanceof Error ? err.message : tErrors('failedToChangePassword'));
    }
  };

    // OPTIMIZATION: Combine subscription and payment data in single call
  const fetchFinancialData = useCallback(async () => {
    if (!profile?.id) return;
    
    setSubscriptionLoading(true);
    setPaymentsLoading(true);
    
    try {
      // Single optimized query combining subscription and payment status
      const [subscriptionResult, paymentsResult] = await Promise.all([
        supabase
          .from('stripe_subscriptions')
          .select(`
            status,
            current_period_end,
            price_id,
            stripe_prices(
              stripe_products(name)
            )
          `)
          .eq('user_id', profile.id)
          .in('status', ['active', 'trialing'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        
        supabase
          .from('stripe_payments')
          .select('id')
          .eq('customer_id', profile.id)
          .eq('status', 'succeeded')
          .limit(1)
      ]);

      // Process subscription data
      const hasActiveSubscription = Boolean(subscriptionResult.data);
      if (hasActiveSubscription) {
        const subscriptionData = subscriptionResult.data as StripeSubscriptionQueryResult;
        setCurrentSubscription({
          productName: subscriptionData.stripe_prices?.[0]?.stripe_products?.[0]?.name || 'Unknown Plan',
          status: subscriptionData.status,
          currentPeriodEnd: subscriptionData.current_period_end
        });
      } else {
        setCurrentSubscription(null);
      }

      // Process payment status with proper priority logic:
      // Active subscription takes precedence over one-time payments
      const hasSuccessfulPayment = Boolean(paymentsResult.data && paymentsResult.data.length > 0);
      
      // Only set hasOneTimePayment to true if there are successful payments AND no active subscription
      // This ensures active subscription display takes priority
      if (hasActiveSubscription) {
        setHasOneTimePayment(false); // Don't show one-time payment status when subscription is active
      } else {
        setHasOneTimePayment(hasSuccessfulPayment); // Show one-time payment status only when no active subscription
      }

    } catch {
      setCurrentSubscription(null);
      setHasOneTimePayment(false);
    } finally {
      setSubscriptionLoading(false);
      setPaymentsLoading(false);
    }
  }, [profile?.id, supabase]);

  useEffect(() => {
    // Load data progressively in background - don't block UI
    if (profile?.id) {
      // OPTIMIZED: Combine related financial data calls
      Promise.all([
        checkFieldLimits().catch(() => {}), // Graceful failure
        fetchFinancialData().catch(() => {}), // Combined subscription + payment check
        fetchAvailablePlans().catch(() => {})
      ]);
    }
  }, [profile?.id, checkFieldLimits, fetchFinancialData, fetchAvailablePlans]);

  // Automatic sync after Stripe interactions
  const triggerStripeSync = useCallback(async () => {
    try {
      const response = await fetch('/api/stripe/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        await response.json();
        return true;
      } else {
        return false;
      }
    } catch {
      return false;
    }
  }, []);

  // Handle checkout success/cancel messages and billing portal returns
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const success = urlParams.get('success');
    const canceled = urlParams.get('canceled');
    const fromBilling = urlParams.get('from');
    
    if (success === 'true') {
      setCheckoutMessage({
        type: 'success',
        message: tFinance('messages.paymentSuccessSyncing')
      });
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
      
      // Auto-sync after successful payment
      const syncAndRefresh = async () => {
        const syncSuccess = await triggerStripeSync();
        if (syncSuccess) {
          // Wait a moment for sync to propagate, then refresh financial data
          setTimeout(() => {
            fetchFinancialData(); // Use combined function for better consistency
            setCheckoutMessage({
              type: 'success',
              message: tFinance('messages.paymentSuccessActivated')
            });
          }, 2000);
        } else {
          // Fallback to manual refresh if sync fails
          fetchFinancialData(); // Use combined function for better consistency
          setCheckoutMessage({
            type: 'success',
            message: tFinance('messages.paymentSuccessActivated')
          });
        }
      };
      
      syncAndRefresh();
      // Auto-focus on the finance section since they were just managing billing
      setActiveSection('finance');
    } else if (canceled === 'true') {
      setCheckoutMessage({
        type: 'error',
        message: tFinance('messages.paymentCanceled')
      });
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    } else if (fromBilling === 'billing') {
      setCheckoutMessage({
        type: 'success',
        message: tFinance('messages.welcomeBackSyncing')
      });
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
      
      // Auto-sync after billing portal changes
      const syncAndRefresh = async () => {
        const syncSuccess = await triggerStripeSync();
        if (syncSuccess) {
          // Wait a moment for sync to propagate, then refresh financial data
          setTimeout(() => {
            fetchFinancialData(); // Use combined function for better consistency
            setCheckoutMessage({
              type: 'success',
              message: tFinance('messages.welcomeBackUpdated')
            });
          }, 2000);
        } else {
          // Fallback to manual refresh if sync fails
          fetchFinancialData(); // Use combined function for better consistency
          setCheckoutMessage({
            type: 'success',
            message: tFinance('messages.welcomeBackUpdated')
          });
        }
      };
      
      syncAndRefresh();
      // Auto-focus on the finance section since they were just managing billing
      setActiveSection('finance');
    }
  }, [fetchCurrentSubscription, fetchOneTimePayments, fetchFinancialData, triggerStripeSync, tFinance, tFinanceErrors]);

  // Set default country if none exists
  useEffect(() => {
    if (profile && (!profile.preferences?.country || profile.preferences.country === '')) {
      // Set Austria as default country if none is set and auto-save it
      const setDefaultCountry = async () => {
        try {
          await updateMultipleSettings({ country: 'AT' });
        } catch {
          // Silently handle error - not critical for UX
        }
      };
      setDefaultCountry();
    }
  }, [profile, updateMultipleSettings]);

  const handleChange = (key: string, value: string | boolean | string[]) => {
    // Note: We allow typing but will block saving if rate limits are exceeded
    // Rate limits are checked during save operation, not during typing

    // Clear validation errors when typing
    if (key === 'username') setUsernameError(null);
    if (key === 'phone') setPhoneError(null);

    // Reset auto-navigation tracking when user makes ANY changes to a section that was previously auto-navigated from
    // This ensures that if a section becomes incomplete (by removing content) or complete again (by adding content),
    // the auto-navigation can work properly on the next save
    if (sectionsCompleted.has(activeSection)) {
      setSectionsCompleted(prev => {
        const newSet = new Set(prev);
        newSet.delete(activeSection);
        return newSet;
      });
    }

    // Get original value to compare
    let originalValue: string | boolean | string[] | undefined;
    if (profile) {
      if (key === 'username') originalValue = profile.username;
      else if (key === 'first_name') originalValue = profile.first_name;
      else if (key === 'last_name') originalValue = profile.last_name;
      else if (key === 'phone') originalValue = profile.phone;
      else if (key === 'participation_role') originalValue = profile.participation_role;
      else if (key === 'direct_contact_consent') originalValue = profile.direct_contact_consent;
      else if (key === 'newsletter_consent') originalValue = profile.newsletter_consent;
      else if (key === 'organization_representative') originalValue = profile.organization_representative;
      else if (profile.preferences) {
        const prefValue = profile.preferences[key as keyof typeof profile.preferences];
        // Type guard to ensure we only assign compatible types
        if (typeof prefValue === 'string' || typeof prefValue === 'boolean' || Array.isArray(prefValue) || prefValue === undefined) {
          originalValue = prefValue;
        }
      }
    }

    // Normalize values for comparison
    const normalizeValue = (val: string | boolean | string[] | null | undefined) => {
      if (typeof val === 'string') return val.trim() || '';
      if (typeof val === 'boolean') return val;
      if (val === null || val === undefined) return null; // Keep null as null for boolean fields
      return val;
    };

    const normalizedOriginal = normalizeValue(originalValue);
    const normalizedNew = normalizeValue(value);

    // Only store if value has actually changed
    setLocalChanges(prev => {
      const newChanges = { ...prev };
      
          // Handle country/region dependencies
    if (key === 'country' && typeof value === 'string') {
      newChanges.region = null;
      newChanges.city = null;
    } else if (key === 'region' && typeof value === 'string') {
      newChanges.city = null;
    }



      // Only store if different from original
      if (normalizedNew === normalizedOriginal) {
        // Value is same as original, remove from changes
        delete newChanges[key];
      } else {
        // Value is different, store the change
        // Handle boolean values correctly to preserve false values
        if (typeof value === 'boolean') {
          newChanges[key] = value;
        } else {
          newChanges[key] = value || null;
        }
      }
      
      return newChanges;
    });
  };

  // Handle blur events - only check character limits
  const handleBlur = (key: string, value: string) => {
    // Only validate character limits on blur
    let maxLength = 500; // default
    switch (key) {
      case 'bio': maxLength = 500; break;
      case 'professional_comment': maxLength = 2000; break;
      case 'contact_comment': maxLength = 300; break;
      case 'first_name':
      case 'last_name': maxLength = 50; break;
      case 'username': maxLength = 30; break;
      case 'phone': maxLength = 30; break;
      case 'organization':
      case 'city': maxLength = 100; break;
      case 'website': maxLength = 500; break;
    }

    if (value.length > maxLength) {
      // Show a simple character limit error
      if (key === 'username') {
        setUsernameError(tErrors('maximumCharacters', { maxLength }));
      } else if (key === 'phone') {
        setPhoneError(tErrors('maximumCharacters', { maxLength }));
      } else if (key === 'website') {
        setWebsiteError(tErrors('maximumCharacters', { maxLength }));
      }
      // For other fields, could add similar error states if needed
    } else {
      // Clear any character limit errors and validate format
      if (key === 'username') setUsernameError(null);
      if (key === 'phone') setPhoneError(null);
      if (key === 'website') {
        // Validate website format on blur with stricter validation
        if (value.trim() !== '' && !value.trim().match(/^https?:\/\/.+\..{2,}$/)) {
          setWebsiteError(tValidation('invalidWebsite') || 'Website must start with http:// or https:// and have a valid domain (e.g., https://a.co)');
        } else {
          setWebsiteError(null);
        }
      }
    }
  };

  const handleSave = async () => {
    if (Object.keys(localChanges).length === 0) {
      return;
    }

    // Check rate limits before saving
    for (const [key] of Object.entries(localChanges)) {
      if (fieldLimits[key] && fieldLimits[key].canChange === false) {
        // Special exception for auto-generated usernames
        if (key === 'username' && profile?.username && profile?.email) {
          const isAutoGenerated = isUsernameAutoGenerated(profile.username, profile.email);
          if (!isAutoGenerated) {
            setUsernameError(fieldLimits[key].errorMessage || t('fields.username.rateLimitError'));
            return;
          }
        } else {
          // Set appropriate error message for the field
          if (key === 'username') {
            setUsernameError(fieldLimits[key].errorMessage || t('fields.username.rateLimitError'));
          } else if (key === 'phone') {
            setPhoneError(fieldLimits[key].errorMessage || t('fields.phone.rateLimitError'));
          }
          return;
        }
      }
    }

    // Validate username format before saving if username is being changed
    if (localChanges.username && typeof localChanges.username === 'string') {
      const usernameValue = localChanges.username.trim();
      if (usernameValue !== '' && !validateUsername(usernameValue)) {
        setUsernameError(t('fields.username.formatError'));
        return; // Don't proceed with save if username is invalid
      }
    }

    // Validate phone format before saving if phone is being changed
    if (localChanges.phone && typeof localChanges.phone === 'string') {
      const phoneValue = localChanges.phone.trim();
      if (phoneValue !== '' && !validatePhone(phoneValue)) {
        setPhoneError(t('fields.phone.formatError'));
        return; // Don't proceed with save if phone is invalid
      }
    }

    // Validate website format before saving if website is being changed
    if (localChanges.website && typeof localChanges.website === 'string') {
      const websiteValue = localChanges.website.trim();
      if (websiteValue !== '' && !websiteValue.match(/^https?:\/\/.+\..{2,}$/)) {
        setWebsiteError(tValidation('invalidWebsite') || 'Website must start with http:// or https:// and have a valid domain (e.g., https://a.co)');
        return; // Don't proceed with save if website is invalid
      }
    }

    setIsSaving(true);
    try {

      
      const updates: Record<string, unknown> = {};
      
      // Separate profile fields from preference fields
      const profileFields = ['username', 'first_name', 'last_name', 'phone', 'participation_role', 'direct_contact_consent', 'newsletter_consent', 'organization_representative'];
      const profileUpdates: Record<string, unknown> = {};
      
      for (const [key, value] of Object.entries(localChanges)) {
        if (profileFields.includes(key)) {
          if (key === 'direct_contact_consent' || key === 'newsletter_consent') {
            // Handle consent separately with better error handling
            const consentType = key === 'direct_contact_consent' ? 'direct_contact' : 'newsletter';
            
            const { error: consentError } = await supabase.rpc('record_consent', {
              user_id: profile?.id,
              consent_type_param: consentType,
              consent_given_param: value as boolean
            });
            
            if (consentError) {
              throw consentError;
            }
          } else {
            // Handle participation_role as JSONB array, and allow null for clearing
            if (key === 'participation_role') {
              profileUpdates[key] = value; // Supabase handles JSONB conversion automatically, including null
            } else {
              // Handle field deletion for direct profile columns: set to null for empty strings
              if (value === '' || value === null || value === undefined) {
                profileUpdates[key] = null;
              } else {
                profileUpdates[key] = value;
              }
              
              // Record field change for rate limiting - only if not null AND value actually changed
              if (value !== null && key !== 'organization_representative') { // Don't rate limit organization_representative
                // Get the original value to compare
                let originalValue: string | undefined;
                if (profile) {
                  if (key === 'username') originalValue = profile.username;
                  else if (key === 'first_name') originalValue = profile.first_name;
                  else if (key === 'last_name') originalValue = profile.last_name;
                  else if (key === 'phone') originalValue = profile.phone;
                }
                
                // Normalize values for comparison
                const normalizedOriginal = originalValue || '';
                const normalizedNew = (typeof value === 'string' ? value : '').trim();
                
                // Only record change if values are actually different
                if (normalizedNew !== normalizedOriginal) {
                  // Skip rate limiting for first-time changes from auto-generated usernames
                  let shouldRecordChange = true;
                  
                  if (key === 'username' && profile?.email) {
                    const isOriginalAutoGenerated = isUsernameAutoGenerated(originalValue || '', profile.email);
                    
                    if (isOriginalAutoGenerated) {
                      // First-time change from auto-generated username - should not count against rate limits
                      shouldRecordChange = false;
                    }
                  }
                  
                  // Only record the change if it should count against rate limits
                  if (shouldRecordChange) {
                    await supabase.rpc('record_field_change', {
                      user_id: profile?.id,
                      field_name_param: key
                    });
                  }
                }
              }
            }
          }
        } else {
          // Preference fields: pass null to updateMultipleSettings to clear them
          updates[key] = value;
        }
      }

      // Update profile fields
      if (Object.keys(profileUpdates).length > 0) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update(profileUpdates)
          .eq('id', profile?.id);

        if (profileError) throw profileError;
      }

      // Update preferences
      if (Object.keys(updates).length > 0) {
        await updateMultipleSettings(updates);
      }

      // Check if consent changes were made before clearing localChanges
      const hasConsentChanges = Object.keys(localChanges).some(key => 
        key === 'direct_contact_consent' || key === 'newsletter_consent'
      );

      // Store current changes BEFORE clearing them
      const savedChanges = { ...localChanges };
      
      // Clear local changes, but keep consent fields until profile refresh catches up
      setLocalChanges(prev => {
        const newChanges = { ...prev };
        Object.keys(prev).forEach(key => {
          // Keep consent fields in localChanges to maintain UI state until refresh works
          if (key !== 'direct_contact_consent' && key !== 'newsletter_consent') {
            delete newChanges[key];
          }
        });
        return newChanges;
      });
      
      // For consent changes, trust the database save and skip the problematic refresh
      if (hasConsentChanges) {
        // Skip the aggressive refresh that causes session caching issues
        // The consent values are correctly saved to database (confirmed by user testing)
        // Fresh sessions (incognito) load the correct values
        // We'll just do a simple background refresh without waiting
        setTimeout(() => {
          refreshProfile().catch(() => {
            // Ignore refresh errors - the database save was successful
          });
        }, 1000);
      }
      
      // Clear any validation errors after successful save
      setUsernameError(null);
      setPhoneError(null);
      setWebsiteError(null);
      

      
      // Check completion immediately after save - but only navigate if section is ACTUALLY complete
      setTimeout(() => {
        // Wait for profile to be refreshed before checking completion
        setTimeout(async () => {
          try {
            // Refresh profile first to get latest state
            await refreshProfile();
            
            // Use the centralized section completion check with special handling for finance
            let currentSectionCompleted;
            if (activeSection === 'finance') {
              // Don't auto-navigate if still loading finance data
              if (subscriptionLoading || paymentsLoading) {
                currentSectionCompleted = false;
              } else {
                // Finance section is completed if user has a subscription OR one-time payment
                currentSectionCompleted = Boolean(currentSubscription || hasOneTimePayment);
              }
            } else {
              // Use the centralized completion logic for all other sections
              currentSectionCompleted = await checkSectionCompletion(activeSection);
            }
            
            // Reset auto-navigation tracking if section becomes incomplete after saving
            if (!currentSectionCompleted && sectionsCompleted.has(activeSection)) {
              setSectionsCompleted(prev => {
                const newSet = new Set(prev);
                newSet.delete(activeSection);
                return newSet;
              });
            }
            
            // Only navigate if:
            // 1. Current section is actually complete (all required fields)
            // 2. We haven't already auto-navigated from this section
            // 3. We just saved changes (to avoid navigating on page load)
            const shouldNavigate = currentSectionCompleted && 
                                  !sectionsCompleted.has(activeSection) &&
                                  Object.keys(savedChanges).length > 0;
            
            if (shouldNavigate) {
              const nextSection = getNextSection(activeSection);
              
              if (nextSection) {
                // Show auto-navigation loading screen
                setIsAutoNavigating(true);
                setAutoNavigationTarget(nextSection);
                
                // Mark current section as completed (for visual feedback)
                setSectionsCompleted(prev => new Set([...prev, activeSection]));
                
                // Navigate to next section with a delay for better UX
                setTimeout(() => {
                  setActiveSection(nextSection);
                  setIsAutoNavigating(false);
                  setAutoNavigationTarget(null);
                }, 1200);
              }
            }
          } catch {
            // Don't navigate if there's an error - safer to stay put
          }
        }, 500);
      }, 100); // Small initial delay
      
      // Refresh profile data (always do this even if no consent changes)
      await refreshProfile();
      await checkFieldLimits(); // Refresh rate limits
      
      // Clear consent fields from localChanges if profile refresh shows correct values after final refresh
      setTimeout(() => {
        // Clear consent fields from localChanges if profile refresh shows correct values
        setLocalChanges(prev => {
          const newChanges = { ...prev };
          let shouldClearDirect = false;
          let shouldClearNewsletter = false;
          
          // Check if profile values now match what we saved
          if ('direct_contact_consent' in prev) {
            const expectedValue = Boolean(prev.direct_contact_consent);
            const actualValue = Boolean(profile?.direct_contact_consent);
            if (expectedValue === actualValue) {
              shouldClearDirect = true;
            }
          }
          
          if ('newsletter_consent' in prev) {
            const expectedValue = Boolean(prev.newsletter_consent);
            const actualValue = Boolean(profile?.newsletter_consent);
            if (expectedValue === actualValue) {
              shouldClearNewsletter = true;
            }
          }
          
          if (shouldClearDirect) delete newChanges.direct_contact_consent;
          if (shouldClearNewsletter) delete newChanges.newsletter_consent;
          
          return newChanges;
        });
              }, 100);
      
    } catch {
      // Handle save error silently - user will see validation errors if any
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') return;

    setIsDeleting(true);
    try {
      if (!profile?.id) {
        throw new Error(tStripeErrors('userProfileNotFound'));
      }

      const response = await fetch('/api/delete-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: profile.id }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || tStripeErrors('failedToDeleteAccountViaAPI'));
      }

      // After successful deletion via API, client-side logout and redirect
      await supabase.auth.signOut(); 
      window.location.href = '/'; // Redirect to main page after successful deletion
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : tStripeErrors('failedToDeleteAccount');
      alert(`${tStripeErrors('failedToDeleteAccount')}: ${errorMessage}`);
    } finally {
      setIsDeleting(false);
      setDeleteConfirmText(''); // Clear the confirmation text
    }
  };

  const getValue = (key: string): string => {
    if (key in localChanges) {
      const value = localChanges[key];
      return typeof value === 'string' ? value : '';
    }
    
    // Check profile fields first
    if (profile && key in profile) {
      const value = profile[key as keyof typeof profile];
      return typeof value === 'string' ? value : '';
    }
    
    // Then check preferences
    const value = preferences[key];
    // Handle specific preference fields that might be directly on preferences
    if (key === 'contact_comment' || key === 'professional_comment') {
      return typeof preferences[key] === 'string' ? preferences[key] : '';
    }
    return typeof value === 'string' ? value : '';
  };

  const getBooleanValue = (key: string): boolean => {
    // For consent fields, prioritize local changes for immediate UI feedback
    if (key in localChanges) {
      return Boolean(localChanges[key]);
    }
    
    // For consent fields, use the values from the enhanced profile
    if (key === 'direct_contact_consent') {
      return Boolean(profile?.direct_contact_consent);
    }
    
    if (key === 'newsletter_consent') {
      return Boolean(profile?.newsletter_consent);
    }
    
    // For organization representative field
    if (key === 'organization_representative') {
      return Boolean(profile?.organization_representative);
    }
    
    return Boolean(preferences[key]);
  };

  const getArrayValue = (key: string): string[] => {
    const value = localChanges[key] ?? preferences[key];
    return Array.isArray(value) ? value : [];
  };

  const getParticipationRoles = (): ParticipationRole[] => {
    const value = localChanges['participation_role'] ?? profile?.participation_role;
    return Array.isArray(value) ? value : [];
  };

  const isParticipationRoleSelected = (role: ParticipationRole): boolean => {
    return getParticipationRoles().includes(role);
  };

  const toggleParticipationRole = (role: ParticipationRole) => {
    const currentRoles = getParticipationRoles();
    const newRoles = currentRoles.includes(role)
      ? currentRoles.filter(r => r !== role)
      : [...currentRoles, role];
    handleChange('participation_role', newRoles);
  };

  // Pre-compute translated options
  const professionTranslator = (key: string) => {
    try {
      return tProfessions(key.replace('professions.', ''));
    } catch {
      return key;
    }
  };

  const skillTranslator = (key: string) => {
    try {
      return tSkills(key.replace('skills.', ''));
    } catch {
      return key;
    }
  };

  const professionOptions = getProfessionOptions(professionTranslator);
  const experienceLevelOptions = getExperienceLevelOptions(t);
  const skillSuggestions = getSkillSuggestions(skillTranslator);
  
  // Geographical options with lazy loading
  const selectedCountry = getValue('country') || 'AT';
  const selectedRegion = getValue('region');
  
  const {
    countries: countryOptions,
    states: stateOptions,
    cities: cityOptions,
    countriesLoading,
    statesLoading,
    citiesLoading
  } = useGeographicalData({
    selectedCountry,
    selectedState: selectedRegion,
    autoLoadStates: true,
    autoLoadCities: true
  });



  const filteredSkillSuggestions = skillSuggestions
    .filter(skill => {
      const isAlreadySelected = getArrayValue('skills').includes(skill.value);
      
      // If no input, show first 20 skills (excluding already selected ones)
      if (!skillInput.trim()) {
        return !isAlreadySelected;
      }
      
      // If there's input, filter by input and exclude already selected
      return skill.label.toLowerCase().includes(skillInput.toLowerCase()) && !isAlreadySelected;
    })
    .slice(0, skillInput.trim() ? 10 : 20); // Show more options when no input

  const addSkill = (skill: string) => {
    const currentSkills = getArrayValue('skills');
    if (!currentSkills.includes(skill)) {
      handleChange('skills', [...currentSkills, skill]);
    }
    setSkillInput('');
    setShowSkillSuggestions(false);
  };

  const removeSkill = (skillToRemove: string) => {
    const currentSkills = getArrayValue('skills');
    handleChange('skills', currentSkills.filter(skill => skill !== skillToRemove));
  };

  const handleSkillInputKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ' ') && skillInput.trim()) {
      e.preventDefault();
      addSkill(skillInput.trim());
    }
  };

  const hasChanges = Object.keys(localChanges).length > 0;

  const getSectionTitleKey = (section: SettingsSection): string => {
    return section === 'settings' ? 'account' : section;
  };

  // Define section navigation order
  const sectionOrder = useMemo<SettingsSection[]>(() => ['participation', 'finance', 'profile', 'contact', 'professional', 'location', 'settings'], []);

  // Check if a specific section is completed (sync version for UI)
  const isSectionCompletedSync = useCallback((section: SettingsSection): boolean => {
    if (!profile) return false;
    
    // For finance, check subscription status OR one-time payment history
    // But don't consider it complete/incomplete while still loading
    if (section === 'finance') {
      // If still loading, don't mark as complete or incomplete
      if (subscriptionLoading || paymentsLoading) {
        return false; // Conservative approach: don't auto-navigate while loading
      }
      // Priority: Active subscription > One-time payment > No support
      // Section is completed if user has made ANY form of financial contribution
      return Boolean(currentSubscription) || Boolean(hasOneTimePayment);
    }
    
    // For other sections, use a simplified sync check based on current profile state
    // This is used for UI display only, the async version is used for auto-navigation
    switch (section) {
      case 'participation':
        return Boolean(profile.participation_role && Array.isArray(profile.participation_role) && profile.participation_role.length > 0);
      case 'profile':
        return Boolean(profile.first_name && profile.last_name && profile.preferences?.bio && profile.username);
      case 'contact':
        return Boolean(profile.phone && profile.direct_contact_consent && profile.newsletter_consent && profile.preferences?.contact_comment);
      case 'professional':
        return Boolean(profile.preferences?.profession && 
                      profile.preferences?.experience_level && 
                      profile.preferences?.organization && 
                      profile.preferences?.skills && 
                      Array.isArray(profile.preferences.skills) && 
                      profile.preferences.skills.length > 0 && 
                      profile.preferences?.professional_comment);
      case 'location':
        return Boolean(profile.preferences?.country && profile.preferences?.region && profile.preferences?.city);
      case 'settings':
        return Boolean(profile.username && profile.first_name);
      default:
        return false;
    }
  }, [profile, currentSubscription, hasOneTimePayment, subscriptionLoading, paymentsLoading]);

  // Get next incomplete section in order (with circular logic)
  const getNextSection = useCallback((currentSection: SettingsSection): SettingsSection | null => {
    const currentIndex = sectionOrder.indexOf(currentSection);
    if (currentIndex === -1) {
      return null; // Invalid current section
    }

    // First, check all sections after the current one
    for (let i = currentIndex + 1; i < sectionOrder.length; i++) {
      const section = sectionOrder[i];
      if (!isSectionCompletedSync(section)) {
        return section; // Found first incomplete section after current
      }
    }

    // If no incomplete sections after current, wrap around and check from beginning up to current
    for (let i = 0; i < currentIndex; i++) {
      const section = sectionOrder[i];
      if (!isSectionCompletedSync(section)) {
        return section; // Found first incomplete section before current
      }
    }

    // All sections are complete, don't auto-navigate
    return null;
  }, [sectionOrder, isSectionCompletedSync]);

  // Auto-navigate to next section when current section is completed (backup for page refresh scenarios)
  const handleAutoNavigation = useCallback(() => {
    if (!profile) return;

    const currentSectionCompleted = isSectionCompletedSync(activeSection);
    
    // Only navigate if:
    // 1. Current section is completed
    // 2. This section wasn't already marked as completed (avoid loops)
    // 3. Profile completion has significantly increased AND we're at initial load (indicating page refresh scenario)
    // 4. No recent save activity (avoid conflicts with save-based navigation)
    const hasSignificantIncrease = profileCompletion > previousCompletion + 5;
    const isInitialLoadScenario = previousCompletion === 0 && profileCompletion > 10; // Only trigger on initial load
    const shouldTriggerBackupNavigation = hasSignificantIncrease && isInitialLoadScenario;
    
    if (currentSectionCompleted && 
        !sectionsCompleted.has(activeSection) && 
        shouldTriggerBackupNavigation) {
      
      const nextSection = getNextSection(activeSection);
      
      if (nextSection) {
        // Mark current section as completed
        setSectionsCompleted(prev => new Set([...prev, activeSection]));
        
        // Navigate to next section with a small delay for better UX
        setTimeout(() => {
          setActiveSection(nextSection);
        }, 1000); // 1 second delay to let user see the completion
      }
    }
    
    // Update previous completion for next comparison
    setPreviousCompletion(profileCompletion);
  }, [profile, activeSection, profileCompletion, previousCompletion, sectionsCompleted, isSectionCompletedSync, getNextSection]);

  // Trigger auto-navigation when profile changes (mainly for page refresh scenarios)
  useEffect(() => {
    handleAutoNavigation();
  }, [handleAutoNavigation]);

  // If there's an error, show error state instead of loading
  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center space-y-6">
          <p className="text-red-400 text-lg font-medium tracking-wide">{t('error')}</p>
          <Button onClick={() => window.location.reload()} variant="outline" className="text-white border-gray-700 touch-manipulation text-center whitespace-normal leading-tight min-h-[2.5rem] text-sm sm:text-base px-4 sm:px-6 py-2">
            {t('tryAgain')}
          </Button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center space-y-6">
          <div className="relative bg-gradient-to-br from-red-900/30 via-red-800/20 to-red-900/30 backdrop-blur-xl border border-red-700/30 rounded-sm p-8 shadow-2xl">
            <div className="absolute inset-0 bg-gradient-to-r from-red-500/5 to-transparent rounded-sm"></div>
            <p className="text-red-300 mb-6 text-lg font-medium">{t('error')}</p>
            <Button 
              onClick={() => window.location.reload()} 
              variant="outline"
              className="border-red-500/50 text-red-300 hover:bg-red-500/20 hover:text-red-200 hover:border-red-400 transition-all duration-300 backdrop-blur-sm rounded-sm"
            >
              {t('tryAgain')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const renderFieldError = (fieldName: string) => {
    // First check for validation errors (format errors)
    if (fieldName === 'website' && websiteError) {
      return (
        <p className="text-xs text-red-400 mt-1 animate-pulse">
          {websiteError}
        </p>
      );
    }

    const limit = fieldLimits[fieldName];
    // Only show rate limit error if user is actually trying to make a change to this field
    const isFieldBeingChanged = fieldName in localChanges;
    
    // Special handling for username: don't show rate limit if it's auto-generated
    if (fieldName === 'username' && profile?.username && profile?.email) {
      const isAutoGenerated = isUsernameAutoGenerated(profile.username, profile.email);
      if (isAutoGenerated) {
        return null; // Don't show rate limit errors for auto-generated usernames
      }
    }
    
    if (limit && !limit.canChange && isFieldBeingChanged) {
      // Prioritize the translated string from the translation file
      const translatedError = t(`fields.${fieldName}.rateLimitError`);
      // Fallback to limit.errorMessage only if translation is not found or is empty
      const displayMessage = translatedError && !translatedError.startsWith('fields.') ? translatedError : limit.errorMessage;

      if (displayMessage) {
        return (
          <p className="text-xs text-red-400 mt-1 animate-pulse">
            {displayMessage}
          </p>
        );
      }
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-slate-900 relative" style={{ overflow: 'visible' }}>
      {/* Loading overlay for saving, deleting, and auto-navigation */}
      {(isSaving || isDeleting || isAutoNavigating) && (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="text-center space-y-6">
            <div className="relative w-12 h-12 flex items-center justify-center mx-auto">
              <div className="triangle-loader-outer w-12 h-12 border-l-[24px] border-r-[24px] border-b-[48px] border-b-purple-800/70 absolute animate-pulse"></div>
              <div className="triangle-loader-inner w-8 h-8 border-l-[16px] border-r-[16px] border-b-[32px] border-b-purple-800/70 absolute top-[4px] left-[4px] animate-pulse" style={{animationDelay: '0.2s'}}></div>
            </div>
            <div className="space-y-2">
              {isSaving ? (
                <>
                                <p className="text-white text-xl font-medium">{tLoading('saving')}</p>
              <p className="text-gray-400 text-base">{tLoading('updatingSettings')}</p>
                </>
              ) : isDeleting ? (
                <>
                                <p className="text-white text-xl font-medium">{tLoading('deletingAccount')}</p>
              <p className="text-gray-400 text-base">{tLoading('deletingWarning')}</p>
                </>
              ) : (
                <>
                                <p className="text-white text-xl font-medium">{tLoading('autoNavigating')}</p>
              <p className="text-gray-400 text-base">
                Moving to {autoNavigationTarget ? t(`menu.${autoNavigationTarget}`) : tLoading('nextSection')}
              </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Static, subtle background element - replace busy animations with a very faint, almost imperceptible detail */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(124,58,237,0.01)_0%,transparent_70%)]"></div>
      
      <div className="relative z-10 px-2 sm:px-4 lg:px-6 py-8 sm:py-12 smooth-scroll w-full max-w-none lg:max-w-7xl lg:mx-auto">
        {/* Header (removed redundant section) */}
        <div className="text-center mb-8 sm:mb-12 lg:mb-16 space-y-4 animate-float">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white tracking-tight leading-tight alliance-text-gradient">
            {t('title')}
          </h1>
          <p className="text-gray-400 text-lg sm:text-xl font-light tracking-normal opacity-90 max-w-3xl mx-auto leading-relaxed">
            {t('subtitle')}
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-4 sm:gap-6 lg:gap-10 w-full max-w-none lg:max-w-6xl lg:mx-auto">
          {/* Enhanced Sidebar - Hidden on mobile, visible on desktop */}
          <div className="hidden lg:block lg:w-80 flex-shrink-0">
            <Card className="glass-sidebar shadow-glow-xl overflow-hidden border-none rounded-sm relative">
              {/* Unified metallic shine overlay - synchronized */}
              <div className="absolute inset-0 animate-metallic-shine pointer-events-none rounded-sm"></div>
              
              <CardHeader className="relative p-4 sm:p-6 border-b border-gray-700/30 rounded-sm z-10">
                <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-12 h-0.5 bg-gradient-to-r from-transparent via-purple-800/50 to-transparent"></div>
              </CardHeader>
              <CardContent className="space-y-3 relative p-4 sm:p-6 rounded-sm z-10">
                <div className="mb-6 sm:mb-8 p-4 sm:p-5 bg-gray-900/40 border border-gray-700/50 rounded-sm shadow-inner relative overflow-hidden">
                  {/* Subtle moving gradient background */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-purple-800/5 to-transparent animate-pulse opacity-30"></div>
                  <div className="absolute inset-0 bg-gradient-to-l from-transparent via-purple-900/3 to-transparent animate-pulse opacity-20" style={{animationDelay: '1s'}}></div>
                  
                  <div className="relative z-10">
                    <div className="text-center mb-4">
                      <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-1">
                        {t('profile.profileCompletion')}
                      </h3>
                      <div className="text-3xl font-bold text-white mb-2">
                        {profileCompletion}%
                      </div>
                    </div>
                    
                    <div className="relative">
                      <div className="w-full bg-gray-700/60 rounded-full h-2 relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-gray-700/40 to-gray-600/40 rounded-full"></div>
                        <div
                          className="bg-gradient-to-r from-purple-800 to-purple-800 h-full rounded-full transition-all duration-700 ease-out relative overflow-hidden"
                          style={{ width: `${profileCompletion}%` }}
                        >
                          {/* Subtle shimmer effect */}
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {[
                  { key: 'participation', label: t('menu.participation') },
                  { key: 'finance', label: t('menu.finance') },
                  { key: 'profile', label: t('menu.profile') },
                  { key: 'contact', label: t('menu.contact') },
                  { key: 'professional', label: t('menu.professional') },
                  { key: 'location', label: t('menu.location') },
                  { key: 'settings', label: t('menu.settings') }
                ].map((section, index) => {
                  const isCompleted = isSectionCompletedSync(section.key as SettingsSection);
                  return (
                    <button
                    key={section.key}
                    onClick={() => {
                      // Immediate visual feedback
                      const button = document.activeElement as HTMLButtonElement;
                      if (button) {
                        button.style.transform = 'scale(0.98) translateX(1px)';
                        button.style.opacity = '0.8';
                        setTimeout(() => {
                          button.style.transform = '';
                          button.style.opacity = '';
                        }, 100);
                      }
                      setActiveSection(section.key as SettingsSection);
                    }}
                    className={`sidebar-item w-full text-left px-3 sm:px-4 lg:px-6 py-3 sm:py-4 rounded-sm relative overflow-hidden group transform hover:translate-x-1 touch-manipulation whitespace-normal leading-tight text-sm sm:text-base min-h-[3rem] flex items-center
                      ${activeSection === section.key
                        ? 'active bg-gradient-to-r from-purple-800/10 via-purple-800/5 to-transparent text-purple-300 border border-purple-800/20 shadow-md scale-[1.02]'
                        : 'text-gray-400 hover:text-white hover:bg-gray-800/30'}
                    `}
                    style={{ 
                      marginBottom: index < 5 ? '6px' : '0'
                    }}
                  >
                    {/* Enhanced hover gradient - simplified */}
                    {activeSection !== section.key && (
                      <div className="absolute inset-0 bg-gradient-to-r from-purple-800/2 via-purple-800/1 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-sm"></div>
                    )}
                    
                    <span className="relative z-10 font-medium tracking-normal text-base leading-relaxed transition-all duration-200 group-hover:translate-x-1">
                      {section.label}
                      {isCompleted && (
                        <span className="ml-2 inline-flex items-center justify-center w-5 h-5 bg-green-500/20 border border-green-500/50 rounded-full">
                          <span className="text-green-400 text-xs">✓</span>
                        </span>
                      )}
                    </span>
                    
                    {/* Subtle metallic shine effect - faster */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/1 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-600 ease-in-out"></div>
                  </button>
                  );
                })}
              </CardContent>
            </Card>
          </div>

          {/* Mobile Profile Completion Card - Only visible on mobile */}
          <div className="lg:hidden w-full mb-4">
            <Card className="glass-card shadow-glow-xl overflow-hidden border-none rounded-sm relative">
              {/* Unified metallic shine overlay */}
              <div className="absolute inset-0 animate-metallic-shine pointer-events-none rounded-sm"></div>
              
              <CardContent className="relative p-4 rounded-sm z-10">
                <div className="p-4 bg-gray-900/40 border border-gray-700/50 rounded-sm shadow-inner relative overflow-hidden">
                  {/* Subtle moving gradient background */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-purple-800/5 to-transparent animate-pulse opacity-30"></div>
                  <div className="absolute inset-0 bg-gradient-to-l from-transparent via-purple-900/3 to-transparent animate-pulse opacity-20" style={{animationDelay: '1s'}}></div>
                  
                  <div className="relative z-10">
                    <div className="text-center mb-4">
                      <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-1">
                        {t('profile.profileCompletion')}
                      </h3>
                      <div className="text-3xl font-bold text-white mb-2">
                        {profileCompletion}%
                      </div>
                    </div>
                    
                    <div className="relative">
                      <div className="w-full bg-gray-700/60 rounded-full h-2 relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-gray-700/40 to-gray-600/40 rounded-full"></div>
                        <div
                          className="bg-gradient-to-r from-purple-800 to-purple-800 h-full rounded-full transition-all duration-700 ease-out relative overflow-hidden"
                          style={{ width: `${profileCompletion}%` }}
                        >
                          {/* Subtle shimmer effect */}
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Mobile Settings Navigation Dropdown - Only visible on mobile */}
          <div className="lg:hidden w-full mb-4">
            <SettingsMobileDropdown 
              activeSection={activeSection}
              setActiveSection={setActiveSection}
              sections={[
                { key: 'participation', label: t('menu.participation') },
                { key: 'finance', label: t('menu.finance') },
                { key: 'profile', label: t('menu.profile') },
                { key: 'contact', label: t('menu.contact') },
                { key: 'professional', label: t('menu.professional') },
                { key: 'location', label: t('menu.location') },
                { key: 'settings', label: t('menu.settings') }
              ]}
              isSectionCompletedSync={isSectionCompletedSync}
              t={t}
            />
          </div>

          {/* Enhanced Main Content - Transparent background, rounded-sm */}
          <div className="flex-1 w-full">
            <Card className="glass-card shadow-glow-xl border-none rounded-sm relative" style={{ overflow: 'visible' }}>
              {/* Unified metallic shine overlay - synchronized */}
              <div className="absolute inset-0 animate-metallic-shine pointer-events-none rounded-sm"></div>
              
              <CardHeader className="relative p-4 sm:p-6 border-b border-gray-700/30 rounded-sm z-10">
                <CardTitle className="text-white text-2xl sm:text-3xl font-bold tracking-tight text-center">
                  {t(`categories.${getSectionTitleKey(activeSection)}.title`)}
                </CardTitle>
              </CardHeader>
              <CardContent className="relative p-4 sm:p-6 lg:p-8 rounded-sm z-10" style={{ overflow: 'visible', minHeight: 'auto' }}>
                {/* Profile Section */}
                {activeSection === 'profile' && (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="username-field" className="text-white">{t('fields.username.label')}</Label>
                      <Input
                        id="username-field"
                        name="username"
                        placeholder={t('fields.username.placeholder')}
                        value={getValue('username')}
                        onChange={(e) => handleChange('username', e.target.value)}
                        onBlur={(e) => handleBlur('username', e.target.value)}
                        className="form-input-enhanced text-white w-full px-4 py-2 rounded-sm bg-gray-900/60 border border-gray-700 focus:border-purple-800 focus:ring-1 focus:ring-purple-800"
                        disabled={
                          fieldLimits.username?.canChange === false && 
                          !(profile?.username && profile?.email && isUsernameAutoGenerated(profile.username, profile.email))
                        }
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        {profile?.username && profile?.email && isUsernameAutoGenerated(profile.username, profile.email)
                          ? t('fields.username.autoGeneratedDescription')
                          : t('fields.username.description')
                        }
                      </p>
                      {usernameError && (
                        <p className="text-xs text-red-400 mt-1 animate-pulse">
                          {usernameError}
                        </p>
                      )}
                      {renderFieldError('username')}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="first-name-field" className="text-white">{t('fields.firstName.label')}</Label>
                        <Input
                          id="first-name-field"
                          name="first_name"
                          placeholder={t('fields.firstName.placeholder')}
                          value={getValue('first_name')}
                          onChange={(e) => handleChange('first_name', e.target.value)}
                          className="form-input-enhanced text-white w-full px-4 py-2 rounded-sm bg-gray-900/60 border border-gray-700 focus:border-purple-800 focus:ring-1 focus:ring-purple-800"
                          disabled={fieldLimits.first_name?.canChange === false}
                        />
                        {renderFieldError('first_name')}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="last-name-field" className="text-white">{t('fields.lastName.label')}</Label>
                        <Input
                          id="last-name-field"
                          name="last_name"
                          placeholder={t('fields.lastName.placeholder')}
                          value={getValue('last_name')}
                          onChange={(e) => handleChange('last_name', e.target.value)}
                          className="form-input-enhanced text-white w-full px-4 py-2 rounded-sm bg-gray-900/60 border border-gray-700 focus:border-purple-800 focus:ring-1 focus:ring-purple-800"
                          disabled={fieldLimits.last_name?.canChange === false}
                        />
                        {renderFieldError('last_name')}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="bio-field" className="text-white">{t('fields.bio.label')}</Label>
                      <Textarea
                        id="bio-field"
                        name="bio"
                        placeholder={t('fields.bio.placeholder')}
                        value={getValue('bio')}
                        onChange={(e) => handleChange('bio', e.target.value)}
                        className="form-input-enhanced text-white w-full px-4 py-2 rounded-sm bg-gray-900/60 border border-gray-700 focus:border-purple-800 focus:ring-1 focus:ring-purple-800"
                        rows={4}
                        disabled={fieldLimits.bio?.canChange === false}
                      />
                      {renderFieldError('bio')}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="website-field" className="text-white">{t('fields.website.label')}</Label>
                      <Input
                        id="website-field"
                        name="website"
                        placeholder={t('fields.website.placeholder')}
                        value={getValue('website')}
                        onChange={(e) => handleChange('website', e.target.value)}
                        onBlur={(e) => handleBlur('website', e.target.value)}
                        className="form-input-enhanced text-white w-full px-4 py-2 rounded-sm bg-gray-900/60 border border-gray-700 focus:border-purple-800 focus:ring-1 focus:ring-purple-800"
                        disabled={fieldLimits.website?.canChange === false}
                      />
                      {renderFieldError('website')}
                    </div>
                  </div>
                )}

                {/* Contact Section */}
                {activeSection === 'contact' && (
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="phone-field" className="text-white">{t('fields.phone.label')}</Label>
                                                  <Input
                            id="phone-field"
                            name="phone"
                            placeholder={t('fields.phone.placeholder')}
                            value={getValue('phone')}
                            onChange={(e) => handleChange('phone', e.target.value)}
                            onBlur={(e) => handleBlur('phone', e.target.value)}
                            className="form-input-enhanced text-white w-full px-4 py-2 rounded-sm bg-gray-900/60 border border-gray-700 focus:border-purple-800 focus:ring-1 focus:ring-purple-800"
                          />
                        <p className="text-xs text-gray-500 mt-1">{t('fields.phone.description')}</p>
                        {phoneError && (
                          <p className="text-xs text-red-400 mt-1 animate-pulse">
                            {phoneError}
                          </p>
                        )}
                        {renderFieldError('phone')}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="contact-comment-field" className="text-white">{t('fields.contactComment.label')}</Label>
                        <Textarea
                          id="contact-comment-field"
                          name="contact_comment"
                          placeholder={t('fields.contactComment.placeholder')}
                          value={getValue('contact_comment')}
                          onChange={(e) => handleChange('contact_comment', e.target.value)}
                          className="form-input-enhanced text-white w-full px-4 py-2 rounded-sm bg-gray-900/60 border border-gray-700 focus:border-purple-800 focus:ring-1 focus:ring-purple-800"
                          rows={4}
                        />
                      </div>
                    </div>

                    <div className="border-t border-gray-700/30 pt-6">
                      <h3 className="text-white font-medium mb-4 text-lg">{t('consent.title')}</h3>
                      <div className="space-y-4">
                        <div className="flex items-start space-x-3">
                          <Checkbox
                            id="direct-contact"
                            checked={getBooleanValue('direct_contact_consent')}
                            onCheckedChange={(checked) => handleChange('direct_contact_consent', checked)}
                            className="mt-1 text-purple-800 border-gray-600 focus:ring-purple-800 focus:ring-offset-black rounded-sm"
                          />
                          <div className="space-y-1">
                            <Label htmlFor="direct-contact" className="text-white text-base font-medium">
                              {t('consent.directContact.label')}
                            </Label>
                            <p className="text-sm text-gray-400">{t('consent.directContact.description')}</p>
                          </div>
                        </div>

                        <div className="flex items-start space-x-3">
                          <Checkbox
                            id="newsletter"
                            checked={getBooleanValue('newsletter_consent')}
                            onCheckedChange={(checked) => handleChange('newsletter_consent', checked)}
                            className="mt-1 text-purple-800 border-gray-600 focus:ring-purple-800 focus:ring-offset-black rounded-sm"
                          />
                          <div className="space-y-1">
                            <Label htmlFor="newsletter" className="text-white text-base font-medium">
                              {t('consent.newsletter.label')}
                            </Label>
                            <p className="text-sm text-gray-400">{t('consent.newsletter.description')}</p>
                          </div>
                        </div>

                        <p className="text-xs text-gray-500 mt-4">{t('consent.privacyNotice')}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Professional Section */}
                {activeSection === 'professional' && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="profession-field" className="text-white">{t('fields.profession.label')}</Label>
                        <Select
                          value={getValue('profession')}
                          onValueChange={(value: string) => handleChange('profession', value)}
                        >
                          <SelectTrigger id="profession-field" className="form-select-enhanced text-white w-full px-4 py-2 rounded-sm bg-gray-900/60 border border-gray-700 focus:border-purple-800 focus:ring-1 focus:ring-purple-800">
                            <SelectValue placeholder={t('fields.profession.placeholder')} />
                          </SelectTrigger>
                          <SelectContent className="max-h-60 bg-slate-900 border-gray-700 text-white rounded-sm shadow-md">
                            {professionOptions.map((prof) => (
                              <SelectItem key={prof.value} value={prof.value} className="hover:bg-purple-900/20 focus:bg-purple-900/20 text-white rounded-sm">
                                {prof.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="experience-level-field" className="text-white">{t('fields.experienceLevel.label')}</Label>
                        <Select
                          value={getValue('experience_level')}
                          onValueChange={(value: string) => handleChange('experience_level', value as ExperienceLevel)}
                        >
                          <SelectTrigger id="experience-level-field" className="form-select-enhanced text-white w-full px-4 py-2 rounded-sm bg-gray-900/60 border border-gray-700 focus:border-purple-800 focus:ring-1 focus:ring-purple-800">
                            <SelectValue placeholder={tCommon('select')} />
                          </SelectTrigger>
                          <SelectContent className="max-h-60 bg-slate-900 border-gray-700 text-white rounded-sm shadow-md">
                            {experienceLevelOptions.map((level) => (
                              <SelectItem key={level.value} value={level.value} className="hover:bg-purple-900/20 focus:bg-purple-900/20 text-white rounded-sm">
                                {level.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="organization-field" className="text-white">{t('fields.organization.label')}</Label>
                      <Input
                        id="organization-field"
                        name="organization"
                        placeholder={t('fields.organization.placeholder')}
                        value={getValue('organization')}
                        onChange={(e) => handleChange('organization', e.target.value)}
                        className="form-input-enhanced text-white w-full px-4 py-2 rounded-sm bg-gray-900/60 border border-gray-700 focus:border-purple-800 focus:ring-1 focus:ring-purple-800"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="skills-field" className="text-white">{t('fields.skills.label')}</Label>
                      
                      {getArrayValue('skills').length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-3">
                          {getArrayValue('skills').map((skill) => (
                            <span
                              key={skill}
                              className="inline-flex items-center gap-1 px-3 py-1 bg-purple-800/20 text-purple-300 rounded-sm text-sm font-medium border border-purple-800/30 animate-scale-in"
                            >
                              {skill}
                              <button
                                type="button"
                                onClick={() => removeSkill(skill)}
                                className="ml-1 text-purple-200 hover:text-white transition-colors duration-200 focus:outline-none"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      )}

                                              <div className="relative">
                        <Input
                          id="skills-field"
                          name="skills"
                          placeholder={t('fields.skills.placeholder')}
                          value={skillInput}
                          onChange={(e) => {
                            const newValue = e.target.value;
                            
                            // Check if a space was added (mobile-friendly skill addition)
                            if (newValue.endsWith(' ') && newValue.trim() !== '') {
                              const skillToAdd = newValue.trim();
                              addSkill(skillToAdd);
                              return; // Don't update skillInput since addSkill clears it
                            }
                            
                            setSkillInput(newValue);
                            setShowSkillSuggestions(true); // Always show suggestions when typing
                          }}
                          onKeyDown={handleSkillInputKeyDown}
                          onFocus={() => setShowSkillSuggestions(true)} // Always show suggestions when focused
                          onBlur={() => {
                            // Add skill if there's text when navigating away (great for mobile UX)
                            if (skillInput.trim()) {
                              addSkill(skillInput.trim());
                            }
                            // Use a longer delay to allow clicks on suggestions
                            setTimeout(() => setShowSkillSuggestions(false), 300);
                          }}
                          className="form-input-enhanced text-white w-full px-4 py-2 rounded-sm bg-gray-900/60 border border-gray-700 focus:border-purple-800 focus:ring-1 focus:ring-purple-800"
                        />
                        
                        {showSkillSuggestions && filteredSkillSuggestions.length > 0 && (
                          <div className="absolute z-20 w-full mt-2 bg-slate-900 border border-gray-700 rounded-sm shadow-xl max-h-60 overflow-y-auto animate-scale-in origin-top-left">
                            {filteredSkillSuggestions.map((skill) => (
                              <button
                                key={skill.value}
                                type="button"
                                onMouseDown={(e) => {
                                  e.preventDefault(); // Prevent blur from firing
                                  addSkill(skill.value);
                                }}
                                onClick={(e) => e.preventDefault()} // Backup to prevent any issues
                                className="w-full px-4 py-3 text-left text-gray-300 hover:bg-purple-900/20 hover:text-white transition-colors duration-200 focus:bg-purple-900/20 focus:outline-none rounded-sm"
                              >
                                {skill.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="border-t border-gray-700/30 pt-6">
                      <div className="space-y-4">
                        <div className="flex items-start space-x-3">
                          <Checkbox
                            id="organization-representative"
                            checked={getBooleanValue('organization_representative')}
                            onCheckedChange={(checked) => handleChange('organization_representative', checked)}
                            className="mt-1 text-purple-800 border-gray-600 focus:ring-purple-800 focus:ring-offset-black rounded-sm"
                          />
                          <div className="space-y-1">
                            <Label htmlFor="organization-representative" className="text-white text-base font-medium">
                              {t('professional.organizationRepresentative.label')}
                            </Label>
                            <p className="text-sm text-gray-400">{t('professional.organizationRepresentative.description')}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="professional-comment-field" className="text-white">{t('fields.professionalComment.label')}</Label>
                      <Textarea
                        id="professional-comment-field"
                        name="professional_comment"
                        placeholder={t('fields.professionalComment.placeholder')}
                        value={getValue('professional_comment')}
                        onChange={(e) => handleChange('professional_comment', e.target.value)}
                        className="form-input-enhanced text-white w-full px-4 py-2 rounded-sm bg-gray-900/60 border border-gray-700 focus:border-purple-800 focus:ring-1 focus:ring-purple-800"
                        rows={4}
                      />
                    </div>
                  </div>
                )}

                {/* Participation Section - Redesigned with centered layout */}
                {activeSection === 'participation' && (
                  <div className="space-y-8">
                    <p 
                      className="text-gray-400 text-sm mb-6 text-center" 
                      dangerouslySetInnerHTML={{ __html: t('participation.description') }}
                    />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {(['member', 'expert', 'activist', 'supporter'] as ParticipationRole[]).map((role) => (
                        <div
                          key={role}
                          onClick={() => toggleParticipationRole(role)}
                          className={`interactive-card group relative p-8 rounded-sm cursor-pointer transition-all duration-300 gpu-accelerated overflow-hidden text-center min-h-[140px] flex flex-col justify-center
                            ${isParticipationRoleSelected(role)
                              ? 'selected bg-gradient-to-r from-purple-800/10 via-purple-800/5 to-transparent border border-purple-800/30 shadow-md'
                              : 'bg-gray-900/60 border border-gray-700 hover:border-gray-600 shadow-sm hover:shadow-md'}
                          `}
                        >
                          {!isParticipationRoleSelected(role) && (
                            <div className="absolute inset-0 bg-gradient-to-r from-purple-800/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-sm"></div>
                          )}
                          
                          <div className="relative flex flex-col justify-center space-y-4">
                            <h4 className={`font-bold text-xl transition-colors duration-200
                              ${isParticipationRoleSelected(role) 
                                ? 'text-purple-300' 
                                : 'text-white group-hover:text-gray-200'}
                            `}>
                              {t(`participation.roles.${role}.title`)}
                            </h4>
                            <div className="w-12 h-px bg-gradient-to-r from-transparent via-gray-500 to-transparent mx-auto"></div>
                            <p className={`text-sm leading-relaxed transition-colors duration-200 max-w-[200px] mx-auto
                              ${isParticipationRoleSelected(role)
                                ? 'text-purple-200/80'
                                : 'text-gray-400 group-hover:text-gray-300'}
                            `}>
                              {t(`participation.roles.${role}.description`)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Location Section */}
                {activeSection === 'location' && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="country-field" className="text-white">{t('fields.country.label')}</Label>
                        <Select
                          value={selectedCountry}
                          onValueChange={(value: string) => handleChange('country', value)}
                          disabled={countriesLoading}
                        >
                          <SelectTrigger id="country-field" className="form-select-enhanced text-white w-full px-4 py-2 rounded-sm bg-gray-900/60 border border-gray-700 focus:border-purple-800 focus:ring-1 focus:ring-purple-800">
                            <SelectValue placeholder={countriesLoading ? tLoading('loadingCountries') : t('fields.country.description')} />
                          </SelectTrigger>
                          <SelectContent className="max-h-60 bg-slate-900 border-gray-700 text-white rounded-sm shadow-md">
                            {countryOptions.map((country: { value: string; label: string; flag: string }) => (
                              <SelectItem key={country.value} value={country.value} className="hover:bg-purple-900/20 focus:bg-purple-900/20 text-white rounded-sm">
                                {country.flag && <span className="mr-2">{country.flag}</span>}
                                {country.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {selectedCountry && stateOptions.length > 0 && (
                        <div className="space-y-2">
                          <Label htmlFor="region-field" className="text-white">{t('fields.region.label')}</Label>
                          <Select
                            value={selectedRegion}
                            onValueChange={(value: string) => handleChange('region', value)}
                            disabled={statesLoading}
                          >
                            <SelectTrigger id="region-field" className="form-select-enhanced text-white w-full px-4 py-2 rounded-sm bg-gray-900/60 border border-gray-700 focus:border-purple-800 focus:ring-1 focus:ring-purple-800">
                              <SelectValue placeholder={statesLoading ? tLoading('loadingRegions') : t('fields.region.placeholder')} />
                            </SelectTrigger>
                            <SelectContent className="max-h-60 bg-slate-900 border-gray-700 text-white rounded-sm shadow-md">
                              {stateOptions.map((state: { value: string; label: string; countryCode: string }) => (
                                <SelectItem key={state.value} value={state.value} className="hover:bg-purple-900/20 focus:bg-purple-900/20 text-white rounded-sm">
                                  {state.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>

                    {selectedCountry && (
                      <div className="space-y-2">
                        <Label htmlFor="city-field" className="text-white">{t('fields.city.label')}</Label>
                        {citiesLoading ? (
                          <div className="form-input-enhanced text-white w-full px-4 py-2 rounded-sm bg-gray-900/60 border border-gray-700 flex items-center">
                            <div className="relative w-4 h-4 flex items-center justify-center mr-2">
                              <div className="triangle-loader-outer w-4 h-4 border-l-[8px] border-r-[8px] border-b-[16px] border-b-purple-800/50 absolute"></div>
                              <div className="triangle-loader-inner w-3 h-3 border-l-[6px] border-r-[6px] border-b-[12px] border-b-purple-800/50 absolute top-[1px] left-[1px]"></div>
                            </div>
                            <span className="text-gray-400">{tLoading('loadingCities')}</span>
                          </div>
                        ) : cityOptions.length > 0 ? (
                          <Select
                            value={getValue('city')}
                            onValueChange={(value: string) => handleChange('city', value)}
                          >
                            <SelectTrigger className="form-select-enhanced text-white w-full px-4 py-2 rounded-sm bg-gray-900/60 border border-gray-700 focus:border-purple-800 focus:ring-1 focus:ring-purple-800">
                              <SelectValue placeholder={t('fields.city.placeholder')} />
                            </SelectTrigger>
                            <SelectContent className="max-h-60 bg-slate-900 border-gray-700 text-white rounded-sm shadow-md">
                              {cityOptions.map((city: { value: string; label: string; countryCode: string; stateCode?: string }) => (
                                <SelectItem key={`${city.value}-${city.stateCode}`} value={city.value} className="hover:bg-purple-900/20 focus:bg-purple-900/20 text-white rounded-sm">
                                  {city.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            id="city-field"
                            name="city"
                            placeholder={t('fields.city.placeholder')}
                            value={getValue('city')}
                            onChange={(e) => handleChange('city', e.target.value)}
                            className="form-input-enhanced text-white w-full px-4 py-2 rounded-sm bg-gray-900/60 border border-gray-700 focus:border-purple-800 focus:ring-1 focus:ring-purple-800"
                          />
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Finance Section */}
                {activeSection === 'finance' && (
                  <div className="space-y-8">
                    {/* Checkout Messages */}
                    {checkoutMessage && (
                      <div className={`p-4 rounded-sm border ${
                        checkoutMessage.type === 'success' 
                          ? 'bg-green-500/10 border-green-500/30 text-green-300' 
                          : 'bg-red-500/10 border-red-500/30 text-red-300'
                      }`}>
                        <div className="flex items-center justify-between">
                          <span>{checkoutMessage.message}</span>
                          <button 
                            onClick={() => setCheckoutMessage(null)}
                            className="text-current hover:opacity-75"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Current Subscription Status */}
                    <div className="space-y-4">
                      <h3 className="text-white font-bold text-lg sm:text-xl text-center">
                        {tFinance('currentSupportStatus')}
                      </h3>
                      
                      {subscriptionLoading || paymentsLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <div className="relative w-6 h-6 flex items-center justify-center">
                            <div className="triangle-loader-outer w-6 h-6 border-l-[12px] border-r-[12px] border-b-[24px] border-b-purple-800/50 absolute"></div>
                            <div className="triangle-loader-inner w-4 h-4 border-l-[8px] border-r-[8px] border-b-[16px] border-b-purple-800/50 absolute top-[2px] left-[2px]"></div>
                          </div>
                          <span className="ml-3 text-gray-300">{tLoading('loadingSupportStatus')}</span>
                        </div>
                      ) : currentSubscription ? (
                        <div className="glass-card shadow-glow-md overflow-hidden border-none rounded-sm relative p-4 sm:p-6">
                          <div className="absolute inset-0 bg-gradient-to-r from-green-800/10 to-transparent rounded-sm"></div>
                          <div className="relative z-10 text-center space-y-2">
                            <div className="text-green-400 font-semibold text-lg">{tFinance('activeSubscription')}</div>
                            <div className="text-white font-medium">{currentSubscription.productName}</div>
                            <div className="text-gray-400 text-sm">
                              {tFinance('statusLabel')} {currentSubscription.status} • 
                              {tFinance('nextBilling')} {new Date(currentSubscription.currentPeriodEnd).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      ) : hasOneTimePayment ? (
                        <div className="glass-card shadow-glow-md overflow-hidden border-none rounded-sm relative p-4 sm:p-6">
                          <div className="absolute inset-0 bg-gradient-to-r from-blue-800/10 to-transparent rounded-sm"></div>
                          <div className="relative z-10 text-center space-y-2">
                            <div className="text-blue-400 font-semibold text-lg">{tFinance('oneTimeContributionMade')}</div>
                            <div className="text-white font-medium">{tFinance('thankYouSupport')}</div>
                            <div className="text-gray-400 text-sm">
                              {tFinance('successfulContribution')}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="glass-card shadow-glow-md overflow-hidden border-none rounded-sm relative p-4 sm:p-6">
                          <div className="absolute inset-0 bg-gradient-to-r from-yellow-800/10 to-transparent rounded-sm"></div>
                          <div className="relative z-10 text-center space-y-2">
                            <div className="text-yellow-400 font-semibold text-lg">{tFinance('noActiveSupport')}</div>
                            <div className="text-white font-medium">{tFinance('considerSupporting')}</div>
                            <div className="text-gray-400 text-sm">
                              {tFinance('chooseSupportOption')}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Available Plans */}
                    <div className="space-y-6">
                      <h3 className="text-white font-bold text-lg sm:text-xl text-center">
                        {tFinance('waysToSupport')}
                      </h3>
                      
                      {plansLoading ? (
                        <div className="flex items-center justify-center py-12">
                          <div className="relative w-8 h-8 flex items-center justify-center">
                            <div className="triangle-loader-outer w-8 h-8 border-l-[16px] border-r-[16px] border-b-[32px] border-b-purple-800/50 absolute"></div>
                            <div className="triangle-loader-inner w-6 h-6 border-l-[12px] border-r-[12px] border-b-[24px] border-b-purple-800/50 absolute top-[2px] left-[2px]"></div>
                          </div>
                          <span className="ml-3 text-gray-300">{tLoading('loadingPlans')}</span>
                        </div>
                      ) : availablePlans.length > 0 ? (
                        <div className="space-y-4">
                          {availablePlans.map((plan) => (
                            <div
                              key={plan.id}
                              className="glass-card shadow-glow-md overflow-hidden border-none rounded-sm relative p-4 sm:p-6 group transition-all duration-300 hover:scale-[1.02]"
                            >
                              {/* Subtle hover effect */}
                              <div className="absolute inset-0 bg-gradient-to-r from-purple-800/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-sm"></div>
                              
                              {/* Restructured card content with clear separation */}
                              <div className="relative z-10 space-y-4 sm:space-y-6">
                                {/* Title Section */}
                                <div className="border-b border-gray-700/20 pb-3 text-center">
                                  <h4 className="text-white font-bold text-xl sm:text-2xl">{plan.product_name}</h4>
                                </div>
                                
                                {/* Description Section */}
                                <div className="py-2 text-center">
                                  <p className="text-gray-400 leading-relaxed text-sm sm:text-base">
                                    {plan.product_description || tFinance('premiumFeatures')}
                                  </p>
                                </div>
                                
                                {/* Price and Button Section */}
                                <div className="pt-4 border-t border-gray-700/20">
                                  {plan.unit_amount === null ? (
                                    /* Pay-as-you-wish pricing - Stripe handles amount input natively */
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
                                      <div className="flex flex-col text-center sm:text-left">
                                        <div className="text-2xl sm:text-3xl font-bold text-purple-300 mb-1">
                                          {formatPrice(plan.unit_amount, plan.currency, plan.recurring_interval)}
                                        </div>
                                        <div className="text-xs sm:text-sm text-gray-400">
                                          {tFinance('chooseAmountStripe')}
                                        </div>
                                      </div>
                                      
                                      <Button 
                                        onClick={() => handleSelectPlan(plan.id)}
                                        disabled={checkoutLoading === plan.id}
                                        className="btn-enhanced bg-gradient-to-r from-purple-800 to-purple-900 hover:from-purple-900 hover:to-purple-950 text-white px-4 sm:px-6 py-3 rounded-sm font-medium transition-all duration-200 disabled:opacity-50 w-full sm:w-auto sm:ml-4 touch-manipulation text-center whitespace-normal leading-tight min-h-[3rem]"
                                      >
                                        {checkoutLoading === plan.id ? (
                                          <span className="flex items-center justify-center">
                                            <div className="relative w-4 h-4 flex items-center justify-center mr-2 flex-shrink-0">
                                              <div className="triangle-loader-outer w-4 h-4 border-l-[8px] border-r-[8px] border-b-[16px] border-b-white/50 absolute"></div>
                                              <div className="triangle-loader-inner w-3 h-3 border-l-[6px] border-r-[6px] border-b-[12px] border-b-white/50 absolute top-[1px] left-[1px]"></div>
                                            </div>
                                            <span className="text-sm">{tFinance('processing')}</span>
                                          </span>
                                        ) : (
                                          <span className="text-sm sm:text-base">{tFinance('contributeNow')}</span>
                                        )}
                                      </Button>
                                    </div>
                                  ) : (
                                    /* Fixed pricing */
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
                                      <div className="flex flex-col text-center sm:text-left">
                                        <div className="text-2xl sm:text-3xl font-bold text-purple-300 mb-1">
                                          {formatPrice(plan.unit_amount, plan.currency, plan.recurring_interval)}
                                        </div>
                                        {plan.recurring_interval && (
                                          <div className="text-xs sm:text-sm text-gray-400">
                                            {tFinance('perInterval', { interval: plan.recurring_interval })}
                                          </div>
                                        )}
                                      </div>
                                      
                                      <Button 
                                        onClick={() => handleSelectPlan(plan.id)}
                                        disabled={checkoutLoading === plan.id}
                                        className="btn-enhanced bg-gradient-to-r from-purple-800 to-purple-900 hover:from-purple-900 hover:to-purple-950 text-white px-4 sm:px-6 py-3 rounded-sm font-medium transition-all duration-200 disabled:opacity-50 w-full sm:w-auto sm:ml-4 touch-manipulation text-center whitespace-normal leading-tight min-h-[3rem]"
                                      >
                                        {checkoutLoading === plan.id ? (
                                          <span className="flex items-center justify-center">
                                            <div className="relative w-4 h-4 flex items-center justify-center mr-2 flex-shrink-0">
                                              <div className="triangle-loader-outer w-4 h-4 border-l-[8px] border-r-[8px] border-b-[16px] border-b-white/50 absolute"></div>
                                              <div className="triangle-loader-inner w-3 h-3 border-l-[6px] border-r-[6px] border-b-[12px] border-b-white/50 absolute top-[1px] left-[1px]"></div>
                                            </div>
                                            <span className="text-sm">{tFinance('processing')}</span>
                                          </span>
                                        ) : currentSubscription ? (
                                          <span className="text-sm sm:text-base">{tFinance('changeSupportLevel')}</span>
                                        ) : (
                                          <span className="text-sm sm:text-base">{tFinance('startSupporting')}</span>
                                        )}
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-12">
                          <div className="text-gray-400 text-lg mb-2">{tFinance('noPlansAvailable')}</div>
                          <p className="text-sm text-gray-500">{tFinance('plansAvailableOnce')}</p>
                        </div>
                      )}
                    </div>

                    {/* Billing & Account Management */}
                    <div className="space-y-6">
                      <h3 className="text-white font-bold text-lg sm:text-xl text-center">
                        {tFinance('billingAccountManagement')}
                      </h3>
                      
                      <div className="glass-card shadow-glow-md overflow-hidden border-none rounded-sm relative p-4 sm:p-6">
                        <div className="absolute inset-0 animate-metallic-shine pointer-events-none rounded-sm"></div>
                        
                        <div className="relative z-10">
                          <div className="text-center py-6 sm:py-8 space-y-4">
                            <div className="text-gray-400 text-sm sm:text-base">
                              {currentSubscription 
                                ? tFinance('manageSubscriptionDescription')
                                : tFinance('accessAccountDescription')
                              }
                            </div>
                            <div className="space-y-2">
                              <Button
                                variant="outline"
                                onClick={handleManageSubscription}
                                className="btn-enhanced text-white px-4 sm:px-6 py-2 rounded-sm font-medium border border-gray-700 bg-gray-800 hover:bg-gray-700 transition-all duration-200 w-full sm:w-auto touch-manipulation text-center whitespace-normal leading-tight min-h-[2.5rem] text-sm sm:text-base"
                              >
                                {currentSubscription ? tFinance('manageSubscriptionBilling') : tFinance('accessBillingPortal')}
                              </Button>
                              <div className="text-xs text-gray-500 max-w-md mx-auto px-2">
                                {tFinance('stripePortalDescription')}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Settings/Account Section */}
                {activeSection === 'settings' && (
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-white font-medium mb-2 text-lg">{t('account.changeEmail.title')}</h3>
                        <p className="text-gray-400 text-sm mb-4">{t('fields.email.confirmationRequired')}</p>
                        <Button
                          variant="outline"
                          className="btn-enhanced text-white px-4 sm:px-6 py-3 rounded-sm font-medium border border-gray-700 bg-gray-800 hover:bg-gray-700 transition-all duration-200 hover:text-white touch-manipulation text-center whitespace-normal leading-tight min-h-[3rem] text-sm sm:text-base w-full sm:w-auto"
                          onClick={() => {
                            setShowChangeEmailModal(true);
                            setNewEmail('');
                            setChangeEmailError(null);
                            setChangeEmailSuccess(false);
                          }}
                        >
                          {t('account.changeEmail.button')}
                        </Button>
                      </div>

                      <div>
                        <h3 className="text-white font-medium mb-2 text-lg">{t('account.changePassword.title')}</h3>
                        <Button
                          variant="outline"
                          className="btn-enhanced text-white px-4 sm:px-6 py-3 rounded-sm font-medium border border-gray-700 bg-gray-800 hover:bg-gray-700 transition-all duration-200 hover:text-white touch-manipulation text-center whitespace-normal leading-tight min-h-[3rem] text-sm sm:text-base w-full sm:w-auto"
                          onClick={() => {
                            setShowChangePasswordModal(true);
                            setNewPassword('');
                            setConfirmNewPassword('');
                            setChangePasswordError(null);
                            setChangePasswordSuccess(false);
                          }}
                        >
                          {t('account.changePassword.button')}
                        </Button>
                      </div>
                    </div>

                    <div className="border-t border-gray-700/30 pt-6">
                      <div className="bg-red-900/10 border border-red-800/30 rounded-sm p-6 shadow-md">
                        <h3 className="text-red-400 font-medium mb-2 text-lg">{t('account.deleteAccount.title')}</h3>
                        <p className="text-gray-400 text-sm mb-4">{t('account.deleteAccount.description')}</p>
                        <p className="text-red-400 text-sm mb-4">{t('account.deleteAccount.warning')}</p>
                        <p className="text-orange-400 text-sm mb-4 font-medium">{t('account.deleteAccount.subscriptionWarning')}</p>
                        
                        <div className="space-y-4">
                          <Input
                            id="delete-confirm-field"
                            name="delete_confirm"
                            placeholder={t('account.deleteAccount.confirmPlaceholder')}
                            value={deleteConfirmText}
                            onChange={(e) => setDeleteConfirmText(e.target.value)}
                            className="form-input-enhanced text-white w-full px-4 py-2 rounded-sm bg-red-900/60 border border-red-700 focus:border-red-500 focus:ring-1 focus:ring-red-500"
                          />
                          
                          <Button
                            variant="destructive"
                            onClick={handleDeleteAccount}
                            disabled={deleteConfirmText !== 'DELETE' || isDeleting}
                            className="btn-enhanced relative bg-red-600 hover:bg-red-700 text-white px-6 sm:px-8 py-3 rounded-sm font-semibold tracking-wide transition-all duration-200 transform hover:scale-105 shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none gpu-accelerated touch-manipulation text-center whitespace-normal leading-tight min-h-[3rem] text-sm sm:text-base w-full sm:w-auto"
                          >
{t('account.deleteAccount.button')}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Change Email Modal */}
                {showChangeEmailModal && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/75 backdrop-blur-md animate-fade-in">
                    <div className="glass-card shadow-glow-xl overflow-hidden border-none rounded-sm relative p-8 max-w-md w-full">
                      {/* Unified metallic shine overlay */}
                      <div className="absolute inset-0 animate-metallic-shine pointer-events-none rounded-sm"></div>
                      
                      <div className="relative z-10">
                        <button
                          onClick={() => setShowChangeEmailModal(false)}
                          className="absolute top-0 right-0 text-gray-400 hover:text-white transition-colors"
                        >
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                        </button>
                        <h3 className="text-white font-bold text-2xl mb-6">{t('account.changeEmail.title')}</h3>
                        {changeEmailSuccess ? (
                          <div className="bg-green-900/20 border border-green-700/50 text-green-300 p-4 rounded-sm mb-4">
                            {t('account.changeEmail.success')}
                          </div>
                        ) : (
                          <>
                            <div className="space-y-4 mb-6">
                              <Label htmlFor="new-email" className="text-white">{t('fields.email.label')}</Label>
                              <Input
                                id="new-email"
                                name="new_email"
                                type="email"
                                placeholder={t('fields.email.placeholder')}
                                value={newEmail}
                                onChange={(e) => setNewEmail(e.target.value)}
                                className="form-input-enhanced text-white w-full px-4 py-2 rounded-sm focus:border-purple-800 focus:ring-1 focus:ring-purple-800"
                              />
                              {changeEmailError && (
                                <p className="text-sm text-red-400">{changeEmailError}</p>
                              )}
                              <p className="text-xs text-gray-400">{t('fields.email.confirmationRequired')}</p>
                            </div>
                            <Button
                              onClick={handleChangeEmail}
                              className="btn-enhanced w-full bg-purple-800 hover:bg-purple-900 text-white px-4 sm:px-6 py-3 rounded-sm font-semibold tracking-wide transition-all duration-200 touch-manipulation text-center whitespace-normal leading-tight min-h-[3rem] text-sm sm:text-base"
                            >
                              {t('account.changeEmail.button')}
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Change Password Modal */}
                {showChangePasswordModal && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/75 backdrop-blur-md animate-fade-in">
                    <div className="glass-card shadow-glow-xl overflow-hidden border-none rounded-sm relative p-8 max-w-md w-full">
                      {/* Unified metallic shine overlay */}
                      <div className="absolute inset-0 animate-metallic-shine pointer-events-none rounded-sm"></div>
                      
                      <div className="relative z-10">
                        <button
                          onClick={() => setShowChangePasswordModal(false)}
                          className="absolute top-0 right-0 text-gray-400 hover:text-white transition-colors"
                        >
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                        </button>
                        <h3 className="text-white font-bold text-2xl mb-6">{t('account.changePassword.title')}</h3>
                        {changePasswordSuccess ? (
                          <div className="bg-green-900/20 border border-green-700/50 text-green-300 p-4 rounded-sm mb-4">
                            {t('account.changePassword.success')}
                          </div>
                        ) : (
                          <>
                            <div className="space-y-4 mb-6">
                              <div className="space-y-2">
                                <Label htmlFor="new-password" className="text-white">{t('fields.password.newPassword')}</Label>
                                <Input
                                  id="new-password"
                                  name="new_password"
                                  type="password"
                                  placeholder={t('fields.password.newPasswordPlaceholder')}
                                  value={newPassword}
                                  onChange={(e) => setNewPassword(e.target.value)}
                                  className="form-input-enhanced text-white w-full px-4 py-2 rounded-sm focus:border-purple-800 focus:ring-1 focus:ring-purple-800"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="confirm-new-password" className="text-white">{t('fields.password.confirmNewPassword')}</Label>
                                <Input
                                  id="confirm-new-password"
                                  name="confirm_new_password"
                                  type="password"
                                  placeholder={t('fields.password.confirmNewPasswordPlaceholder')}
                                  value={confirmNewPassword}
                                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                                  className="form-input-enhanced text-white w-full px-4 py-2 rounded-sm focus:border-purple-800 focus:ring-1 focus:ring-purple-800"
                                />
                              </div>
                              {changePasswordError && (
                                <p className="text-sm text-red-400">{changePasswordError}</p>
                              )}
                            </div>
                            <Button
                              onClick={handleChangePassword}
                              className="btn-enhanced w-full bg-purple-800 hover:bg-purple-900 text-white px-4 sm:px-6 py-3 rounded-sm font-semibold tracking-wide transition-all duration-200 touch-manipulation text-center whitespace-normal leading-tight min-h-[3rem] text-sm sm:text-base"
                            >
                              {t('account.changePassword.button')}
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Enhanced Save Button - Consistent with other buttons */}
                {hasChanges && (
                  <div className="flex justify-end mt-10">
                    <Button 
                      onClick={handleSave}
                      disabled={isSaving}
                      className="btn-enhanced relative bg-gradient-to-r from-purple-800 to-purple-900 hover:from-purple-900 hover:to-purple-950 text-white px-6 sm:px-8 py-3 rounded-sm font-semibold tracking-wide transition-all duration-200 transform hover:scale-105 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none gpu-accelerated touch-manipulation text-center whitespace-normal leading-tight min-h-[3rem] text-sm sm:text-base"
                    >
                      {t('save')}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
} 