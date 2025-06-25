import Link from "next/link";
import { getTranslations } from 'next-intl/server';
import { LanguageSwitcher } from "@/components/settings/LanguageSwitcher";
import { MobileMenu } from "@/components/MobileMenu";
import { createClient } from "@/lib/supabase/server";
import { NavigationButton } from "@/components/NavigationButton";
import { LogoutButton } from "@/components/logout-button";
import { Button } from "@/components/ui/button";
import type { User } from "@supabase/supabase-js";
import type { UserProfile } from "@/lib/settings/types";

export default async function ManifestPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  // Fetch user profile data if user is logged in
  let userProfile: UserProfile | null = null;
  if (user) {
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    
    userProfile = profileData;
  }
  
  const tNav = await getTranslations('navigation');
  const tHome = await getTranslations('home');
  const tManifest = await getTranslations('manifest');

  return (
    <div className="min-h-screen-mobile bg-slate-900 flex flex-col mobile-scroll">
      {/* Mobile & Desktop Header */}
      <ResponsiveHeader user={user} userProfile={userProfile} tNav={tNav} tHome={tHome} />

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 py-8 sm:py-12 max-w-4xl pb-safe">
        <div className="glass-card shadow-glow-xl overflow-hidden border-none rounded-sm relative p-6 sm:p-8">
          {/* Unified metallic shine overlay */}
          <div className="absolute inset-0 animate-metallic-shine pointer-events-none rounded-sm"></div>
          
          <div className="relative z-10 space-y-6 sm:space-y-8">
            <div className="text-center">
              <h1 className="text-3xl sm:text-4xl font-bold text-white alliance-text-gradient mb-4">
                {tManifest('title')}
              </h1>
              <p className="text-sm text-gray-400 mb-6">{tManifest('lastUpdated')}</p>
            </div>
            
            <div className="prose prose-invert max-w-none">
              <div className="space-y-8 text-gray-300 leading-relaxed">
                
                {/* Why we came together */}
                <section>
                  <h2 className="text-2xl font-semibold text-white mb-4 text-center">{tManifest('why.title')}</h2>
                  <div className="glass-card shadow-glow rounded-sm p-6 relative overflow-hidden">
                    <div className="absolute inset-0 animate-metallic-shine pointer-events-none rounded-sm"></div>
                    <div className="relative z-10 text-center">
                      <p className="text-lg leading-relaxed">{tManifest('why.content')}</p>
                    </div>
                  </div>
                </section>

                {/* Who are we */}
                <section>
                  <h2 className="text-2xl font-semibold text-white mb-4 text-center">{tManifest('who.title')}</h2>
                  <div className="glass-card shadow-glow rounded-sm p-6 relative overflow-hidden">
                    <div className="absolute inset-0 animate-metallic-shine pointer-events-none rounded-sm"></div>
                    <div className="relative z-10 text-center">
                      <p className="text-lg leading-relaxed">{tManifest('who.content')}</p>
                    </div>
                  </div>
                </section>

                {/* What drives us */}
                <section>
                  <h2 className="text-2xl font-semibold text-white mb-4 text-center">{tManifest('what.title')}</h2>
                  <div className="glass-card shadow-glow rounded-sm p-6 relative overflow-hidden">
                    <div className="absolute inset-0 animate-metallic-shine pointer-events-none rounded-sm"></div>
                    <div className="relative z-10 text-center">
                      <p className="text-lg leading-relaxed">{tManifest('what.content')}</p>
                    </div>
                  </div>
                </section>

                {/* Who can join us */}
                <section>
                  <h2 className="text-2xl font-semibold text-white mb-4 text-center">{tManifest('participation.title')}</h2>
                  <div className="glass-card shadow-glow rounded-sm p-6 relative overflow-hidden">
                    <div className="absolute inset-0 animate-metallic-shine pointer-events-none rounded-sm"></div>
                    <div className="relative z-10 text-center">
                      <p className="text-lg leading-relaxed">{tManifest('participation.content')}</p>
                    </div>
                  </div>
                </section>

                {/* How do we act */}
                <section>
                  <h2 className="text-2xl font-semibold text-white mb-4 text-center">{tManifest('action.title')}</h2>
                  <div className="glass-card shadow-glow rounded-sm p-6 relative overflow-hidden">
                    <div className="absolute inset-0 animate-metallic-shine pointer-events-none rounded-sm"></div>
                    <div className="relative z-10 text-center">
                      <p className="text-lg leading-relaxed">{tManifest('action.content')}</p>
                    </div>
                  </div>
                </section>

              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function ResponsiveHeader({ user, userProfile, tNav, tHome }: {
  user: User | null;
  userProfile: UserProfile | null;
  tNav: Awaited<ReturnType<typeof getTranslations>>;
  tHome: Awaited<ReturnType<typeof getTranslations>>;
}) {
  return (
    <>
      {/* Desktop Header */}
      <header className="hidden lg:flex w-full flex-col sm:flex-row justify-between items-center p-4 md:p-6 gap-4">
        {/* Triangle Logo */}
        <Link href="/" className="flex items-center flex-shrink-0">
          <div className="w-8 h-8">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L22 20H2L12 2Z" stroke="#7c3aed" strokeWidth="2" fill="none"/>
            </svg>
          </div>
        </Link>

        {/* Header Content & Language Switcher */}
        <div className="i18n-nav">
          <LanguageSwitcher compact />
          
          {user ? (
            // Logged in user header
            <UserHeader user={user} userProfile={userProfile} tNav={tNav} tHome={tHome} />
          ) : (
            // Guest user header
            <GuestHeader tNav={tNav} />
          )}
        </div>
      </header>

      {/* Mobile Header */}
      <MobileHeader user={user} userProfile={userProfile} tNav={tNav} />
    </>
  );
}

function MobileHeader({ user, userProfile, tNav }: {
  user: User | null;
  userProfile: UserProfile | null;
  tNav: Awaited<ReturnType<typeof getTranslations>>;
}) {
  return (
    <header className="lg:hidden w-full flex justify-between items-center p-4 relative">
      {/* Logo - Left */}
      <Link href="/" className="flex items-center flex-shrink-0">
        <div className="w-8 h-8">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L22 20H2L12 2Z" stroke="#7c3aed" strokeWidth="2" fill="none"/>
          </svg>
        </div>
      </Link>

      {/* Language Switcher - Center */}
      <div className="absolute left-1/2 transform -translate-x-1/2">
        <LanguageSwitcher compact />
      </div>

      {/* Mobile Menu - Right */}
      <MobileMenu 
        user={user} 
        userProfile={userProfile} 
        homeText={tNav('home')}
        manifestText={tNav('manifest')}
        dashboardText={tNav('dashboard')}
        signInText={tNav('signIn')}
        signUpText={tNav('signUp')}
      />
    </header>
  );
}

function UserHeader({ user, userProfile, tNav, tHome }: { 
  user: User; 
  userProfile: UserProfile | null;
  tNav: Awaited<ReturnType<typeof getTranslations>>;
  tHome: Awaited<ReturnType<typeof getTranslations>>;
}) {
  const displayName = userProfile?.username || user.email?.split('@')[0] || 'User';
  
  return (
    <div className="flex flex-col sm:flex-row items-center gap-2 md:gap-4">
      <span className="text-purple-400 text-sm md:text-base text-center break-words">
        {tHome('welcomeBack', { email: displayName })}
      </span>
      <NavigationButton 
        href="/"
        variant="outline"
        className="border-purple-800 text-purple-400 hover:bg-purple-800 hover:text-white i18n-button rounded-sm"
      >
        {tNav('home')}
      </NavigationButton>
      <NavigationButton 
        href="/protected"
        variant="outline"
        className="dashboard-btn border-purple-800 text-purple-400 hover:bg-purple-800 hover:text-white i18n-button rounded-sm"
      >
        <span className="btn-text">{tNav('dashboard')}</span>
      </NavigationButton>
      <LogoutButton />
    </div>
  );
}

function GuestHeader({ tNav }: { 
  tNav: (key: string) => string;
}) {
  return (
    <div className="flex flex-col sm:flex-row items-center gap-2 md:gap-4">
      <Button asChild variant="ghost" className="text-purple-400 hover:text-purple-300 hover:bg-purple-400/10 i18n-button rounded-sm">
        <Link href="/">{tNav('home')}</Link>
      </Button>
      <Button asChild variant="ghost" className="text-purple-400 hover:text-purple-300 hover:bg-purple-400/10 i18n-button rounded-sm">
        <Link href="/manifest">{tNav('manifest')}</Link>
      </Button>
      <Button asChild variant="ghost" className="text-purple-400 hover:text-purple-300 hover:bg-purple-400/10 i18n-button rounded-sm">
        <Link href="/auth/login">{tNav('signIn')}</Link>
      </Button>
      <Button asChild variant="outline" className="border-purple-800 text-purple-400 hover:bg-purple-800 hover:text-white i18n-button rounded-sm">
        <Link href="/auth/sign-up">{tNav('signUp')}</Link>
      </Button>
    </div>
  );
} 