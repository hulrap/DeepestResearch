'use client';

import { useState, useEffect } from 'react';
import { useLocale } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDownIcon, GlobeIcon } from 'lucide-react';

interface LanguageSwitcherProps {
  compact?: boolean;
}

const languages = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  { code: 'pt', name: 'Português', flag: '🇵🇹' },
  { code: 'nl', name: 'Nederlands', flag: '🇳🇱' },
  { code: 'pl', name: 'Polski', flag: '🇵🇱' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
  { code: 'ko', name: '한국어', flag: '🇰🇷' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦' },
  { code: 'hi', name: 'हिन्दी', flag: '🇮🇳' },
];

// Helper function to safely get cookie value
const getCookie = (name: string): string | null => {
  if (typeof document === 'undefined') return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
  return null;
};

// Helper function to apply language (same logic as handleLanguageChange but without user interaction)
const applyLanguagePreference = (languageCode: string) => {
  try {
    // Set cookie to ensure consistency
    document.cookie = `NEXT_LOCALE=${languageCode}; path=/; max-age=31536000; SameSite=Lax`;
    
    // Navigate to new language URL
    const currentUrl = new URL(window.location.href);
    const pathSegments = currentUrl.pathname.split('/').filter(Boolean);
    
    // Remove existing locale if present
    if (pathSegments.length > 0 && ['en', 'de', 'fr', 'es', 'it', 'pt', 'nl', 'pl', 'ru', 'ja', 'ko', 'zh', 'ar', 'hi'].includes(pathSegments[0])) {
      pathSegments.shift();
    }
    
    // Build new path with selected locale
    const newPath = `/${languageCode}${pathSegments.length > 0 ? '/' + pathSegments.join('/') : ''}`;
    const newUrl = `${currentUrl.origin}${newPath}${currentUrl.search}${currentUrl.hash}`;
    
    window.location.href = newUrl;
  } catch {
    // Silently handle error - keep current language
  }
};

export function LanguageSwitcher({ compact = false }: LanguageSwitcherProps) {
  const [userLanguage, setUserLanguage] = useState<string | null>(null);
  const [isChangingLanguage, setIsChangingLanguage] = useState(false);
  const currentLocale = useLocale();
  const supabase = createClient();

  // Enhanced: Load and apply user's preferred language on component mount
  useEffect(() => {
    async function loadAndApplyUserLanguage() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          // User is logged in - check database preference
          const { data: profile } = await supabase
            .from('profiles')
            .select('preferences')
            .eq('id', user.id)
            .single();
          
          if (profile?.preferences?.language) {
            // Database preference exists - use it
            setUserLanguage(profile.preferences.language);
            
            // Apply database preference if different from current locale
            // BUT only if we're not in the middle of a manual language change
            if (profile.preferences.language !== currentLocale && !isChangingLanguage) {
              applyLanguagePreference(profile.preferences.language);
              return; // Exit early as we're navigating
            }
          } else {
            // No database preference - check for cookie preference to migrate
            const cookieLanguage = getCookie('NEXT_LOCALE');
            
            // Only migrate if cookie exists and is a valid supported language
            if (cookieLanguage && languages.some(lang => lang.code === cookieLanguage)) {
              try {
                // Migrate cookie preference to database using UPDATE instead of upsert
                const currentPreferences = profile?.preferences || {};
                
                await supabase
                  .from('profiles')
                  .update({
                    preferences: {
                      ...currentPreferences,
                      language: cookieLanguage
                    },
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', user.id);
                
                setUserLanguage(cookieLanguage);
                
                // Apply cookie preference if different from current locale
                if (cookieLanguage !== currentLocale && !isChangingLanguage) {
                  applyLanguagePreference(cookieLanguage);
                  return; // Exit early as we're navigating
                }
              } catch {
                // Migration failed, but that's okay - continue with current language
              }
            }
          }
        }
        // For guest users, next-intl already handles cookie > browser > English automatically
      } catch {
        // Silently handle error - user language will default to current locale
      }
    }

    loadAndApplyUserLanguage();
  }, [supabase, currentLocale, isChangingLanguage]);

  const handleLanguageChange = async (languageCode: string) => {
    try {
      // Set flag to prevent auto-reversion during manual change
      setIsChangingLanguage(true);
      
      // Save to user profile if authenticated
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('preferences')
          .eq('id', user.id)
          .single();

        const currentPreferences = existingProfile?.preferences || {};
        
        // WAIT for database save to complete before navigating - using UPDATE instead of upsert
        await supabase
          .from('profiles')
          .update({
            preferences: {
              ...currentPreferences,
              language: languageCode
            },
            updated_at: new Date().toISOString()
          })
          .eq('id', user.id);
        
        setUserLanguage(languageCode);
      }
      
      // Set a cookie to persist the locale choice
      document.cookie = `NEXT_LOCALE=${languageCode}; path=/; max-age=31536000; SameSite=Lax`;
      
      // Navigate directly using window.location with proper URL construction
      const currentUrl = new URL(window.location.href);
      const pathSegments = currentUrl.pathname.split('/').filter(Boolean);
      
      // Remove existing locale if present
      if (pathSegments.length > 0 && ['en', 'de', 'fr', 'es', 'it', 'pt', 'nl', 'pl', 'ru', 'ja', 'ko', 'zh', 'ar', 'hi'].includes(pathSegments[0])) {
        pathSegments.shift();
      }
      
      // Build new path with selected locale
      const newPath = `/${languageCode}${pathSegments.length > 0 ? '/' + pathSegments.join('/') : ''}`;
      const newUrl = `${currentUrl.origin}${newPath}${currentUrl.search}${currentUrl.hash}`;
      
      // Navigation happens AFTER database save completes
      window.location.href = newUrl;
      
    } catch {
      // Reset flag on error
      setIsChangingLanguage(false);
      // Silently handle error - language change will not take effect
    }
  };

  const currentLanguage = languages.find(lang => lang.code === currentLocale) || languages[0];

  if (compact) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="text-purple-400 hover:text-purple-300 hover:bg-purple-400/10">
            <GlobeIcon className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="glass-card shadow-glow-xl overflow-hidden border-none rounded-sm relative min-w-56 max-w-xs">
          {/* Unified metallic shine overlay */}
          <div className="absolute inset-0 animate-metallic-shine pointer-events-none rounded-sm"></div>
          
          <div className="relative z-10">
            {languages.map((language, index) => (
              <DropdownMenuItem
                key={language.code}
                onClick={() => handleLanguageChange(language.code)}
                className={`sidebar-item flex items-center gap-3 py-3 px-4 break-words cursor-pointer transition-all duration-300 relative overflow-hidden group transform hover:translate-x-1 rounded-sm
                  ${currentLocale === language.code
                    ? 'active bg-gradient-to-r from-purple-800/10 via-purple-800/5 to-transparent text-purple-300 border-l-2 border-purple-800/30'
                    : 'text-gray-300 hover:text-white hover:bg-gray-800/30'}
                `}
                style={{ 
                  transitionDelay: `${index * 30}ms`,
                  marginBottom: index < languages.length - 1 ? '2px' : '0'
                }}
              >
                {/* Enhanced hover gradient */}
                {currentLocale !== language.code && (
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-800/2 via-purple-800/1 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500 rounded-sm"></div>
                )}
                
                <span className="text-lg flex-shrink-0">{language.flag}</span>
                <span className="font-medium flex-1 text-left">{language.name}</span>
                {currentLocale === language.code && (
                  <span className="text-purple-400 text-xs flex-shrink-0">✓</span>
                )}
                
                {/* Subtle metallic shine effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/1 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 ease-in-out"></div>
              </DropdownMenuItem>
            ))}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="border-purple-800 text-purple-400 hover:bg-purple-800 hover:text-white">
          <span className="mr-2">{currentLanguage.flag}</span>
          {currentLanguage.name}
          <ChevronDownIcon className="ml-2 h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="glass-card shadow-glow-xl overflow-hidden border-none rounded-sm relative">
        {/* Unified metallic shine overlay */}
        <div className="absolute inset-0 animate-metallic-shine pointer-events-none rounded-sm"></div>
        
        <div className="relative z-10">
          {languages.map((language, index) => (
            <DropdownMenuItem
              key={language.code}
              onClick={() => handleLanguageChange(language.code)}
              className={`sidebar-item cursor-pointer transition-all duration-300 relative overflow-hidden group transform hover:translate-x-1 rounded-sm py-3 px-4
                ${currentLocale === language.code 
                  ? 'active bg-gradient-to-r from-purple-800/10 via-purple-800/5 to-transparent text-purple-300 border-l-2 border-purple-800/30' 
                  : 'text-gray-300 hover:text-white hover:bg-gray-800/30'}
              `}
              style={{ 
                transitionDelay: `${index * 30}ms`,
                marginBottom: index < languages.length - 1 ? '2px' : '0'
              }}
            >
              {/* Enhanced hover gradient */}
              {currentLocale !== language.code && (
                <div className="absolute inset-0 bg-gradient-to-r from-purple-800/2 via-purple-800/1 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500 rounded-sm"></div>
              )}
              
              <span className="mr-2">{language.flag}</span>
              <span className="font-medium">{language.name}</span>
              {userLanguage === language.code && (
                <span className="ml-auto text-xs text-purple-400">★</span>
              )}
              
              {/* Subtle metallic shine effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/1 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 ease-in-out"></div>
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
} 