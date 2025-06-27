"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface ClientAuthGuardProps {
  children: React.ReactNode;
  requireAuth?: boolean;
  redirectTo?: string;
}

export function ClientAuthGuard({ 
  children, 
  requireAuth = false, 
  redirectTo = "/auth/login" 
}: ClientAuthGuardProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    let isMounted = true;

    const checkAuth = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        
        if (isMounted) {
          if (error) {
            setIsAuthenticated(false);
          } else {
            setIsAuthenticated(!!user);
          }
          
          // If auth is required but user is not authenticated, redirect
          if (requireAuth && !user && !error) {
            router.push(redirectTo);
            return;
          }
          
          setIsLoading(false);
        }
      } catch {
        if (isMounted) {
          setIsAuthenticated(false);
          setIsLoading(false);
        }
      }
    };

    checkAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (isMounted) {
          const userExists = !!session?.user;
          setIsAuthenticated(userExists);
          
          // Handle logout
          if (event === 'SIGNED_OUT' && requireAuth) {
            router.push(redirectTo);
          }
          
          // Handle login
          if (event === 'SIGNED_IN' && !requireAuth) {
            void router.refresh();
          }
        }
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [supabase.auth, router, requireAuth, redirectTo]);

  // Show loading state during auth check
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="relative w-8 h-8 flex items-center justify-center">
          <div className="triangle-loader-outer w-8 h-8 border-l-[16px] border-r-[16px] border-b-[32px] border-b-purple-800/50 absolute"></div>
          <div className="triangle-loader-inner w-6 h-6 border-l-[12px] border-r-[12px] border-b-[24px] border-b-purple-800/50 absolute top-[2px] left-[2px]"></div>
        </div>
      </div>
    );
  }

  // If auth is required but user is not authenticated, don't render children
  if (requireAuth && !isAuthenticated) {
    return null;
  }

  return <>{children}</>;
} 