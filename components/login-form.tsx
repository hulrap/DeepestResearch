"use client";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";

export function LoginForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const t = useTranslations('auth.login');
  const tErrors = useTranslations('auth.errors');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Prevent multiple submissions and set loading immediately
    if (isLoading) return;
    setIsLoading(true);
    setError(null);

    const supabase = createClient();

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      
      // Longer delay to ensure session is properly established server-side
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Refresh the session to ensure server-side sync
      await supabase.auth.refreshSession();
      
      // Additional small delay after refresh
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Force a full page refresh to ensure server-side auth state is correct
      window.location.href = "/";
      // Don't set loading to false on success - let the page navigation handle it
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : tErrors('genericError'));
      setIsLoading(false); // Only stop loading on error
    }
  };

  return (
    <div className={cn("flex flex-col gap-6 relative", className)} {...props}>
      {/* Full Screen Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[9999] flex items-center justify-center">
          <div className="glass-card shadow-glow-xl overflow-hidden border-none rounded-sm relative p-8 mx-4">
            <div className="absolute inset-0 animate-metallic-shine pointer-events-none rounded-sm"></div>
            <div className="relative z-10 flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-4 border-purple-400 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-white font-medium text-xl">
                {t('signingIn')}
              </p>
              <p className="text-gray-400 text-center max-w-xs">
                Please wait while we sign you in...
              </p>
            </div>
          </div>
        </div>
      )}
      
      <Card className="glass-card shadow-glow-xl overflow-hidden border-none rounded-sm relative">
        {/* Unified metallic shine overlay */}
        <div className="absolute inset-0 animate-metallic-shine pointer-events-none rounded-sm"></div>
        
        <CardHeader className="text-center relative z-10">
          <CardTitle className="text-3xl font-bold alliance-text-gradient">
            {t('title')}
          </CardTitle>
          <CardDescription className="text-gray-400 text-lg">
            {t('subtitle')}
          </CardDescription>
        </CardHeader>
        <CardContent className="relative z-10">
          <form onSubmit={handleLogin} noValidate>
            <div className="flex flex-col gap-6">
              <div className="grid gap-2">
                <Label htmlFor="email" className="text-white font-medium">{t('email')}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder={t('emailPlaceholder')}
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  className="form-input-enhanced text-white w-full px-4 py-2 rounded-sm focus:border-purple-800 focus:ring-1 focus:ring-purple-800 disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>
              <div className="grid gap-2">
                <div className="flex items-center">
                  <Label htmlFor="password" className="text-white font-medium">{t('password')}</Label>
                  <Link
                    href="/auth/forgot-password"
                    className={`ml-auto text-sm transition-colors ${
                      isLoading 
                        ? "text-gray-500 cursor-not-allowed pointer-events-none" 
                        : "text-purple-400 hover:text-purple-300"
                    }`}
                    tabIndex={isLoading ? -1 : 0}
                  >
                    {t('forgotPassword')}
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  className="form-input-enhanced text-white w-full px-4 py-2 rounded-sm focus:border-purple-800 focus:ring-1 focus:ring-purple-800 disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>
              {error && (
                <div className="p-3 rounded-sm bg-red-900/20 border border-red-700/50">
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}
              <Button
                type="submit"
                className="w-full bg-purple-600 hover:bg-purple-700"
                disabled={isLoading}
                onClick={(e) => {
                  e.preventDefault();
                  void handleLogin(e);
                }}
              >
                {isLoading ? t('signingIn') : t('signIn')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
