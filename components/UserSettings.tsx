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
import type { SettingsSection, APIKeyCreateData, UsageLimitsUpdateData } from '@/lib/settings/types';

export function UserSettings() {
  // Translation hooks
  const t = useTranslations('settings');
  const locale = useLocale();

  // Settings hook
  const {
    profile,
    isLoading,
    error,
    providers,
    userAPIKeys,
    providersLoading,
    usageLimits,
    recentUsage,
    usageLoading,
    subscription,
    availablePlans,
    billingLoading,
    updateProfile,
    addAPIKey,
    removeAPIKey,
    updateUsageLimits,
    refreshAPIKeys,
    refreshUsageData,
    refreshBillingData
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
      // In a real implementation, you'd encrypt the API key before storing
      const apiKeyData: APIKeyCreateData = {
        provider_id: selectedProvider,
        encrypted_api_key: btoa(newAPIKey), // Simple base64 encoding - use proper encryption in production
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

  // Update usage limits
  const handleUpdateUsageLimits = async (data: UsageLimitsUpdateData) => {
    try {
      await updateUsageLimits(data);
    } catch (err) {
      console.error('Failed to update usage limits:', err);
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

  // Refresh data functions
  const handleRefreshAPIKeys = async () => {
    try {
      await refreshAPIKeys();
    } catch (err) {
      console.error('Failed to refresh API keys:', err);
    }
  };

  const handleRefreshUsageData = async () => {
    try {
      await refreshUsageData();
    } catch (err) {
      console.error('Failed to refresh usage data:', err);
    }
  };

  const handleRefreshBillingData = async () => {
    try {
      await refreshBillingData();
    } catch (err) {
      console.error('Failed to refresh billing data:', err);
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
                  { key: 'api-keys', label: t('apiKeys') || 'API Keys' },
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
                  </div>
                )}

                {/* API Keys Section */}
                {activeSection === 'api-keys' && (
                  <div className="space-y-6">
                    <div className="flex justify-between items-center">
                      <h3 className="text-white font-medium text-lg">{t('yourApiKeys') || 'Your API Keys'}</h3>
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={handleRefreshAPIKeys}
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
                  </div>
                )}

                {/* Usage & Limits Section */}
                {activeSection === 'usage-limits' && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-white font-medium text-lg mb-4">{t('usageLimitsTitle') || 'Usage Limits'}</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label className="text-white">{t('dailyLimit') || 'Daily Limit'} (USD)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={usageLimits?.daily_limit_usd || 10}
                            onChange={(e) => handleUpdateUsageLimits({ daily_limit_usd: parseFloat(e.target.value) })}
                            className="bg-gray-800 border-gray-600 text-white"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-white">{t('monthlyLimit') || 'Monthly Limit'} (USD)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={usageLimits?.monthly_limit_usd || 100}
                            onChange={(e) => handleUpdateUsageLimits({ monthly_limit_usd: parseFloat(e.target.value) })}
                            className="bg-gray-800 border-gray-600 text-white"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-white font-medium text-lg">{t('recentUsage') || 'Recent Usage'}</h3>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={handleRefreshUsageData}
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
                            <div key={usage.date} className="flex justify-between items-center p-3 bg-gray-800 rounded-sm">
                              <span className="text-white">{usage.date}</span>
                              <div className="text-right">
                                <p className="text-white">${usage.total_cost_usd.toFixed(4)}</p>
                                <p className="text-sm text-gray-400">{usage.total_tokens} {t('tokens') || 'tokens'}</p>
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
                        onClick={handleRefreshBillingData}
                        disabled={billingLoading}
                      >
                        {billingLoading ? t('refreshing') || 'Refreshing...' : t('refresh') || 'Refresh'}
                      </Button>
                    </div>

                    {billingLoading ? (
                      <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto"></div>
                      </div>
                    ) : subscription ? (
                      <div className="p-4 bg-green-900/20 border border-green-700/50 rounded-sm">
                        <h3 className="text-green-400 font-medium">{t('activeSubscription') || 'Active Subscription'}</h3>
                        <p className="text-white">{subscription.product_name}</p>
                        <p className="text-sm text-gray-400">{t('status') || 'Status'}: {subscription.status}</p>
                        <Button className="mt-4" onClick={handleManageSubscription}>
                          {t('manageSubscription') || 'Manage Subscription'}
                        </Button>
                      </div>
                    ) : (
                      <div>
                        <h3 className="text-white font-medium text-lg mb-4">{t('availablePlans') || 'Available Plans'}</h3>
                        <div className="grid gap-4">
                          {availablePlans.map((plan) => (
                            <div key={plan.id} className="p-6 bg-gray-800 rounded-sm">
                              <h4 className="text-white font-bold text-xl">{plan.product_name}</h4>
                              <p className="text-gray-400 mt-2">{plan.product_description}</p>
                              <div className="flex justify-between items-center mt-4">
                                <span className="text-2xl font-bold text-purple-300">
                                  {plan.unit_amount 
                                    ? `$${(plan.unit_amount / 100).toFixed(2)}${plan.recurring_interval ? `/${plan.recurring_interval}` : ''}`
                                    : t('payAsYouWish') || 'Pay as you wish'
                                  }
                                </span>
                                <Button onClick={() => handleSelectPlan(plan.id)}>
                                  {t('selectPlan') || 'Select Plan'}
                                </Button>
                              </div>
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
                    <div className="border-t border-gray-700/30 pt-6">
                      <div className="bg-red-900/10 border border-red-800/30 rounded-sm p-6">
                        <h3 className="text-red-400 font-medium mb-2 text-lg">{t('deleteAccount') || 'Delete Account'}</h3>
                        <p className="text-gray-400 text-sm mb-4">
                          {t('deleteAccountWarning') || 'This action cannot be undone. All your data will be permanently deleted.'}
                        </p>
                        
                        <div className="space-y-4">
                          <Input
                            placeholder={t('typeDeleteConfirm') || "Type 'DELETE' to confirm"}
                            value={deleteConfirmText}
                            onChange={(e) => setDeleteConfirmText(e.target.value)}
                            className="bg-red-900/60 border-red-700 text-white"
                          />
                          
                          <Button
                            variant="destructive"
                            onClick={handleDeleteAccount}
                            disabled={deleteConfirmText !== 'DELETE' || isDeleting}
                          >
                            {t('deleteAccount') || 'Delete Account'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Save Button */}
                {hasChanges && activeSection === 'profile' && (
                  <div className="flex justify-end pt-6 border-t border-gray-700/30">
                    <Button onClick={handleSave} disabled={isSaving}>
                      {isSaving ? t('saving') || 'Saving...' : t('saveChanges') || 'Save Changes'}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* API Key Modal */}
      {showAPIKeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-700 rounded-sm p-6 max-w-md w-full mx-4">
            <h3 className="text-white font-bold text-xl mb-4">{t('addApiKey') || 'Add API Key'}</h3>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-white">{t('provider') || 'Provider'}</Label>
                <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                  <SelectTrigger className="bg-gray-800 border-gray-600 text-white">
                    <SelectValue placeholder={t('selectProvider') || 'Select provider'} />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-600">
                    {providers.map((provider) => (
                      <SelectItem key={provider.id} value={provider.id} className="text-white">
                        {provider.display_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label className="text-white">{t('apiKey') || 'API Key'}</Label>
                <Input
                  type="password"
                  value={newAPIKey}
                  onChange={(e) => setNewAPIKey(e.target.value)}
                  placeholder={t('enterApiKey') || 'Enter your API key'}
                  className="bg-gray-800 border-gray-600 text-white"
                />
              </div>
              
              <div className="space-y-2">
                <Label className="text-white">{t('keyName') || 'Key Name'} ({t('optional') || 'Optional'})</Label>
                <Input
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  placeholder={t('keyNamePlaceholder') || 'e.g., Production Key'}
                  className="bg-gray-800 border-gray-600 text-white"
                />
              </div>
              
              {apiKeyError && (
                <p className="text-red-400 text-sm">{apiKeyError}</p>
              )}
            </div>
            
            <div className="flex justify-end space-x-3 mt-6">
              <Button variant="outline" onClick={() => setShowAPIKeyModal(false)}>
                {t('cancel') || 'Cancel'}
              </Button>
              <Button onClick={handleAddAPIKey}>
                {t('addKey') || 'Add Key'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
