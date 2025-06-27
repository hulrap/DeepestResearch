'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useSettings } from '@/lib/settings/use-settings';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createClient } from '@/lib/supabase/client';
import type { SettingsSection, APIKeyCreateData, UserConfigurationUpdateData } from '@/lib/settings/types';

export function UserSettings() {
  // Translation hooks
  const t = useTranslations('settings');
  const locale = useLocale();

  // Settings hook
  const {
    profile,
    userConfiguration,
    isLoading,
    error,
    providers,
    userAPIKeys,
    providersLoading,

    recentUsage,
    usageLoading,
    currentSubscription,
    availablePlans,
    billingLoading,
    updateProfile,
    updateUserConfiguration,
    addAPIKey,
    removeAPIKey,
    refreshAll
  } = useSettings();

  // Local state
  const [activeSection, setActiveSection] = useState<SettingsSection>('profile');
  const [isSaving, setIsSaving] = useState(false);
  const [localChanges, setLocalChanges] = useState<Record<string, string>>({});
  const [showAPIKeyModal, setShowAPIKeyModal] = useState(false);
  const [newAPIKey, setNewAPIKey] = useState('');
  const [selectedProvider, setSelectedProvider] = useState('');
  const [keyName, setKeyName] = useState('');
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const supabase = createClient();

  // Handle profile field changes
  const handleChange = (key: string, value: string) => {
    setLocalChanges(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // Save profile changes
  const handleSave = async () => {
    if (Object.keys(localChanges).length === 0) return;

    setIsSaving(true);
    try {
      await updateProfile(localChanges);
      setLocalChanges({});
    } catch (err) {
      console.error('Failed to update profile:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Add new API key
  const handleAddAPIKey = async () => {
    if (!selectedProvider || !newAPIKey) {
      setApiKeyError(t('apiKeyError') || 'Please select a provider and enter an API key');
      return;
    }

    try {
      const apiKeyData: APIKeyCreateData = {
        provider_id: selectedProvider,
        api_key: newAPIKey, // Send the raw key
        key_name: keyName || undefined
      };

      await addAPIKey(apiKeyData);
      setShowAPIKeyModal(false);
      setNewAPIKey('');
      setSelectedProvider('');
      setKeyName('');
      setApiKeyError(null);
    } catch (err) {
      setApiKeyError(err instanceof Error ? err.message : t('apiKeyAddError') || 'Failed to add API key');
    }
  };

  // Remove API key
  const handleRemoveAPIKey = async (keyId: string) => {
    try {
      await removeAPIKey(keyId);
    } catch (err) {
      console.error('Failed to remove API key:', err);
    }
  };

  // Update user configuration
  const handleUpdateConfiguration = async (data: UserConfigurationUpdateData) => {
    try {
      await updateUserConfiguration(data);
    } catch (err) {
      console.error('Failed to update configuration:', err);
    }
  };

  // Handle Stripe billing
  const handleManageSubscription = async () => {
    try {
      const response = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale })
      });

      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error('Failed to open billing portal:', err);
    }
  };

  // Handle plan selection
  const handleSelectPlan = async (priceId: string) => {
    try {
      const response = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId, locale })
      });

      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error('Failed to start checkout:', err);
    }
  };

  // Delete account
  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') return;

    setIsDeleting(true);
    try {
      const response = await fetch('/api/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: profile?.id })
      });

      if (response.ok) {
        await supabase.auth.signOut();
        window.location.href = '/';
      }
    } catch (err) {
      console.error('Failed to delete account:', err);
    } finally {
      setIsDeleting(false);
      setDeleteConfirmText('');
    }
  };

  // Get field value
  const getValue = (key: string): string => {
    if (key in localChanges) {
      return localChanges[key];
    }
    if (profile && key in profile) {
      const value = profile[key as keyof typeof profile];
      return typeof value === 'string' ? value : '';
    }
    return '';
  };

  const hasChanges = Object.keys(localChanges).length > 0;

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center space-y-6">
          <div className="relative w-12 h-12 flex items-center justify-center mx-auto">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
          </div>
          <p className="text-white text-xl font-medium">{t('loading') || 'Loading Settings...'}</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center space-y-6">
          <p className="text-red-400 text-lg font-medium">{error}</p>
          <Button onClick={() => window.location.reload()} variant="outline">
            {t('tryAgain') || 'Try Again'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 relative">
      {/* Loading overlay */}
      {(isSaving || isDeleting) && (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="text-center space-y-6">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto"></div>
            <p className="text-white text-xl font-medium">
              {isSaving ? t('saving') || 'Saving Changes...' : t('deleting') || 'Deleting Account...'}
            </p>
          </div>
        </div>
      )}

      <div className="relative z-10 px-4 py-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12 space-y-4">
          <h1 className="text-5xl font-bold text-white">{t('title') || 'AI Platform Settings'}</h1>
          <p className="text-gray-400 text-xl">{t('subtitle') || 'Manage your AI workflow preferences and account'}</p>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar */}
          <div className="lg:w-80 flex-shrink-0">
            <Card className="bg-gray-900/50 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white">{t('settings') || 'Settings'}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {[
                  { key: 'profile', label: t('profile') || 'Profile' },
                  { key: 'ai-providers', label: t('aiProviders') || 'AI Providers' },
                  { key: 'usage-limits', label: t('usageLimits') || 'Usage & Limits' },
                  { key: 'billing', label: t('billing') || 'Billing' },
                  { key: 'account', label: t('account') || 'Account' }
                ].map((section) => (
                  <button
                    key={section.key}
                    onClick={() => setActiveSection(section.key as SettingsSection)}
                    className={`w-full text-left px-4 py-3 rounded-sm transition-colors ${
                      activeSection === section.key
                        ? 'bg-purple-800/20 text-purple-300 border border-purple-800/30'
                        : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                    }`}
                  >
                    {section.label}
                  </button>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className="flex-1">
            <Card className="bg-gray-900/50 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white text-2xl capitalize">
                  {activeSection.replace('-', ' ')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Profile Section */}
                {activeSection === 'profile' && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label className="text-white">{t('username') || 'Username'}</Label>
                        <Input
                          value={getValue('username')}
                          onChange={(e) => handleChange('username', e.target.value)}
                          placeholder={t('enterUsername') || 'Enter username'}
                          className="bg-gray-800 border-gray-600 text-white"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-white">{t('email') || 'Email'}</Label>
                        <Input
                          value={profile?.email || ''}
                          disabled
                          className="bg-gray-700 border-gray-600 text-gray-400"
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label className="text-white">{t('firstName') || 'First Name'}</Label>
                        <Input
                          value={getValue('first_name')}
                          onChange={(e) => handleChange('first_name', e.target.value)}
                          placeholder={t('enterFirstName') || 'Enter first name'}
                          className="bg-gray-800 border-gray-600 text-white"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-white">{t('lastName') || 'Last Name'}</Label>
                        <Input
                          value={getValue('last_name')}
                          onChange={(e) => handleChange('last_name', e.target.value)}
                          placeholder={t('enterLastName') || 'Enter last name'}
                          className="bg-gray-800 border-gray-600 text-white"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label className="text-white">{t('userType') || 'User Type'}</Label>
                        <Select 
                          value={getValue('user_type') || 'individual'} 
                          onValueChange={(value) => handleChange('user_type', value)}
                        >
                          <SelectTrigger className="bg-gray-800 border-gray-600 text-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="individual">Individual</SelectItem>
                            <SelectItem value="business">Business</SelectItem>
                            <SelectItem value="enterprise">Enterprise</SelectItem>
                            <SelectItem value="developer">Developer</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-white">{t('experienceLevel') || 'Experience Level'}</Label>
                        <Select 
                          value={getValue('experience_level') || 'beginner'} 
                          onValueChange={(value) => handleChange('experience_level', value)}
                        >
                          <SelectTrigger className="bg-gray-800 border-gray-600 text-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="beginner">Beginner</SelectItem>
                            <SelectItem value="intermediate">Intermediate</SelectItem>
                            <SelectItem value="advanced">Advanced</SelectItem>
                            <SelectItem value="expert">Expert</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {hasChanges && (
                      <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving ? 'Saving...' : 'Save Changes'}
                      </Button>
                    )}
                  </div>
                )}

                {/* AI Providers Section */}
                {activeSection === 'ai-providers' && (
                  <div className="space-y-6">
                    <div className="flex justify-between items-center">
                      <h3 className="text-white font-medium text-lg">{t('yourApiKeys') || 'Your API Keys'}</h3>
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={refreshAll}
                          disabled={providersLoading}
                        >
                          {providersLoading ? t('refreshing') || 'Refreshing...' : t('refresh') || 'Refresh'}
                        </Button>
                        <Button onClick={() => setShowAPIKeyModal(true)}>
                          {t('addApiKey') || 'Add API Key'}
                        </Button>
                      </div>
                    </div>

                    {providersLoading ? (
                      <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto"></div>
                        <p className="text-gray-400 mt-2">{t('loadingProviders') || 'Loading providers...'}</p>
                      </div>
                    ) : userAPIKeys.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-gray-400">{t('noApiKeys') || 'No API keys configured'}</p>
                        <p className="text-sm text-gray-500 mt-2">
                          {t('addApiKeysHelp') || 'Add API keys to enable AI model integrations'}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {userAPIKeys.map((key) => (
                          <div key={key.id} className="flex items-center justify-between p-4 bg-gray-800 rounded-sm">
                            <div>
                              <h4 className="text-white font-medium">{key.provider_display_name}</h4>
                              {key.key_name && (
                                <p className="text-sm text-gray-400">{key.key_name}</p>
                              )}
                              <p className="text-xs text-gray-500">
                                {t('added') || 'Added'} {new Date(key.created_at).toLocaleDateString()}
                              </p>
                              <p className="text-xs text-gray-500">
                                Usage: {key.usage_count} requests, ${key.total_cost_usd.toFixed(4)}
                              </p>
                            </div>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleRemoveAPIKey(key.id)}
                            >
                              {t('remove') || 'Remove'}
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* API Key Modal */}
                    {showAPIKeyModal && (
                      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                        <Card className="w-full max-w-md">
                          <CardHeader>
                            <CardTitle>{t('addApiKey') || 'Add API Key'}</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div className="space-y-2">
                              <Label>{t('provider') || 'Provider'}</Label>
                              <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                                <SelectTrigger>
                                  <SelectValue placeholder={t('selectProvider') || 'Select a provider'} />
                                </SelectTrigger>
                                <SelectContent>
                                  {providers.map((provider) => (
                                    <SelectItem key={provider.id} value={provider.id}>
                                      {provider.display_name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label>{t('keyName') || 'Key Name (Optional)'}</Label>
                              <Input
                                value={keyName}
                                onChange={(e) => setKeyName(e.target.value)}
                                placeholder={t('enterKeyName') || 'Enter key name'}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>{t('apiKey') || 'API Key'}</Label>
                              <Input
                                type="password"
                                value={newAPIKey}
                                onChange={(e) => setNewAPIKey(e.target.value)}
                                placeholder={t('enterApiKey') || 'Enter API key'}
                              />
                            </div>
                            {apiKeyError && (
                              <p className="text-red-400 text-sm">{apiKeyError}</p>
                            )}
                            <div className="flex gap-2">
                              <Button onClick={handleAddAPIKey}>
                                {t('add') || 'Add'}
                              </Button>
                              <Button variant="outline" onClick={() => setShowAPIKeyModal(false)}>
                                {t('cancel') || 'Cancel'}
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    )}
                  </div>
                )}

                {/* Usage & Limits Section */}
                {activeSection === 'usage-limits' && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-white font-medium text-lg mb-4">{t('usageLimitsTitle') || 'Usage Limits'}</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label className="text-white">{t('dailyLimit') || 'Daily Cost Limit'} (USD)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={userConfiguration?.preferred_daily_cost_limit || userConfiguration?.effective_daily_cost_limit || 10}
                            onChange={(e) => handleUpdateConfiguration({ preferred_daily_cost_limit: parseFloat(e.target.value) })}
                            className="bg-gray-800 border-gray-600 text-white"
                          />
                          <p className="text-xs text-gray-400">
                            Plan limit: ${userConfiguration?.plan_daily_cost_limit || 10}
                          </p>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-white">{t('monthlyLimit') || 'Monthly Cost Limit'} (USD)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={userConfiguration?.preferred_monthly_cost_limit || userConfiguration?.effective_monthly_cost_limit || 100}
                            onChange={(e) => handleUpdateConfiguration({ preferred_monthly_cost_limit: parseFloat(e.target.value) })}
                            className="bg-gray-800 border-gray-600 text-white"
                          />
                          <p className="text-xs text-gray-400">
                            Plan limit: ${userConfiguration?.plan_monthly_cost_limit || 100}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-white font-medium text-lg">{t('recentUsage') || 'Recent Usage'}</h3>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={refreshAll}
                          disabled={usageLoading}
                        >
                          {usageLoading ? t('refreshing') || 'Refreshing...' : t('refresh') || 'Refresh'}
                        </Button>
                      </div>
                      {usageLoading ? (
                        <div className="text-center py-4">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto"></div>
                        </div>
                      ) : recentUsage.length === 0 ? (
                        <p className="text-gray-400">{t('noUsageData') || 'No usage data available'}</p>
                      ) : (
                        <div className="space-y-2">
                          {recentUsage.slice(0, 5).map((usage) => (
                            <div key={usage.id} className="flex justify-between items-center p-3 bg-gray-800 rounded-sm">
                              <span className="text-white">{new Date(usage.period_start).toLocaleDateString()}</span>
                              <div className="text-right">
                                <p className="text-white">${usage.total_cost_usd.toFixed(4)}</p>
                                <p className="text-sm text-gray-400">{usage.total_tokens} {t('tokens') || 'tokens'}</p>
                                <p className="text-xs text-gray-500">{usage.total_requests} requests</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Billing Section */}
                {activeSection === 'billing' && (
                  <div className="space-y-6">
                    <div className="flex justify-between items-center">
                      <h3 className="text-white font-medium text-lg">{t('billingTitle') || 'Billing'}</h3>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={refreshAll}
                        disabled={billingLoading}
                      >
                        {billingLoading ? t('refreshing') || 'Refreshing...' : t('refresh') || 'Refresh'}
                      </Button>
                    </div>

                    {billingLoading ? (
                      <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto"></div>
                      </div>
                    ) : currentSubscription ? (
                      <div className="p-4 bg-green-900/20 border border-green-700/50 rounded-sm">
                        <h4 className="text-white font-medium mb-2">{t('currentPlan') || 'Current Plan'}</h4>
                        <p className="text-gray-300">Status: {currentSubscription.status}</p>
                        <p className="text-gray-300">Type: {currentSubscription.subscription_type}</p>
                        {currentSubscription.current_period_end && (
                          <p className="text-gray-300">
                            Next billing: {new Date(currentSubscription.current_period_end).toLocaleDateString()}
                          </p>
                        )}
                        <Button 
                          onClick={handleManageSubscription}
                          className="mt-4"
                          size="sm"
                        >
                          {t('manageBilling') || 'Manage Billing'}
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <p className="text-gray-400">{t('noActiveSubscription') || 'No active subscription'}</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {availablePlans.map((plan) => (
                            <div key={plan.id} className="p-4 bg-gray-800 border border-gray-700 rounded-sm">
                              <h4 className="text-white font-medium mb-2">{plan.plan_name}</h4>
                              {plan.plan_description && (
                                <p className="text-gray-400 text-sm mb-3">{plan.plan_description}</p>
                              )}
                              <p className="text-white text-lg font-bold mb-2">
                                ${(plan.unit_amount / 100).toFixed(2)}/{plan.billing_interval}
                              </p>
                              <Button 
                                onClick={() => handleSelectPlan(plan.stripe_price_id)}
                                size="sm"
                                className="w-full"
                              >
                                {t('selectPlan') || 'Select Plan'}
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Account Section */}
                {activeSection === 'account' && (
                  <div className="space-y-6">
                    <div className="p-4 bg-red-900/20 border border-red-700/50 rounded-sm">
                      <h4 className="text-red-400 font-medium mb-2">{t('dangerZone') || 'Danger Zone'}</h4>
                      <p className="text-gray-300 mb-4">
                        {t('deleteAccountWarning') || 'This action cannot be undone. This will permanently delete your account and all associated data.'}
                      </p>
                      <div className="space-y-4">
                        <div>
                          <Label className="text-white">
                            {t('confirmDelete') || 'Type "DELETE" to confirm'}
                          </Label>
                          <Input
                            value={deleteConfirmText}
                            onChange={(e) => setDeleteConfirmText(e.target.value)}
                            placeholder="DELETE"
                            className="bg-gray-800 border-gray-600 text-white mt-2"
                          />
                        </div>
                        <Button
                          variant="destructive"
                          onClick={handleDeleteAccount}
                          disabled={deleteConfirmText !== 'DELETE' || isDeleting}
                        >
                          {isDeleting ? t('deleting') || 'Deleting...' : t('deleteAccount') || 'Delete Account'}
                        </Button>
                      </div>
                    </div>
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
