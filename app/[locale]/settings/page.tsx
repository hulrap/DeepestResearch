import { createClient } from '@/lib/supabase/server';
import { UserSettings } from '@/components/UserSettings';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';

// Component to handle URL search params
async function SettingsContent() {
  const tCommon = await getTranslations('common');
  
  return (
    <Suspense fallback={<div>{tCommon('loading')}</div>}>
      <UserSettings />
    </Suspense>
  );
}

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect('/auth/login');
  }

  return <SettingsContent />;
} 