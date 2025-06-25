"use client";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";
import { useState } from "react";

export function LogoutButton() {
  const t = useTranslations('navigation');
  const tAuth = useTranslations('auth.signOut');
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const logout = async () => {
    // Prevent multiple logout attempts
    if (isLoggingOut) return;
    
    setIsLoggingOut(true);
    setError(null);

    try {
      const supabase = createClient();
      
      // Sign out from Supabase
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;
      
      // Clear any potential cached data in browser storage
      try {
        // Clear localStorage items that might contain auth data
        const localStorageKeys = Object.keys(localStorage);
        localStorageKeys.forEach(key => {
          if (key.includes('supabase') || key.includes('auth') || key.includes('sb-')) {
            localStorage.removeItem(key);
          }
        });
        
        // Clear sessionStorage items that might contain auth data
        const sessionStorageKeys = Object.keys(sessionStorage);
        sessionStorageKeys.forEach(key => {
          if (key.includes('supabase') || key.includes('auth') || key.includes('sb-')) {
            sessionStorage.removeItem(key);
          }
        });
      } catch {
        // Storage errors are non-critical, ignore them silently
      }
      
      // Wait for auth state to propagate
      await new Promise(resolve => setTimeout(resolve, 400));
      
      // Clear any potential cached auth state with a fresh client
      try {
        const freshSupabase = createClient();
        await freshSupabase.auth.refreshSession();
      } catch {
        // Refresh errors are expected during logout, ignore them
      }
      
      // Additional delay to ensure server-side sync
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Force full page refresh to ensure complete auth state reset
      // This is the most reliable way to ensure server-client auth sync
      window.location.href = "/";
      
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : tAuth('signOutError'));
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <Button 
        onClick={logout}
        disabled={isLoggingOut}
        variant="outline"
        className="border-purple-800/50 text-purple-400 hover:bg-purple-800/20 hover:text-purple-300 hover:border-purple-400 transition-all duration-200 i18n-button disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoggingOut ? (
          <div className="flex items-center gap-2">
            <div className="relative w-4 h-4 flex items-center justify-center">
              <div className="triangle-loader-outer w-4 h-4 border-l-[8px] border-r-[8px] border-b-[16px] border-b-purple-800/50 absolute"></div>
              <div className="triangle-loader-inner w-3 h-3 border-l-[6px] border-r-[6px] border-b-[12px] border-b-purple-800/50 absolute top-[1px] left-[1px]"></div>
            </div>
            <span>{tAuth('signingOut')}</span>
          </div>
        ) : (
          t('signOut')
        )}
      </Button>
      
      {error && (
        <div className="text-red-400 text-xs text-center max-w-xs">
          {error}
        </div>
      )}
    </div>
  );
}
