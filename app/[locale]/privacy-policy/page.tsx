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



// Helper function to render key points from introduction
function renderKeyPoints(keyPoints: string, tPrivacy: (key: string) => string) {
  // Handle HTML format with <br> tags and <strong> tags
  const lines = keyPoints.split('<br>').filter(line => line.trim());
  const points = lines.slice(1); // Skip the title line
  
  return (
    <div>
      <h4 className="font-semibold text-purple-300 mb-3">{tPrivacy('introduction.keyPrivacyFeaturesTitle')}</h4>
      <ul className="space-y-2 text-sm">
        {points.map((point, index) => {
          const cleanPoint = point.trim();
          const match = cleanPoint.match(/^• <strong>(.*?)<\/strong>: (.*)$/);
          if (match) {
            return (
              <li key={index} className="flex items-start">
                <span className="text-purple-400 mr-2">•</span>
                <div>
                  <strong className="text-white">{match[1]}</strong>: {match[2]}
                </div>
              </li>
            );
          }
          return null;
        }).filter(Boolean)}
      </ul>
    </div>
  );
}

export default async function PrivacyPolicyPage() {
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
  const tPrivacy = await getTranslations('privacyPolicy');

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
                {tPrivacy('title')}
              </h1>
              <p className="text-sm text-gray-400 mb-6">{tPrivacy('lastUpdated')}</p>
            </div>
            
            <div className="prose prose-invert max-w-none">
              <div className="space-y-8 text-gray-300 leading-relaxed">
                
                {/* Introduction */}
                <section>
                  <h2 className="text-2xl font-semibold text-white mb-4">{tPrivacy('introduction.title')}</h2>
                  <p className="mb-6" dangerouslySetInnerHTML={{ __html: tPrivacy('introduction.content') }} />
                  <div className="bg-purple-900/20 border border-purple-700/30 rounded-sm p-6">
                    {renderKeyPoints(tPrivacy('introduction.keyPoints'), tPrivacy)}
                  </div>
                </section>

                {/* Data Controller Information */}
                <section>
                  <h2 className="text-2xl font-semibold text-white mb-4">{tPrivacy('controllerInfo.title')}</h2>
                  <p className="mb-4" dangerouslySetInnerHTML={{ __html: tPrivacy('controllerInfo.content') }} />
                  <div className="bg-slate-800 rounded-sm p-4">
                    <div className="space-y-1 text-sm font-mono">
                      {tPrivacy('controllerInfo.contact').split('\n').map((line, index) => (
                        <div key={index}>{line}</div>
                      ))}
                    </div>
                  </div>
                </section>

                {/* Legal Basis for Processing */}
                <section>
                  <h2 className="text-2xl font-semibold text-white mb-4">{tPrivacy('legalBasis.title')}</h2>
                  <p className="mb-4" dangerouslySetInnerHTML={{ __html: tPrivacy('legalBasis.content') }} />
                  <ul className="space-y-3">
                    <li dangerouslySetInnerHTML={{ __html: tPrivacy('legalBasis.consent') }} />
                    <li dangerouslySetInnerHTML={{ __html: tPrivacy('legalBasis.contract') }} />
                    <li dangerouslySetInnerHTML={{ __html: tPrivacy('legalBasis.legitimateInterest') }} />
                    <li dangerouslySetInnerHTML={{ __html: tPrivacy('legalBasis.legalObligation') }} />
                    <li dangerouslySetInnerHTML={{ __html: tPrivacy('legalBasis.vitalInterests') }} />
                  </ul>
                </section>

                {/* Information We Collect */}
                <section>
                  <h2 className="text-2xl font-semibold text-white mb-4">{tPrivacy('dataCollection.title')}</h2>
                  
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-xl font-medium text-purple-400 mb-3">{tPrivacy('dataCollection.profileData.title')}</h3>
                      <div className="space-y-2" dangerouslySetInnerHTML={{ __html: tPrivacy('dataCollection.profileData.content') }} />
                    </div>

                    <div>
                      <h3 className="text-xl font-medium text-purple-400 mb-3">{tPrivacy('dataCollection.usageData.title')}</h3>
                      <div className="space-y-2" dangerouslySetInnerHTML={{ __html: tPrivacy('dataCollection.usageData.content') }} />
                    </div>

                    <div>
                      <h3 className="text-xl font-medium text-purple-400 mb-3">{tPrivacy('dataCollection.paymentData.title')}</h3>
                      <div className="space-y-2" dangerouslySetInnerHTML={{ __html: tPrivacy('dataCollection.paymentData.content') }} />
                    </div>

                    <div>
                      <h3 className="text-xl font-medium text-purple-400 mb-3">{tPrivacy('dataCollection.consentData.title')}</h3>
                      <div className="space-y-2" dangerouslySetInnerHTML={{ __html: tPrivacy('dataCollection.consentData.content') }} />
                    </div>
                  </div>
                </section>

                {/* How We Use Your Information */}
                <section>
                  <h2 className="text-2xl font-semibold text-white mb-4">{tPrivacy('purposes.title')}</h2>
                  <ul className="space-y-3 list-none">
                    <li dangerouslySetInnerHTML={{ __html: tPrivacy('purposes.community') }} />
                    <li dangerouslySetInnerHTML={{ __html: tPrivacy('purposes.personalization') }} />
                    <li dangerouslySetInnerHTML={{ __html: tPrivacy('purposes.communication') }} />
                    <li dangerouslySetInnerHTML={{ __html: tPrivacy('purposes.platform') }} />
                    <li dangerouslySetInnerHTML={{ __html: tPrivacy('purposes.safety') }} />
                    <li dangerouslySetInnerHTML={{ __html: tPrivacy('purposes.analytics') }} />
                    <li dangerouslySetInnerHTML={{ __html: tPrivacy('purposes.legal') }} />
                    <li dangerouslySetInnerHTML={{ __html: tPrivacy('purposes.technical') }} />
                  </ul>
                </section>

                {/* Information Sharing */}
                <section>
                  <h2 className="text-2xl font-semibold text-white mb-4">{tPrivacy('sharing.title')}</h2>
                  <p className="mb-4" dangerouslySetInnerHTML={{ __html: tPrivacy('sharing.content') }} />
                  <ul className="space-y-3 list-none">
                    <li dangerouslySetInnerHTML={{ __html: tPrivacy('sharing.serviceProviders') }} />
                    <li dangerouslySetInnerHTML={{ __html: tPrivacy('sharing.legal') }} />
                    <li dangerouslySetInnerHTML={{ __html: tPrivacy('sharing.consent') }} />
                    <li dangerouslySetInnerHTML={{ __html: tPrivacy('sharing.noSharing') }} />
                  </ul>
                  <div className="bg-green-900/20 border border-green-700/30 rounded-sm p-4 mt-4">
                    <p className="font-medium text-green-200" dangerouslySetInnerHTML={{ __html: tPrivacy('sharing.noSale') }} />
                  </div>
                </section>

                {/* International Data Transfers */}
                <section>
                  <h2 className="text-2xl font-semibold text-white mb-4">{tPrivacy('dataTransfers.title')}</h2>
                  <p className="mb-4" dangerouslySetInnerHTML={{ __html: tPrivacy('dataTransfers.content') }} />
                  <ul className="space-y-3 list-none">
                    <li dangerouslySetInnerHTML={{ __html: tPrivacy('dataTransfers.adequacy') }} />
                    <li dangerouslySetInnerHTML={{ __html: tPrivacy('dataTransfers.safeguards') }} />
                    <li dangerouslySetInnerHTML={{ __html: tPrivacy('dataTransfers.providers') }} />
                  </ul>
                </section>

                {/* Data Retention */}
                <section>
                  <h2 className="text-2xl font-semibold text-white mb-4">{tPrivacy('retention.title')}</h2>
                  <p className="mb-4" dangerouslySetInnerHTML={{ __html: tPrivacy('retention.content') }} />
                  <ul className="space-y-3 list-none">
                    <li dangerouslySetInnerHTML={{ __html: tPrivacy('retention.active') }} />
                    <li dangerouslySetInnerHTML={{ __html: tPrivacy('retention.dormant') }} />
                    <li dangerouslySetInnerHTML={{ __html: tPrivacy('retention.immediate') }} />
                    <li dangerouslySetInnerHTML={{ __html: tPrivacy('retention.deletion') }} />
                    <li dangerouslySetInnerHTML={{ __html: tPrivacy('retention.backups') }} />
                    <li dangerouslySetInnerHTML={{ __html: tPrivacy('retention.legal') }} />
                    <li dangerouslySetInnerHTML={{ __html: tPrivacy('retention.technical') }} />
                    <li dangerouslySetInnerHTML={{ __html: tPrivacy('retention.confirmation') }} />
                  </ul>
                </section>

                {/* Your Rights Under GDPR */}
                <section>
                  <h2 className="text-2xl font-semibold text-white mb-4">{tPrivacy('rights.title')}</h2>
                  <p className="mb-4" dangerouslySetInnerHTML={{ __html: tPrivacy('rights.content') }} />
                  <ul className="space-y-3 list-none">
                    <li dangerouslySetInnerHTML={{ __html: tPrivacy('rights.access') }} />
                    <li dangerouslySetInnerHTML={{ __html: tPrivacy('rights.rectification') }} />
                    <li dangerouslySetInnerHTML={{ __html: tPrivacy('rights.erasure') }} />
                    <li dangerouslySetInnerHTML={{ __html: tPrivacy('rights.restriction') }} />
                    <li dangerouslySetInnerHTML={{ __html: tPrivacy('rights.portability') }} />
                    <li dangerouslySetInnerHTML={{ __html: tPrivacy('rights.objection') }} />
                    <li dangerouslySetInnerHTML={{ __html: tPrivacy('rights.withdrawal') }} />
                    <li dangerouslySetInnerHTML={{ __html: tPrivacy('rights.complaint') }} />
                  </ul>
                  <div className="bg-blue-900/20 border border-blue-700/30 rounded-sm p-4 mt-4">
                    <p className="font-medium text-blue-200" dangerouslySetInnerHTML={{ __html: tPrivacy('rights.exercise') }} />
                  </div>
                </section>

                {/* Account Deletion */}
                <section>
                  <h2 className="text-2xl font-semibold text-white mb-4">{tPrivacy('accountDeletion.title')}</h2>
                  <p className="mb-4" dangerouslySetInnerHTML={{ __html: tPrivacy('accountDeletion.content') }} />
                  <div className="bg-red-900/20 border border-red-700/30 rounded-sm p-4">
                    <ul className="space-y-3 list-none">
                      <li dangerouslySetInnerHTML={{ __html: tPrivacy('accountDeletion.access') }} />
                      <li dangerouslySetInnerHTML={{ __html: tPrivacy('accountDeletion.process') }} />
                      <li dangerouslySetInnerHTML={{ __html: tPrivacy('accountDeletion.scope') }} />
                      <li dangerouslySetInnerHTML={{ __html: tPrivacy('accountDeletion.immediate') }} />
                      <li dangerouslySetInnerHTML={{ __html: tPrivacy('accountDeletion.irreversible') }} />
                      <li dangerouslySetInnerHTML={{ __html: tPrivacy('accountDeletion.backup') }} />
                      <li dangerouslySetInnerHTML={{ __html: tPrivacy('accountDeletion.confirmation') }} />
                      <li dangerouslySetInnerHTML={{ __html: tPrivacy('accountDeletion.alternative') }} />
                    </ul>
                  </div>
                </section>

                {/* Comprehensive Data Security Measures */}
                <section>
                  <h2 className="text-2xl font-semibold text-white mb-4">{tPrivacy('security.title')}</h2>
                  <p className="mb-6" dangerouslySetInnerHTML={{ __html: tPrivacy('security.content') }} />
                  
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-xl font-medium text-purple-400 mb-3">{tPrivacy('security.technical.title')}</h3>
                      <div className="space-y-2" dangerouslySetInnerHTML={{ __html: tPrivacy('security.technical.content') }} />
                    </div>

                    <div>
                      <h3 className="text-xl font-medium text-purple-400 mb-3">{tPrivacy('security.organizational.title')}</h3>
                      <div className="space-y-2" dangerouslySetInnerHTML={{ __html: tPrivacy('security.organizational.content') }} />
                    </div>

                    <div>
                      <h3 className="text-xl font-medium text-purple-400 mb-3">{tPrivacy('security.monitoring.title')}</h3>
                      <div className="space-y-2" dangerouslySetInnerHTML={{ __html: tPrivacy('security.monitoring.content') }} />
                    </div>

                    <div>
                      <h3 className="text-xl font-medium text-purple-400 mb-3">{tPrivacy('security.infrastructure.title')}</h3>
                      <div className="space-y-2" dangerouslySetInnerHTML={{ __html: tPrivacy('security.infrastructure.content') }} />
                    </div>

                    <div>
                      <h3 className="text-xl font-medium text-purple-400 mb-3">{tPrivacy('security.incident.title')}</h3>
                      <div className="space-y-2" dangerouslySetInnerHTML={{ __html: tPrivacy('security.incident.content') }} />
                    </div>
                  </div>
                </section>

                {/* Cookies and Tracking */}
                <section>
                  <h2 className="text-2xl font-semibold text-white mb-4">{tPrivacy('cookies.title')}</h2>
                  <p className="mb-4" dangerouslySetInnerHTML={{ __html: tPrivacy('cookies.content') }} />
                  <ul className="space-y-3 list-none">
                    <li dangerouslySetInnerHTML={{ __html: tPrivacy('cookies.essential') }} />
                    <li dangerouslySetInnerHTML={{ __html: tPrivacy('cookies.analytics') }} />
                    <li dangerouslySetInnerHTML={{ __html: tPrivacy('cookies.preference') }} />
                    <li dangerouslySetInnerHTML={{ __html: tPrivacy('cookies.marketing') }} />
                  </ul>
                  <div className="mt-4">
                    <Link href="/cookie-policy" className="text-purple-400 hover:text-purple-300 underline">
                      View detailed Cookie Policy →
                    </Link>
                  </div>
                </section>

                {/* Protection of Minors */}
                <section>
                  <h2 className="text-2xl font-semibold text-white mb-4">{tPrivacy('minors.title')}</h2>
                  <p dangerouslySetInnerHTML={{ __html: tPrivacy('minors.content') }} />
                </section>

                {/* Changes to This Policy */}
                <section>
                  <h2 className="text-2xl font-semibold text-white mb-4">{tPrivacy('changes.title')}</h2>
                  <p className="mb-4" dangerouslySetInnerHTML={{ __html: tPrivacy('changes.content') }} />
                  <ul className="space-y-3 list-none">
                    <li dangerouslySetInnerHTML={{ __html: tPrivacy('changes.notification') }} />
                    <li dangerouslySetInnerHTML={{ __html: tPrivacy('changes.consent') }} />
                    <li dangerouslySetInnerHTML={{ __html: tPrivacy('changes.posting') }} />
                    <li dangerouslySetInnerHTML={{ __html: tPrivacy('changes.date') }} />
                  </ul>
                </section>

                {/* Contact Information */}
                <section>
                  <h2 className="text-2xl font-semibold text-white mb-4">{tPrivacy('contact.title')}</h2>
                  <p className="mb-4" dangerouslySetInnerHTML={{ __html: tPrivacy('contact.content') }} />
                  <div className="bg-slate-800 rounded-sm p-4">
                    <div className="space-y-1 text-sm font-mono">
                      {tPrivacy('contact.details').split('\n').map((line, index) => (
                        <div key={index}>{line}</div>
                      ))}
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