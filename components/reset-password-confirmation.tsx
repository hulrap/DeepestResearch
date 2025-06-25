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
import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";

interface ResetPasswordConfirmationProps extends React.ComponentPropsWithoutRef<"div"> {
  token_hash?: string;
  type?: string;
}

export function ResetPasswordConfirmation({
  className,
  token_hash,
  type,
  ...props
}: ResetPasswordConfirmationProps) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);
  const [isValidToken, setIsValidToken] = useState(false);
  const [isResending, setIsResending] = useState(false);
  
  const router = useRouter();
  const supabase = createClient();
  
  const t = useTranslations('auth.updatePassword');
  const tErrors = useTranslations('auth.errors');

  // Check and verify the reset token on client side
  useEffect(() => {
    const verifyToken = async () => {
      try {
        if (token_hash && type === 'recovery') {
          // Verify the token on client side to establish proper session
          const { error } = await supabase.auth.verifyOtp({
            type: 'recovery',
            token_hash,
          });
          
          if (error) {
            throw error;
          }
          
          // Token verified successfully, user is now authenticated
          setIsValidToken(true);
        } else {
          // No token provided, check if user has existing session
          const { data: { user }, error } = await supabase.auth.getUser();
          
          if (error) throw error;
          
          if (user) {
            setIsValidToken(true);
          } else {
            setError('You need to click the reset link from your email to access this page. Copying/pasting the link will not work.');
          }
        }
      } catch (error: unknown) {
        setError(error instanceof Error ? error.message : 'Authentication required. Please click the reset link from your email.');
      } finally {
        setIsVerifying(false);
      }
    };

    verifyToken();
  }, [token_hash, type, supabase.auth]);

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setIsLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      setIsLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      
      setSuccess(true);
      
      // Redirect to dashboard after successful password reset
      setTimeout(() => {
        router.push('/protected');
      }, 2000);
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : tErrors('genericError'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendEmail = async () => {
    // Check if we have an email from somewhere (could be passed as prop or stored)
    const email = prompt('Please enter your email address to resend the reset link:');
    
    if (!email) return;

    setIsResending(true);
    setError(null);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/en/auth/reset-password`,
      });
      
      if (error) throw error;
      
      // Redirect to forgot password success page
      router.push('/auth/forgot-password?sent=true');
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'Failed to send reset email');
    } finally {
      setIsResending(false);
    }
  };

  if (isVerifying) {
    return (
      <div className={cn("flex flex-col gap-6", className)} {...props}>
        <Card className="glass-card shadow-glow-xl overflow-hidden border-none rounded-sm relative">
          <div className="absolute inset-0 animate-metallic-shine pointer-events-none rounded-sm"></div>
          <CardContent className="relative z-10 p-8">
            <div className="text-center space-y-4">
              <div className="relative w-16 h-16 flex items-center justify-center mx-auto">
                <div className="triangle-loader-outer absolute"></div>
                <div className="triangle-loader-inner absolute"></div>
              </div>
              <p className="text-white text-lg">{t('verifyingLink')}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isValidToken) {
    return (
      <div className={cn("flex flex-col gap-6", className)} {...props}>
        <Card className="glass-card shadow-glow-xl overflow-hidden border-none rounded-sm relative">
          <div className="absolute inset-0 animate-metallic-shine pointer-events-none rounded-sm"></div>
          <CardHeader className="relative z-10">
            <CardTitle className="text-2xl text-red-400">{t('authenticationRequired')}</CardTitle>
            <CardDescription className="text-red-300">
              {error}
            </CardDescription>
            <CardDescription className="text-gray-400 text-sm mt-2">
              💡 Tip: Magic links must be clicked directly from your email. Copying and pasting the URL will not work.
            </CardDescription>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="space-y-3">
              <Button 
                onClick={handleResendEmail}
                className="w-full"
                disabled={isResending}
              >
                {isResending ? 'Sending...' : 'Request New Reset Link'}
              </Button>
              <Button 
                onClick={() => router.push('/auth/forgot-password')}
                variant="outline"
                className="w-full"
              >
                Go to Forgot Password Page
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className={cn("flex flex-col gap-6", className)} {...props}>
        <Card className="glass-card shadow-glow-xl overflow-hidden border-none rounded-sm relative">
          <div className="absolute inset-0 animate-metallic-shine pointer-events-none rounded-sm"></div>
          <CardHeader className="relative z-10">
            <CardTitle className="text-2xl text-green-400">{t('passwordUpdated')}</CardTitle>
                         <CardDescription className="text-green-300">
               {t('passwordUpdatedSuccess')}
             </CardDescription>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="text-center">
              <p className="text-sm text-gray-400">{t('redirectingMoment')}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="glass-card shadow-glow-xl overflow-hidden border-none rounded-sm relative">
        <div className="absolute inset-0 animate-metallic-shine pointer-events-none rounded-sm"></div>
        
        <CardHeader className="relative z-10">
          <CardTitle className="text-2xl">{t('title')}</CardTitle>
          <CardDescription>
            {t('description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="relative z-10">
          <form onSubmit={handlePasswordReset}>
            <div className="flex flex-col gap-6">
              <div className="grid gap-2">
                <Label htmlFor="password">{t('newPassword')}</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder={t('newPasswordPlaceholder')}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="form-input-enhanced text-white w-full px-4 py-2 rounded-sm focus:border-purple-800 focus:ring-1 focus:ring-purple-800"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="confirmPassword">{t('confirmNewPassword')}</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder={t('confirmNewPasswordPlaceholder')}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="form-input-enhanced text-white w-full px-4 py-2 rounded-sm focus:border-purple-800 focus:ring-1 focus:ring-purple-800"
                />
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? t('saving') : t('saveNewPassword')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
} 