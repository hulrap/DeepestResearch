import Link from "next/link";
import { Button } from "./ui/button";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "./logout-button";
import { getTranslations } from "next-intl/server";

export async function Hero() {
  const supabase = await createClient();
  const t = await getTranslations('home');
  const tNav = await getTranslations('navigation');

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen-mobile bg-slate-900 text-white flex flex-col items-center justify-center relative mobile-scroll">
      {/* Top navigation with logo and login status */}
      <div className="absolute top-0 left-0 right-0 flex justify-between items-center p-4 sm:p-6 pt-safe pl-safe pr-safe">
        <div className="flex items-center">
          <div className="w-8 h-8">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L22 20H2L12 2Z" stroke="#7c3aed" strokeWidth="2" fill="none"/>
            </svg>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-4 text-sm">
          {user ? (
            <div className="flex items-center gap-2 sm:gap-4 text-purple-400">
              <span className="hidden sm:inline">{t('userGreeting', { email: user.email || 'User' })}</span>
              <LogoutButton />
            </div>
          ) : (
            <div className="flex items-center gap-2 sm:gap-4">
              <button className="text-purple-400 hover:text-purple-300 transition-colors touch-manipulation">
                {t('loginButton')}
              </button>
              <div className="flex items-center gap-2">
                <div className="w-6 h-4 rounded-sm bg-purple-800 flex items-center justify-center">
                  <span className="text-white text-xs font-bold">🇬🇧</span>
                </div>
                <span className="text-white hidden sm:inline">{t('currentLanguage')}</span>
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-col items-center justify-center space-y-6 sm:space-y-8 px-4 max-w-md w-full pb-safe">
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-center mb-6 sm:mb-8">
          <span className="bg-gradient-to-r from-purple-800 via-purple-400 to-purple-900 bg-clip-text text-transparent">
            {t('joinOurAlliance')}
          </span>
        </h1>

        {user ? (
          <div className="text-center space-y-4">
            <p className="text-xl text-gray-300">{t('welcomeBackShort')}</p>
            <p className="text-purple-400 break-all">{user.email}</p>
            <LogoutButton />
          </div>
        ) : (
          <div className="w-full space-y-4">
            <Button asChild className="w-full h-12 sm:h-14 text-base sm:text-lg font-semibold bg-gradient-to-r from-purple-800 to-purple-900 hover:from-purple-900 hover:to-purple-950 text-white border-0 rounded-sm shadow-lg hover:shadow-purple-500/25 transition-all duration-200 touch-manipulation">
              <Link href="/auth/login">{tNav('signIn')}</Link>
            </Button>
            <Button asChild className="w-full h-12 sm:h-14 text-base sm:text-lg font-semibold bg-gradient-to-r from-purple-800 to-purple-900 hover:from-purple-900 hover:to-purple-950 text-white border-0 rounded-sm shadow-lg hover:shadow-purple-500/25 transition-all duration-200 touch-manipulation">
              <Link href="/auth/sign-up">{t('register')}</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
