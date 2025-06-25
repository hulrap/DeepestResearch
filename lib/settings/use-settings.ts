'use client';

import { useState, useEffect, useCallback, useOptimistic } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { UserProfile, UserPreferences, SettingUpdatePayload } from './types';

type SettingsSection = 'profile' | 'contact' | 'professional' | 'participation' | 'location' | 'finance' | 'settings';

interface UseSettingsReturn {
  profile: UserProfile | null;
  preferences: UserPreferences;
  isLoading: boolean;
  error: string | null;
  updateSetting: (key: string, value: unknown) => Promise<void>;
  updateMultipleSettings: (updates: Record<string, unknown>) => Promise<void>;
  refreshProfile: () => Promise<void>;
  profileCompletion: number;
  checkSectionCompletion: (section: SettingsSection, profileData?: UserProfile) => Promise<boolean>;
}

export function useSettings(tValidation?: (key: string) => string): UseSettingsReturn {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profileCompletion, setProfileCompletion] = useState(0);
  
  // Optimistic updates for better UX
  const [optimisticPreferences, setOptimisticPreferences] = useOptimistic(
    profile?.preferences || {},
    (state: UserPreferences, update: SettingUpdatePayload | ((prevState: UserPreferences) => UserPreferences)) => {
      if (typeof update === 'function') {
        return update(state);
      } else {
        return {
          ...state,
          [update.key]: update.value,
        };
      }
    }
  );

  const supabase = createClient();

  // Check if a specific section is completed using the same logic as profile completion
  const checkSectionCompletion = useCallback(async (section: SettingsSection, profileData?: UserProfile): Promise<boolean> => {
    const currentProfile = profileData || profile;
    if (!currentProfile) return false;

    // Get consent values if needed
    let directContactConsent = false;
    let newsletterConsent = false;

    if (section === 'contact') {
      if (currentProfile.direct_contact_consent !== undefined && currentProfile.newsletter_consent !== undefined) {
        directContactConsent = currentProfile.direct_contact_consent;
        newsletterConsent = currentProfile.newsletter_consent;
      } else {
        try {
          const [directContactResult, newsletterResult] = await Promise.all([
            supabase.rpc('get_current_consent', { user_id: currentProfile.id, consent_type_param: 'direct_contact' }),
            supabase.rpc('get_current_consent', { user_id: currentProfile.id, consent_type_param: 'newsletter' })
          ]);

          directContactConsent = !directContactResult.error && directContactResult.data === true;
          newsletterConsent = !newsletterResult.error && newsletterResult.data === true;
        } catch {
          directContactConsent = false;
          newsletterConsent = false;
        }
      }
    }

    switch (section) {
      case 'participation':
        // Criteria 1: At least 1 participation role saved
        return Boolean(currentProfile.participation_role && Array.isArray(currentProfile.participation_role) && currentProfile.participation_role.length > 0);
      
      case 'profile':
        // Criteria 2, 3, 4, 17: first name, last name, bio, username
        return Boolean(currentProfile.first_name && currentProfile.last_name && currentProfile.preferences?.bio && currentProfile.username);
      
      case 'contact':
        // Criteria 5, 6, 7, 8: phone, direct consent, newsletter consent, contact comment
        return Boolean(currentProfile.phone && directContactConsent && newsletterConsent && currentProfile.preferences?.contact_comment);
      
      case 'professional':
        // Criteria 9, 10, 11, 12, 13: profession, experience, organization, skills, professional comment
        return Boolean(currentProfile.preferences?.profession && 
                      currentProfile.preferences?.experience_level && 
                      currentProfile.preferences?.organization && 
                      currentProfile.preferences?.skills && 
                      Array.isArray(currentProfile.preferences.skills) && 
                      currentProfile.preferences.skills.length > 0 && 
                      currentProfile.preferences?.professional_comment);
      
      case 'location':
        // Criteria 14, 15, 16: country, state, city
        return Boolean(currentProfile.preferences?.country && currentProfile.preferences?.region && currentProfile.preferences?.city);
      
      case 'finance':
        // Note: This will need to be checked against subscription status in UserSettings
        // We can't check it here as we don't have access to subscription data
        return false; // Will be overridden in UserSettings
      
      case 'settings':
        // Basic account setup: username + first name
        return Boolean(currentProfile.username && currentProfile.first_name);
      
      default:
        return false;
    }
  }, [profile, supabase]);

  // Calculate profile completion percentage
  const calculateProfileCompletion = useCallback(async (profileData: UserProfile): Promise<number> => {
    let completedFields = 0;
    let totalFields = 17; // Base fields from profile data
    
    // Check if user has made any payment (Stripe customer exists)
    let hasPayment = false;
    try {
      const { data: customerData } = await supabase
        .from('stripe_customers')
        .select('stripe_customer_id')
        .eq('id', profileData.id)
        .limit(1);
      
      hasPayment = Boolean(customerData && customerData.length > 0 && customerData[0].stripe_customer_id);
    } catch {
      hasPayment = false;
    }

    // Criteria 1: At least 1 participation role saved
    if (profileData.participation_role && Array.isArray(profileData.participation_role) && profileData.participation_role.length > 0) {
      completedFields++;
    }

    // Criteria 2: Has a first name
    if (profileData.first_name) {
      completedFields++;
    }

    // Criteria 3: Has a last name
    if (profileData.last_name) {
      completedFields++;
    }

    // Criteria 4: Has a bio
    if (profileData.preferences?.bio) {
      completedFields++;
    }

    // Criteria 5: Has a phone number
    if (profileData.phone) {
      completedFields++;
    }

    // Criteria 6 & 7: Check consent values - use cached values from enhanced profile if available
    let directContactConsent = false;
    let newsletterConsent = false;

    if (profileData.direct_contact_consent !== undefined && profileData.newsletter_consent !== undefined) {
      // Use cached consent values from enhanced profile
      directContactConsent = profileData.direct_contact_consent;
      newsletterConsent = profileData.newsletter_consent;
    } else {
      // Fallback to API calls only if not available in profile data
      try {
        const [directContactResult, newsletterResult] = await Promise.all([
          supabase.rpc('get_current_consent', { user_id: profileData.id, consent_type_param: 'direct_contact' }),
          supabase.rpc('get_current_consent', { user_id: profileData.id, consent_type_param: 'newsletter' })
        ]);

        directContactConsent = !directContactResult.error && directContactResult.data === true;
        newsletterConsent = !newsletterResult.error && newsletterResult.data === true;
      } catch {
        // Default to false if error occurs
        directContactConsent = false;
        newsletterConsent = false;
      }
    }

    if (directContactConsent) {
      completedFields++;
    }

    if (newsletterConsent) {
      completedFields++;
    }

    // Criteria 8: Contact Comment
    if (profileData.preferences?.contact_comment) {
      completedFields++;
    }

    // Criteria 9: Has a profession selected
    if (profileData.preferences?.profession) {
      completedFields++;
    }

    // Criteria 10: Has an experience level selected
    if (profileData.preferences?.experience_level) {
      completedFields++;
    }

    // Criteria 11: Has an organization typed in
    if (profileData.preferences?.organization) {
      completedFields++;
    }

    // Criteria 12: Has a skill/ability selected
    if (profileData.preferences?.skills && Array.isArray(profileData.preferences.skills) && profileData.preferences.skills.length > 0) {
      completedFields++;
    }

    // Criteria 13: Has a professional comment
    if (profileData.preferences?.professional_comment) {
      completedFields++;
    }

    // Criteria 14: Has a country (including preset AT)
    if (profileData.preferences?.country) {
      completedFields++;
    }

    // Criteria 15: Has a region/province
    if (profileData.preferences?.region) {
      completedFields++;
    }

    // Criteria 16: Has a city
    if (profileData.preferences?.city) {
      completedFields++;
    }
    
    // Criteria 17: Username exists (not necessarily manually changed)
    if (profileData.username) {
      completedFields++;
    }

    // Payment contribution: Add ~20% completion for any payment made
    // This ensures users can only reach 100% completion if they've contributed financially
    if (hasPayment) {
      completedFields += 4; // Add 4 fields for payment contribution (~20% of total)
      totalFields += 4;     // Adjust total to maintain percentage balance
    } else {
      // Without payment, user can only reach ~85% (17/20 = 85%)
      totalFields = 20;     // Set higher total so max without payment is 17/20 = 85%
    }

    const completionPercentage = Math.min(Math.round((completedFields / totalFields) * 100), 100);
    
    return completionPercentage;
  }, [supabase]);

  // Validate preferences structure
  const validatePreferences = useCallback((prefs: Record<string, unknown>, tValidation?: (key: string) => string): string | null => {
    try {
      // Validate language if present
      if (prefs.language && typeof prefs.language === 'string') {
        const validLanguages = ['en', 'de', 'fr', 'es', 'it', 'pt', 'nl', 'pl', 'ru', 'ja', 'ko', 'zh', 'ar', 'hi'];
        if (!validLanguages.includes(prefs.language)) {
          return tValidation ? tValidation('invalidLanguageCode') : 'invalidLanguageCode';
        }
      }

      // Validate experience level if present
      if (prefs.experience_level && typeof prefs.experience_level === 'string') {
        const validLevels = ['intern', 'entry', 'mid', 'senior', 'lead', 'executive'];
        if (!validLevels.includes(prefs.experience_level)) {
          return tValidation ? tValidation('invalidExperienceLevel') : 'invalidExperienceLevel';
        }
      }

      // Validate skills array if present
      if (prefs.skills && !Array.isArray(prefs.skills)) {
        return tValidation ? tValidation('skillsMustBeArray') : 'skillsMustBeArray';
      }

      // Validate string lengths
      if (prefs.bio && typeof prefs.bio === 'string' && prefs.bio.length > 500) {
        return tValidation ? tValidation('bioTooLong') : 'bioTooLong';
      }

      if (prefs.website && typeof prefs.website === 'string' && !prefs.website.match(/^https?:\/\/.+\..{2,}$/)) {
        return tValidation ? tValidation('invalidWebsite') : 'invalidWebsite';
      }

      return null;
    } catch {
      return tValidation ? tValidation('invalidPreferencesStructure') : 'invalidPreferencesStructure';
    }
  }, []);

  // Load user profile and preferences
  const loadProfile = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError) {
        setProfile(null);
        setProfileCompletion(0);
        throw new Error(tValidation ? tValidation('authenticationError') : 'authenticationError');
      }

      if (!user) {
        setProfile(null);
        // Ensure profileCompletion is updated when no user is found
        setProfileCompletion(0); 
        return;
      }

      // Try to use the enhanced profile function first
      let profileData;
      try {
        const { data: enhancedProfile, error: enhancedError } = await supabase
          .rpc('get_user_profile', { user_uuid: user.id });
        
        if (!enhancedError && enhancedProfile && enhancedProfile.length > 0) {
          profileData = enhancedProfile[0];
        } else {
          throw new Error('enhancedProfileFailed');
        }
      } catch {
        // Fallback to direct query
        const { data, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (profileError) {
          if (profileError.code === 'PGRST116' || profileError.code === '42P01') {
            // Profile doesn't exist, create it
            const defaultPreferences = {
              language: 'en',
              timezone: 'UTC',
              created_via: 'manual'
            };
            
            const { data: newProfile, error: createError } = await supabase
              .from('profiles')
              .insert({
                id: user.id,
                email: user.email,
                preferences: defaultPreferences,
              })
              .select()
              .single();

            if (createError) {
              throw new Error(tValidation ? tValidation('createProfileError') : 'createProfileError');
            }

            profileData = newProfile;
          } else {
            throw new Error(tValidation ? tValidation('loadProfileError') : 'loadProfileError');
          }
        } else {
          profileData = data;
        }
      }

      if (profileData) {
        // Ensure preferences is an object
        if (!profileData.preferences || typeof profileData.preferences !== 'object') {
          profileData.preferences = {};
        }

        // Validate preferences before setting
        const validationError = validatePreferences(profileData.preferences || {}, tValidation);
        if (validationError) {
          // Don't fail, just log the warning
        }
        
        setProfile(profileData);
        // Calculate and set completion after profile is loaded
        const completion = await calculateProfileCompletion(profileData);
        setProfileCompletion(completion);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : (tValidation ? tValidation('unknownError') : 'unknownError');
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [supabase, validatePreferences, calculateProfileCompletion, tValidation]);

  // Update a single setting with validation
  const updateSetting = useCallback(
    async (key: string, value: unknown) => {
      if (!profile) {
        throw new Error(tValidation ? tValidation('noProfileLoaded') : 'noProfileLoaded');
      }

      try {
        setError(null);
        
        // Create updated preferences
        const updatedPreferences = { ...profile.preferences };
        
        // Handle field deletion: remove empty strings, null, or undefined values
        if (value === '' || value === null || value === undefined) {
          delete updatedPreferences[key];
        } else {
          updatedPreferences[key] = value;
        }
        
        // Validate the updated preferences
        const validationError = validatePreferences(updatedPreferences, tValidation);
        if (validationError) {
          throw new Error(tValidation ? tValidation('validationError') : validationError);
        }
        
        // Optimistic update
        setOptimisticPreferences(prev => {
          const updated = { ...prev };
          if (value === '' || value === null || value === undefined) {
            delete updated[key];
          } else {
            updated[key] = value;
          }
          return updated;
        });

        const { error: updateError } = await supabase
          .from('profiles')
          .update({ 
            preferences: updatedPreferences,
            updated_at: new Date().toISOString(),
          })
          .eq('id', profile.id);

        if (updateError) {
          throw new Error(tValidation ? tValidation('updateSettingError') : 'updateSettingError');
        }

        // Update local state with the successful update
        setProfile(prev => prev ? {
          ...prev,
          preferences: updatedPreferences,
          updated_at: new Date().toISOString(),
        } : null);
        
        // Recalculate completion after successful update
        if (profile) {
          const completion = await calculateProfileCompletion({ ...profile, preferences: updatedPreferences });
          setProfileCompletion(completion);
        }

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : (tValidation ? tValidation('updateSettingFailed') : 'updateSettingFailed');
        setError(errorMessage);
        
        // Revert optimistic update on error
        await loadProfile();
      }
    }, [profile, supabase, validatePreferences, loadProfile, calculateProfileCompletion, setOptimisticPreferences, tValidation]);

  // Update multiple settings at once
  const updateMultipleSettings = useCallback(
    async (updates: Record<string, unknown>) => {
      if (!profile) {
        throw new Error(tValidation ? tValidation('noProfileLoaded') : 'noProfileLoaded');
      }

      try {
        setError(null);
        
        const newPreferences = { ...profile.preferences };
        
        // Handle multiple updates with proper field deletion
        Object.entries(updates).forEach(([key, value]) => {
          if (value === '' || value === null || value === undefined) {
            delete newPreferences[key];
          } else {
            newPreferences[key] = value;
          }
        });

        // Validate the updated preferences
        const validationError = validatePreferences(newPreferences, tValidation);
        if (validationError) {
          throw new Error(tValidation ? tValidation('validationError') : validationError);
        }

        // Optimistic update for multiple settings
        setOptimisticPreferences(prev => {
          const updated = { ...prev };
          Object.entries(updates).forEach(([key, value]) => {
            if (value === '' || value === null || value === undefined) {
              delete updated[key];
            } else {
              updated[key] = value;
            }
          });
          return updated;
        });

        const { error: updateError } = await supabase
          .from('profiles')
          .update({ 
            preferences: newPreferences,
            updated_at: new Date().toISOString(),
          })
          .eq('id', profile.id);

        if (updateError) {
          throw new Error(tValidation ? tValidation('updateMultipleSettingsError') : 'updateMultipleSettingsError');
        }

        setProfile(prev => prev ? {
          ...prev,
          preferences: newPreferences,
          updated_at: new Date().toISOString(),
        } : null);

        // Recalculate completion after successful update
        if (profile) {
          const completion = await calculateProfileCompletion({ ...profile, preferences: newPreferences });
          setProfileCompletion(completion);
        }

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : (tValidation ? tValidation('updateMultipleSettingsFailed') : 'updateMultipleSettingsFailed');
        setError(errorMessage);
        
        // Revert optimistic update on error
        await loadProfile();
      }
    }, [profile, supabase, validatePreferences, loadProfile, calculateProfileCompletion, setOptimisticPreferences, tValidation]);

  // Refresh profile data from the database
  const refreshProfile = useCallback(async () => {
    await loadProfile();
  }, [loadProfile]);

  // Load profile on mount and auth changes
  useEffect(() => {
    loadProfile();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      (event, _session) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          loadProfile();
        } else if (event === 'SIGNED_OUT') {
          setProfile(null);
          setIsLoading(false);
          setError(null);
          setProfileCompletion(0); // Reset completion on sign out
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [loadProfile, supabase.auth]);

  // Calculate profile completion (initial and on profile/preferences change)
  // This useEffect ensures completion is recalculated when profile or preferences change
  // even if not directly triggered by save.
  useEffect(() => {
    if (profile) {
      calculateProfileCompletion(profile).then(setProfileCompletion);
    } else {
      setProfileCompletion(0);
    }
  }, [profile, calculateProfileCompletion]);

  return {
    profile,
    preferences: optimisticPreferences,
    isLoading,
    error,
    updateSetting,
    updateMultipleSettings,
    refreshProfile,
    profileCompletion,
    checkSectionCompletion,
  };
} 