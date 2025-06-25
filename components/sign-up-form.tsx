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
import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

export function SignUpForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isEmailTaken, setIsEmailTaken] = useState(false);
  const router = useRouter();
  
  const t = useTranslations('auth.signUp');

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);
    setIsEmailTaken(false);

    if (password !== repeatPassword) {
      setError(t('passwordsDoNotMatch'));
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/confirm?next=/en/protected`,
        },
      });
      
      if (error) {
        // Handle explicit errors from Supabase
        setError(error.message);
        throw error;
      }
      
      // Check if email already exists - Supabase returns empty identities array for existing users
      if (data.user && data.user.identities && data.user.identities.length === 0) {
        setIsEmailTaken(true);
        setError(t('emailAlreadyRegistered'));
        return;
      }
      
      // Success cases - all of these are valid scenarios for new signups:
      
      // Case 1: Email confirmation disabled - user gets a session immediately
      if (data.user && data.session) {
        router.push("/");
        return;
      }
      
      // Case 2: Email confirmation enabled - user created but needs to confirm email
      // This is the most common case and should proceed to success page
      if (data.user && !data.session && data.user.identities && data.user.identities.length > 0) {
        router.push("/auth/sign-up-success");
        return;
      }
      
      // Case 3: Edge case - if somehow we get neither user nor error
      setError(t('registrationFailed'));
      
    } catch {
      // Error handling is already done above
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
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
          <form onSubmit={handleSignUp}>
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
                  className="form-input-enhanced text-white w-full px-4 py-2 rounded-sm focus:border-purple-800 focus:ring-1 focus:ring-purple-800"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password" className="text-white font-medium">{t('password')}</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder={t('passwordPlaceholder')}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="form-input-enhanced text-white w-full px-4 py-2 rounded-sm focus:border-purple-800 focus:ring-1 focus:ring-purple-800"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="repeat-password" className="text-white font-medium">{t('confirmPassword')}</Label>
                <Input
                  id="repeat-password"
                  type="password"
                  placeholder={t('confirmPasswordPlaceholder')}
                  required
                  value={repeatPassword}
                  onChange={(e) => setRepeatPassword(e.target.value)}
                  className="form-input-enhanced text-white w-full px-4 py-2 rounded-sm focus:border-purple-800 focus:ring-1 focus:ring-purple-800"
                />
              </div>
              {error && (
                <div className={cn(
                  "p-3 rounded-sm border",
                  isEmailTaken 
                    ? "bg-amber-900/20 border-amber-700/50" 
                    : "bg-red-900/20 border-red-700/50"
                )}>
                  <div className="flex items-center gap-2">
                    {isEmailTaken ? (
                      <svg className="w-5 h-5 text-amber-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L5.268 15.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                    <div>
                      <p className={cn(
                        "text-sm font-medium",
                        isEmailTaken ? "text-amber-400" : "text-red-400"
                      )}>
                        {error}
                      </p>
                      {isEmailTaken && (
                        <p className="text-xs text-amber-300 mt-1">
                          {t('alreadyHaveAccount')}{" "}
                          <Link 
                            href="/auth/login" 
                            className="underline hover:text-amber-200 transition-colors"
                          >
                            {t('signInHere')}
                          </Link>
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
              <Button 
                type="submit" 
                className="w-full h-12 text-lg font-semibold bg-gradient-to-r from-purple-800 to-purple-900 hover:from-purple-900 hover:to-purple-950 text-white border-0 rounded-sm shadow-lg hover:shadow-purple-800/25 transition-all duration-200" 
                disabled={isLoading}
              >
                {isLoading ? t('creatingAccount') : t('joinButton')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
} 
