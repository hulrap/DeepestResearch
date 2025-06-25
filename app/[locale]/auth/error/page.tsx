import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { getTranslations } from 'next-intl/server';
import { LanguageSwitcher } from "@/components/settings/LanguageSwitcher";
import { MobileMenu } from "@/components/MobileMenu";
import { Button } from "@/components/ui/button";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ error: string }>;
}) {
  const params = await searchParams;
  const tAuth = await getTranslations('auth.errors');
  const tNav = await getTranslations('navigation');

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
        <div className="w-full max-w-sm">
          <div className="flex flex-col gap-6">
            <Card className="glass-card shadow-glow-xl overflow-hidden border-none rounded-sm relative">
              {/* Unified metallic shine overlay */}
              <div className="absolute inset-0 animate-metallic-shine pointer-events-none rounded-sm"></div>
              
              <CardHeader className="relative z-10">
                <CardTitle className="text-2xl">
                  {tAuth('genericError')}
                </CardTitle>
              </CardHeader>
              <CardContent className="relative z-10">
                {params?.error ? (
                  <p className="text-sm text-muted-foreground">
                    {tAuth('codeErrorPrefix')} {params.error}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {tAuth('unspecifiedError')}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
