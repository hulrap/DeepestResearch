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

// Type for cookie detail items
interface CookieDetailItem {
  name: string;
  purpose: string;
  duration: string;
  provider: string;
  legal: string;
}

export default async function CookiePolicyPage() {
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
  const tCookie = await getTranslations('cookiePolicy');

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
                {tCookie('title')}
              </h1>
              <p className="text-sm text-gray-400 mb-6">{tCookie('lastUpdated')}</p>
            </div>
            
            <div className="prose prose-invert max-w-none">
              <div className="space-y-6 text-gray-300 leading-relaxed">
                
                {/* Introduction */}
                <section>
                  <h2 className="text-2xl font-semibold text-white mb-4">{tCookie('introduction.title')}</h2>
                  <p dangerouslySetInnerHTML={{ __html: tCookie('introduction.content') }} />
                </section>

                {/* What Are Cookies */}
                <section>
                  <h2 className="text-2xl font-semibold text-white mb-4">{tCookie('whatAreCookies.title')}</h2>
                  <p dangerouslySetInnerHTML={{ __html: tCookie('whatAreCookies.content') }} />
                  <div className="mt-4 space-y-2 ml-4">
                    <div dangerouslySetInnerHTML={{ __html: tCookie('whatAreCookies.remembering') }} />
                    <div dangerouslySetInnerHTML={{ __html: tCookie('whatAreCookies.improving') }} />
                    <div dangerouslySetInnerHTML={{ __html: tCookie('whatAreCookies.analyzing') }} />
                    <div dangerouslySetInnerHTML={{ __html: tCookie('whatAreCookies.personalizing') }} />
                  </div>
                </section>

                {/* Types of Cookies */}
                <section>
                  <h2 className="text-2xl font-semibold text-white mb-4">{tCookie('typesOfCookies.title')}</h2>
                  
                  <div className="space-y-6">
                    {/* Essential Cookies */}
                    <div>
                      <h3 className="text-xl font-medium text-purple-400 mb-2">{tCookie('typesOfCookies.essential.title')}</h3>
                      <p className="mb-3" dangerouslySetInnerHTML={{ __html: tCookie('typesOfCookies.essential.content') }} />
                      <div className="space-y-1 ml-4">
                        <div dangerouslySetInnerHTML={{ __html: tCookie('typesOfCookies.essential.authentication') }} />
                        <div dangerouslySetInnerHTML={{ __html: tCookie('typesOfCookies.essential.security') }} />
                        <div dangerouslySetInnerHTML={{ __html: tCookie('typesOfCookies.essential.functionality') }} />
                        <div dangerouslySetInnerHTML={{ __html: tCookie('typesOfCookies.essential.compliance') }} />
                      </div>
                    </div>

                    {/* Functional Cookies */}
                    <div>
                      <h3 className="text-xl font-medium text-purple-400 mb-2">{tCookie('typesOfCookies.functional.title')}</h3>
                      <p className="mb-3" dangerouslySetInnerHTML={{ __html: tCookie('typesOfCookies.functional.content') }} />
                      <div className="space-y-1 ml-4">
                        <div dangerouslySetInnerHTML={{ __html: tCookie('typesOfCookies.functional.preferences') }} />
                        <div dangerouslySetInnerHTML={{ __html: tCookie('typesOfCookies.functional.formData') }} />
                        <div dangerouslySetInnerHTML={{ __html: tCookie('typesOfCookies.functional.accessibility') }} />
                      </div>
                    </div>

                    {/* Analytics */}
                    <div>
                      <h3 className="text-xl font-medium text-purple-400 mb-2">{tCookie('typesOfCookies.analytics.title')}</h3>
                      <p className="mb-3" dangerouslySetInnerHTML={{ __html: tCookie('typesOfCookies.analytics.content') }} />
                      <div className="space-y-1 ml-4">
                        <div dangerouslySetInnerHTML={{ __html: tCookie('typesOfCookies.analytics.usage') }} />
                        <div dangerouslySetInnerHTML={{ __html: tCookie('typesOfCookies.analytics.performance') }} />
                        <div dangerouslySetInnerHTML={{ __html: tCookie('typesOfCookies.analytics.demographics') }} />
                        <div dangerouslySetInnerHTML={{ __html: tCookie('typesOfCookies.analytics.provider') }} />
                      </div>
                    </div>

                    {/* Payment Cookies */}
                    <div>
                      <h3 className="text-xl font-medium text-purple-400 mb-2">{tCookie('typesOfCookies.payment.title')}</h3>
                      <p className="mb-3" dangerouslySetInnerHTML={{ __html: tCookie('typesOfCookies.payment.content') }} />
                      <div className="space-y-1 ml-4">
                        <div dangerouslySetInnerHTML={{ __html: tCookie('typesOfCookies.payment.fraud') }} />
                        <div dangerouslySetInnerHTML={{ __html: tCookie('typesOfCookies.payment.security') }} />
                        <div dangerouslySetInnerHTML={{ __html: tCookie('typesOfCookies.payment.session') }} />
                      </div>
                    </div>
                  </div>
                </section>

                {/* Third-Party Services */}
                <section>
                  <h2 className="text-2xl font-semibold text-white mb-4">{tCookie('thirdPartyServices.title')}</h2>
                  <p className="mb-6" dangerouslySetInnerHTML={{ __html: tCookie('thirdPartyServices.content') }} />
                  
                  <div className="space-y-4">
                    {/* Stripe */}
                    <div className="bg-gray-800/30 p-4 rounded-sm">
                      <h4 className="text-lg font-medium text-yellow-400 mb-2">{tCookie('thirdPartyServices.stripe.title')}</h4>
                      <p className="mb-2"><strong>{tCookie('labels.purpose')}</strong> {tCookie('thirdPartyServices.stripe.purpose')}</p>
                      <p className="mb-2"><strong>{tCookie('labels.cookies')}</strong> {tCookie('thirdPartyServices.stripe.cookies')}</p>
                      <p className="mb-2"><strong>{tCookie('labels.privacy')}</strong> {tCookie('thirdPartyServices.stripe.privacy')}</p>
                      <p><strong>{tCookie('labels.legalBasis')}</strong> {tCookie('thirdPartyServices.stripe.legal')}</p>
                    </div>

                    {/* Vercel */}
                    <div className="bg-gray-800/30 p-4 rounded-sm">
                      <h4 className="text-lg font-medium text-green-400 mb-2">{tCookie('thirdPartyServices.vercel.title')}</h4>
                      <p className="mb-2"><strong>{tCookie('labels.purpose')}</strong> {tCookie('thirdPartyServices.vercel.purpose')}</p>
                      <p className="mb-2"><strong>{tCookie('labels.cookies')}</strong> {tCookie('thirdPartyServices.vercel.cookies')}</p>
                      <p className="mb-2"><strong>{tCookie('labels.privacy')}</strong> {tCookie('thirdPartyServices.vercel.privacy')}</p>
                      <p><strong>{tCookie('labels.legalBasis')}</strong> {tCookie('thirdPartyServices.vercel.legal')}</p>
                    </div>

                    {/* Supabase */}
                    <div className="bg-gray-800/30 p-4 rounded-sm">
                      <h4 className="text-lg font-medium text-blue-400 mb-2">{tCookie('thirdPartyServices.supabase.title')}</h4>
                      <p className="mb-2"><strong>{tCookie('labels.purpose')}</strong> {tCookie('thirdPartyServices.supabase.purpose')}</p>
                      <p className="mb-2"><strong>{tCookie('labels.cookies')}</strong> {tCookie('thirdPartyServices.supabase.cookies')}</p>
                      <p className="mb-2"><strong>{tCookie('labels.privacy')}</strong> {tCookie('thirdPartyServices.supabase.privacy')}</p>
                      <p><strong>{tCookie('labels.legalBasis')}</strong> {tCookie('thirdPartyServices.supabase.legal')}</p>
                    </div>
                  </div>
                </section>

                {/* Cookie Consent */}
                <section>
                  <h2 className="text-2xl font-semibold text-white mb-4">{tCookie('cookieConsent.title')}</h2>
                  <p className="mb-4" dangerouslySetInnerHTML={{ __html: tCookie('cookieConsent.content') }} />
                  <div className="space-y-2 ml-4">
                    <div dangerouslySetInnerHTML={{ __html: tCookie('cookieConsent.essential') }} />
                    <div dangerouslySetInnerHTML={{ __html: tCookie('cookieConsent.granular') }} />
                    <div dangerouslySetInnerHTML={{ __html: tCookie('cookieConsent.withdraw') }} />
                    <div dangerouslySetInnerHTML={{ __html: tCookie('cookieConsent.settings') }} />
                    <div dangerouslySetInnerHTML={{ __html: tCookie('cookieConsent.noConsent') }} />
                  </div>
                </section>

                {/* Browser Controls */}
                <section>
                  <h2 className="text-2xl font-semibold text-white mb-4">{tCookie('browserControls.title')}</h2>
                  <p className="mb-4" dangerouslySetInnerHTML={{ __html: tCookie('browserControls.content') }} />
                  <div className="space-y-2 ml-4">
                    <div dangerouslySetInnerHTML={{ __html: tCookie('browserControls.chrome') }} />
                    <div dangerouslySetInnerHTML={{ __html: tCookie('browserControls.firefox') }} />
                    <div dangerouslySetInnerHTML={{ __html: tCookie('browserControls.safari') }} />
                    <div dangerouslySetInnerHTML={{ __html: tCookie('browserControls.edge') }} />
                  </div>
                  <div className="mt-4 p-4 bg-red-900/20 border border-red-700/30 rounded-sm">
                    <p className="text-red-300" dangerouslySetInnerHTML={{ __html: tCookie('browserControls.impact') }} />
                  </div>
                </section>

                {/* Detailed Cookie List */}
                <section>
                  <h2 className="text-2xl font-semibold text-white mb-4">{tCookie('cookieDetails.title')}</h2>
                  <p className="mb-6" dangerouslySetInnerHTML={{ __html: tCookie('cookieDetails.content') }} />
                  
                  {/* Essential Cookies Table */}
                  <div className="mb-8">
                    <h3 className="text-xl font-medium text-purple-400 mb-4">{tCookie('cookieDetails.essential.title')}</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full bg-gray-800/30 rounded-sm">
                        <thead>
                          <tr className="border-b border-gray-700">
                            <th className="text-left p-3 text-purple-300">{tCookie('labels.cookieName')}</th>
                            <th className="text-left p-3 text-purple-300">{tCookie('labels.purpose')}</th>
                            <th className="text-left p-3 text-purple-300">{tCookie('labels.duration')}</th>
                            <th className="text-left p-3 text-purple-300">{tCookie('labels.legalBasis')}</th>
                          </tr>
                        </thead>
                        <tbody className="text-sm">
                          {(tCookie.raw('cookieDetails.essential.items') as CookieDetailItem[]).map((item: CookieDetailItem, index: number) => (
                            <tr key={index} className="border-b border-gray-700/50">
                              <td className="p-3 font-mono text-yellow-300">{item.name}</td>
                              <td className="p-3">{item.purpose}</td>
                              <td className="p-3">{item.duration}</td>
                              <td className="p-3 text-green-300">{item.legal}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Functional Cookies */}
                  <div className="mb-8">
                    <h3 className="text-xl font-medium text-purple-400 mb-4">{tCookie('cookieDetails.functional.title')}</h3>
                    <div className="bg-green-900/20 border border-green-700/30 p-4 rounded-sm">
                      <p className="text-green-300" dangerouslySetInnerHTML={{ __html: tCookie('cookieDetails.functional.content') }} />
                    </div>
                  </div>

                  {/* Analytics */}
                  <div>
                    <h3 className="text-xl font-medium text-purple-400 mb-4">{tCookie('cookieDetails.analytics.title')}</h3>
                    <div className="bg-blue-900/20 border border-blue-700/30 p-4 rounded-sm">
                      <p className="text-blue-300" dangerouslySetInnerHTML={{ __html: tCookie('cookieDetails.analytics.content') }} />
                    </div>
                  </div>
                </section>

                {/* Legal Basis */}
                <section>
                  <h2 className="text-2xl font-semibold text-white mb-4">{tCookie('legalBasis.title')}</h2>
                  <p className="mb-4" dangerouslySetInnerHTML={{ __html: tCookie('legalBasis.content') }} />
                  <div className="space-y-2 ml-4">
                    <div dangerouslySetInnerHTML={{ __html: tCookie('legalBasis.essential') }} />
                    <div dangerouslySetInnerHTML={{ __html: tCookie('legalBasis.payment') }} />
                    <div dangerouslySetInnerHTML={{ __html: tCookie('legalBasis.consent') }} />
                    <div dangerouslySetInnerHTML={{ __html: tCookie('legalBasis.compliance') }} />
                    <div dangerouslySetInnerHTML={{ __html: tCookie('legalBasis.analytics') }} />
                  </div>
                </section>

                {/* Data Protection Rights */}
                <section>
                  <h2 className="text-2xl font-semibold text-white mb-4">{tCookie('dataProtection.title')}</h2>
                  <p className="mb-4" dangerouslySetInnerHTML={{ __html: tCookie('dataProtection.content') }} />
                  <div className="space-y-2 ml-4">
                    <div dangerouslySetInnerHTML={{ __html: tCookie('dataProtection.access') }} />
                    <div dangerouslySetInnerHTML={{ __html: tCookie('dataProtection.rectification') }} />
                    <div dangerouslySetInnerHTML={{ __html: tCookie('dataProtection.erasure') }} />
                    <div dangerouslySetInnerHTML={{ __html: tCookie('dataProtection.restriction') }} />
                    <div dangerouslySetInnerHTML={{ __html: tCookie('dataProtection.objection') }} />
                    <div dangerouslySetInnerHTML={{ __html: tCookie('dataProtection.portability') }} />
                  </div>
                </section>

                {/* Updates */}
                <section>
                  <h2 className="text-2xl font-semibold text-white mb-4">{tCookie('updates.title')}</h2>
                  <p className="mb-4" dangerouslySetInnerHTML={{ __html: tCookie('updates.content') }} />
                  <div className="space-y-2 ml-4">
                    <div dangerouslySetInnerHTML={{ __html: tCookie('updates.notification') }} />
                    <div dangerouslySetInnerHTML={{ __html: tCookie('updates.consent') }} />
                    <div dangerouslySetInnerHTML={{ __html: tCookie('updates.effective') }} />
                    <div dangerouslySetInnerHTML={{ __html: tCookie('updates.version') }} />
                  </div>
                </section>

                {/* Contact */}
                <section>
                  <h2 className="text-2xl font-semibold text-white mb-4">{tCookie('contact.title')}</h2>
                  <p className="mb-4" dangerouslySetInnerHTML={{ __html: tCookie('contact.content') }} />
                  <div className="bg-gray-800/30 p-4 rounded-sm space-y-2">
                    <p dangerouslySetInnerHTML={{ __html: tCookie('contact.email') }} />
                    <p dangerouslySetInnerHTML={{ __html: tCookie('contact.response') }} />
                    <p dangerouslySetInnerHTML={{ __html: tCookie('contact.dpa') }} />
                    <p dangerouslySetInnerHTML={{ __html: tCookie('contact.address') }} />
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