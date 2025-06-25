import Link from "next/link";
import Image from "next/image";
import { getTranslations } from 'next-intl/server';
import { LanguageSwitcher } from "@/components/settings/LanguageSwitcher";
import { MobileMenu } from "@/components/MobileMenu";
import { createClient } from "@/lib/supabase/server";
import { NavigationButton } from "@/components/NavigationButton";
import { LogoutButton } from "@/components/logout-button";
import { Button } from "@/components/ui/button";
import type { User } from "@supabase/supabase-js";
import type { UserProfile } from "@/lib/settings/types";

export default async function PartnersPage() {
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
  const tPartners = await getTranslations('partners');

  // Partner data - names and websites are static, descriptions and categories come from translations
  const partners = [
    {
      id: 1,
      name: "Vangardist Agency & Magazine",
      website: "https://vangardist.com"
    },
    {
      id: 2,
      name: "GGG.at",
      website: "https://ggg.at"
    },
    {
      id: 3,
      name: "Transv.at",
      website: "https://transv.at"
    },
    {
      id: 4,
      name: "Queer Moments",
      website: "https://www.queermoments.com/"
    },
    {
      id: 5,
      name: "Queer Dance im Gemeindebau",
      website: "https://basiskultur.at/profil/queer-dance-im-gemeindebau-queer-night-im-schloss-neugebaeude/"
    },
    {
      id: 6,
      name: "Porn Film Festival Vienna",
      website: "https://www.pffv.at/"
    },
    {
      id: 7,
      name: "Queer Shorts Vienna",
      website: "https://www.queershortsvienna.at/"
    },
    {
      id: 8,
      name: "Vienna Gay Men's Chorus",
      website: "https://www.vgmc.at/"
    },
    {
      id: 9,
      name: "YK Media",
      website: "https://ykmedia.at/"
    },
    {
      id: 10,
      name: "Männer im Garten",
      website: "https://maenner-im-rotlicht.com/"
    }
  ];

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
                {tPartners('title')}
              </h1>
            </div>
            
            {/* Partners Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {partners.map((partner) => (
                <a
                  key={partner.id}
                  href={partner.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group block"
                >
                  <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6 text-center transition-all duration-300 hover:border-purple-500 hover:bg-gray-700/50 hover:scale-105 cursor-pointer">
                    {/* Partner Logo */}
                    <div className="w-32 h-32 mx-auto mb-4 rounded-lg overflow-hidden bg-white border border-gray-600 group-hover:border-purple-500 transition-all duration-300">
                      <Image
                        src={`/logo/${partner.id}.png`}
                        alt={`${partner.name} logo`}
                        width={128}
                        height={128}
                        className="w-full h-full object-contain"
                      />
                    </div>
                    
                    {/* Partner name */}
                    <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-purple-300 transition-colors">
                      {partner.name}
                    </h3>
                    
                    {/* Category badge */}
                    <div className="inline-block px-3 py-1 bg-purple-600/20 text-purple-300 text-xs rounded-full mb-3">
                      {tPartners(`categories.${partner.id}`)}
                    </div>
                    
                    {/* Description */}
                    <p className="text-sm text-gray-400 group-hover:text-gray-300 transition-colors">
                      {tPartners(`descriptions.${partner.id}`)}
                    </p>
                    
                    {/* External link indicator */}
                    <div className="mt-4 flex items-center justify-center text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-xs mr-1">{tPartners('visit')}</span>
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd"/>
                      </svg>
                    </div>
                  </div>
                </a>
              ))}
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
        href="/manifest"
        variant="outline"
        className="border-purple-800 text-purple-400 hover:bg-purple-800 hover:text-white i18n-button rounded-sm"
      >
        {tNav('manifest')}
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