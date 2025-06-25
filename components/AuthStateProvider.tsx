"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";

export function AuthStateProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      (event, _session) => {
        if (event === 'SIGNED_OUT') {
          // Clear any potential cached data
          router.refresh();
          
          // If user is on a protected page, redirect to home
          if (pathname.includes('/protected') || pathname.includes('/settings')) {
            window.location.href = '/';
          } else if (pathname === '/' || pathname.match(/^\/[a-z]{2}$/)) {
            // If on home page, force a refresh to update the UI
            window.location.reload();
          }
        } else if (event === 'SIGNED_IN') {
          // On sign in, refresh the router to update the UI
          router.refresh();
        } else if (event === 'TOKEN_REFRESHED') {
          // On token refresh, refresh the router to ensure fresh data
          router.refresh();
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [supabase.auth, router, pathname]);

  return <>{children}</>;
} 