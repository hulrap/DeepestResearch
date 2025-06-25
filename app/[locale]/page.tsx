import Link from "next/link";
import { Button } from "@/components/ui/button";
import { NavigationButton } from "@/components/NavigationButton";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "@/components/logout-button";
import { LanguageSwitcher } from "@/components/settings/LanguageSwitcher";
import { MobileMenu } from "@/components/MobileMenu";
import { GuestPopupWrapper } from "@/components/GuestPopupWrapper";
import { InteractiveProcessIcon } from "@/components/InteractiveProcessIcon";
import { ResearchChat } from "@/components/chat/ResearchChat";
import { getTranslations } from "next-intl/server";
import type { User } from "@supabase/supabase-js";
import type { UserProfile, ParticipationRole } from "@/lib/settings/types";

// Force dynamic rendering to ensure fresh data on every request
export const dynamic = 'force-dynamic';

export default async function Home() {
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
  
  // Get all translations needed for this page
  const tNav = await getTranslations('navigation');
  const tHome = await getTranslations('home');
  const tSettings = await getTranslations('settings');

  return (
    <div className="min-h-screen-mobile lg:min-h-0 bg-slate-900 flex flex-col mobile-scroll">
      {/* Mobile & Desktop Header */}
      <ResponsiveHeader user={user} userProfile={userProfile} tNav={tNav} tHome={tHome} />

      {/* Main Content - Optimized spacing for desktop footer visibility */}
      <main className="flex-1 flex flex-col items-center justify-center lg:justify-start lg:pt-16 px-4 py-8 md:py-12 min-h-0 pb-safe">
        <div className="text-center space-y-8 sm:space-y-10 md:space-y-12 lg:space-y-16 i18n-container">
          {user ? (
            <LoggedInContent user={user} userProfile={userProfile} tHome={tHome} tSettings={tSettings} />
          ) : (
            <GuestContent tHome={tHome} />
          )}
        </div>
      </main>

      {/* Guest Welcome Popup */}
      <GuestPopupWrapper isGuest={!user} />
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
      <header className="hidden lg:flex w-full flex-col sm:flex-row justify-between items-center p-3 md:p-4 gap-4">
        {/* Triangle Logo */}
        <Link href="/" className="flex items-center flex-shrink-0">
          <div className="w-8 h-8">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L22 20H2L12 2Z" stroke="#1e40af" strokeWidth="2" fill="none"/>
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
            <path d="M12 2L22 20H2L12 2Z" stroke="#1e40af" strokeWidth="2" fill="none"/>
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
      <span className="text-blue-400 text-sm md:text-base text-center break-words">
        {tHome('welcomeBack', { email: displayName })}
      </span>
      <NavigationButton 
        href="/"
        variant="outline"
        className="border-blue-800 text-blue-400 hover:bg-blue-800 hover:text-white i18n-button rounded-sm"
      >
        {tNav('home')}
      </NavigationButton>
      <NavigationButton 
        href="/manifest"
        variant="outline"
        className="border-blue-800 text-blue-400 hover:bg-blue-800 hover:text-white i18n-button rounded-sm"
      >
        {tNav('manifest')}
      </NavigationButton>
      <NavigationButton 
        href="/protected"
        variant="outline"
        className="dashboard-btn border-blue-800 text-blue-400 hover:bg-blue-800 hover:text-white i18n-button rounded-sm"
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
      <Button asChild variant="ghost" className="text-blue-400 hover:text-blue-300 hover:bg-blue-400/10 i18n-button rounded-sm">
        <Link href="/">{tNav('home')}</Link>
      </Button>
      <Button asChild variant="ghost" className="text-blue-400 hover:text-blue-300 hover:bg-blue-400/10 i18n-button rounded-sm">
        <Link href="/manifest">{tNav('manifest')}</Link>
      </Button>
      <Button asChild variant="ghost" className="text-blue-400 hover:text-blue-300 hover:bg-blue-400/10 i18n-button rounded-sm">
        <Link href="/auth/login">{tNav('signIn')}</Link>
      </Button>
      <Button asChild variant="outline" className="border-blue-800 text-blue-400 hover:bg-blue-800 hover:text-white i18n-button rounded-sm">
        <Link href="/auth/sign-up">{tNav('signUp')}</Link>
      </Button>
    </div>
  );
}

function LoggedInContent({ user, userProfile, tHome, tSettings }: { 
  user: User;
  userProfile: UserProfile | null;
  tHome: (key: string) => string;
  tSettings: (key: string) => string;
}) {
  // Extract user info for personalization
  const displayName = userProfile?.username || user.email?.split('@')[0] || 'User';
  
  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Welcome Header */}
      <div className="text-center mb-8">
        <h1 className="i18n-title mb-4">
          <span className="alliance-text-gradient-shine block">
            {tHome('welcomeBackPrefix')} {displayName}
          </span>
        </h1>
        <p className="text-gray-400 text-sm">
          {tHome('researchAssistantReady')}
        </p>
      </div>

      {/* Research Chat Component */}
      <ResearchChat />
    </div>
  );
}

function GuestContent({ tHome }: { 
  tHome: (key: string) => string;
}) {
  return (
    <>
      {/* Interactive Process Icon - positioned above everything with enhanced spacing */}
      <div className="mb-8 md:mb-12 lg:mb-16">
        <InteractiveProcessIcon />
      </div>

      {/* Title with Shiny Animation */}
      <div className="mb-8 md:mb-10 lg:mb-12">
        <h1 className="i18n-title space-y-2">
          <span className="alliance-text-gradient-shine block">
            {tHome('joinPrefix')}
          </span>
        </h1>
      </div>

      <div className="w-full max-w-md mx-auto space-y-6">
        <Button asChild className="btn-enhanced relative w-full h-12 md:h-14 text-base md:text-lg font-semibold bg-gradient-to-r from-blue-800 to-blue-900 hover:from-blue-900 hover:to-blue-950 text-white border-0 rounded-sm shadow-lg hover:shadow-blue-500/25 transition-all duration-200 transform hover:scale-105 gpu-accelerated i18n-button">
          <Link href="/auth/sign-up">{tHome('register')}</Link>
        </Button>
      </div>
    </>
  );
}


