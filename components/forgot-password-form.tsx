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

export function ForgotPasswordForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const t = useTranslations('auth.forgotPassword');
  const tLogin = useTranslations('auth.login');
  const tNav = useTranslations('navigation');
  const tErrors = useTranslations('auth.errors');

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    try {
      // The url which will be included in the email. This URL needs to be configured in your redirect URLs in the Supabase dashboard at https://supabase.com/dashboard/project/_/auth/url-configuration
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/en/auth/reset-password`,
      });
      if (error) throw error;
      setSuccess(true);
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : tErrors('genericError'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/en/auth/reset-password`,
      });
      if (error) throw error;
      // Stay on success state, just show it's resent
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : tErrors('genericError'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      {success ? (
        <Card className="glass-card shadow-glow-xl overflow-hidden border-none rounded-sm relative">
          {/* Unified metallic shine overlay */}
          <div className="absolute inset-0 animate-metallic-shine pointer-events-none rounded-sm"></div>
          
          <CardHeader className="relative z-10">
            <CardTitle className="text-2xl">{t('successTitle')}</CardTitle>
            <CardDescription>{t('successDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {t('successMessage')}
              </p>
              
              <div className="bg-purple-900/20 border border-purple-700/50 rounded-sm p-4">
                <h4 className="text-sm font-medium text-purple-300 mb-2">
                  {t('successInstructions')}
                </h4>
                <ol className="text-xs text-purple-200 space-y-1 list-decimal list-inside">
                  <li>{t('step1')}</li>
                  <li>{t('step2')}</li>
                  <li>{t('step3')}</li>
                </ol>
              </div>

              <div className="pt-4 border-t border-gray-700">
                <p className="text-xs text-gray-400 mb-3">{t('noEmail')}</p>
                {error && <p className="text-sm text-red-500 mb-3">{error}</p>}
                <Button 
                  onClick={handleResend}
                  variant="outline" 
                  className="w-full" 
                  disabled={isLoading}
                >
                  {isLoading ? t('sending') : t('resendLink')}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="glass-card shadow-glow-xl overflow-hidden border-none rounded-sm relative">
          {/* Unified metallic shine overlay */}
          <div className="absolute inset-0 animate-metallic-shine pointer-events-none rounded-sm"></div>
          
          <CardHeader className="relative z-10">
            <CardTitle className="text-2xl">{t('title')}</CardTitle>
            <CardDescription>
              {t('description')}
            </CardDescription>
          </CardHeader>
          <CardContent className="relative z-10">
            <form onSubmit={handleForgotPassword}>
              <div className="flex flex-col gap-6">
                <div className="grid gap-2">
                  <Label htmlFor="email">{tLogin('email')}</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder={tLogin('emailPlaceholder')}
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="form-input-enhanced text-white w-full px-4 py-2 rounded-sm focus:border-purple-800 focus:ring-1 focus:ring-purple-800"
                  />
                </div>
                {error && <p className="text-sm text-red-500">{error}</p>}
                <Button
                  type="submit"
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                  disabled={isLoading}
                  onClick={(e) => {
                    e.preventDefault();
                    void handleForgotPassword(e);
                  }}
                >
                  {isLoading ? t('sending') : t('resetPassword')}
                </Button>
              </div>
              <div className="mt-4 text-center text-sm">
                {t('alreadyHaveAccount')}{" "}
                <Link
                  href="/auth/login"
                  className="underline underline-offset-4"
                >
                  {tNav('signIn')}
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
