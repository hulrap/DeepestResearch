'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { AuthButton } from '@/components/auth-button';
import { ThemeSwitcher } from '@/components/theme-switcher';
import { MobileMenu } from '@/components/MobileMenu';
import { NavigationButton } from '@/components/NavigationButton';
import { useSettings } from '@/lib/settings/use-settings';
import { Bot } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';

export default function SharedHeader() {
  const t = useTranslations('navigation');
  const pathname = usePathname();
  const { profile } = useSettings();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const fetchUser = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data.user);
    };
    fetchUser();
  }, []);

  const navLinks = [
    { href: '/', label: t('home') },
    { href: '/#features', label: t('features') },
    { href: '/#pricing', label: t('pricing') },
    { href: '/contact', label: t('contact') },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 max-w-7xl items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href="/" className="flex items-center space-x-2">
            <Bot className="h-6 w-6 text-primary" />
            <span className="font-bold">DeepResearch</span>
          </Link>
          <nav className="hidden md:flex items-center space-x-2">
            {navLinks.map((link) => (
              <NavigationButton
                key={link.href}
                href={link.href}
                variant={pathname === link.href ? 'secondary' : 'ghost'}
              >
                {link.label}
              </NavigationButton>
            ))}
          </nav>
        </div>

        <div className="hidden md:flex items-center space-x-2">
          <ThemeSwitcher />
          {profile ? (
            <Button asChild>
              <Link href="/dashboard">{t('dashboard')}</Link>
            </Button>
          ) : (
             <AuthButton />
          )}
        </div>

        <div className="md:hidden">
          <MobileMenu 
            user={user} 
            userProfile={profile} 
            homeText={t('home')}
            manifestText={t('manifest')}
            dashboardText={t('dashboard')}
            signInText={t('signIn')}
            signUpText={t('signUp')}
          />
        </div>
      </div>
    </header>
  );
} 