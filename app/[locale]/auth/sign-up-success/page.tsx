import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";
import { getTranslations } from 'next-intl/server';
import { LanguageSwitcher } from "@/components/settings/LanguageSwitcher";
import { MobileMenu } from "@/components/MobileMenu";
import { Button } from "@/components/ui/button";

export default async function Page() {
  const tHome = await getTranslations('home');
  const tNav = await getTranslations('navigation');
  const tSuccess = await getTranslations('auth.signUpSuccess');

  return (
    <div className="flex-1 flex flex-col">
      {/* Desktop Header */}
      <header className="hidden lg:flex w-full justify-between items-center p-4 sm:p-6">
        {/* Triangle Logo */}
        <Link href="/" className="flex items-center flex-shrink-0">
          <div className="w-8 h-8">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L22 20H2L12 2Z" stroke="#7c3aed" strokeWidth="2" fill="none"/>
            </svg>
          </div>
        </Link>

        {/* Desktop Login links and language switcher */}
        <div className="flex items-center gap-4">
          <LanguageSwitcher compact />
          <Button asChild variant="ghost" className="text-purple-400 hover:text-purple-300 hover:bg-purple-400/10 i18n-button rounded-sm">
            <Link href="/">{tNav('home')}</Link>
          </Button>
          <span className="text-gray-400">{tSuccess('readyToSignIn')}</span>
          <Link href="/auth/login" className="text-purple-400 hover:text-purple-300 transition-colors">
            {tNav('signIn')}
          </Link>
        </div>
      </header>

      {/* Mobile Header */}
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
          user={null} 
          userProfile={null} 
          homeText={tNav('home')}
          manifestText={tNav('manifest')}
          dashboardText={tNav('dashboard')}
          signInText={tNav('signIn')}
          signUpText={tNav('signUp')}
        />
      </header>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center p-6 md:p-10 min-h-0">
        <div className="w-full max-w-md">
          <Card className="glass-card shadow-glow-xl overflow-hidden border-none rounded-sm relative">
            {/* Unified metallic shine overlay */}
            <div className="absolute inset-0 animate-metallic-shine pointer-events-none rounded-sm"></div>
            
            <CardHeader className="text-center relative z-10">
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <CardTitle className="text-3xl font-bold alliance-text-gradient">
                {tHome('joinPrefix')}!
              </CardTitle>
              <CardDescription className="text-gray-400 text-lg">
                {tSuccess('journeyBegins')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 relative z-10">
              <div className="bg-green-900/20 border border-green-700/50 rounded-sm p-4">
                <h3 className="text-green-400 font-semibold mb-2">{tSuccess('registrationSuccessful')}</h3>
                <p className="text-green-300 text-sm">
                  {tSuccess('confirmationInstructions')}
                </p>
              </div>
              
              <div className="bg-blue-900/20 border border-blue-700/50 rounded-sm p-4">
                <h3 className="text-blue-400 font-semibold mb-2">{tSuccess('whatsNext')}</h3>
                <ul className="text-blue-300 text-sm space-y-1">
                  <li>• {tSuccess('checkEmail')}</li>
                  <li>• {tSuccess('clickConfirmation')}</li>
                  <li>• {tSuccess('returnToSignIn')}</li>
                  <li>• {tSuccess('startJourney')}</li>
                </ul>
              </div>

              <div className="text-center">
                <p className="text-gray-400 text-sm">
                  {tSuccess('noEmailReceived')}{" "}
                  <Link href="/auth/sign-up" className="text-purple-400 hover:text-purple-300 transition-colors">
                    {tSuccess('tryAgain')}
                  </Link>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
