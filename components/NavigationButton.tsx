'use client';

import { useState, useEffect } from 'react';
import { useRouter } from "next/navigation";
import { useTranslations } from 'next-intl';
import { Button } from "@/components/ui/button";
import type { ButtonProps } from "@/components/ui/button";

interface NavigationButtonProps {
  href: string;
  children: React.ReactNode;
  className?: string;
  variant?: ButtonProps['variant'];
}

// Global state to manage navigation loading
let globalNavigationState = false;
const navigationListeners: Set<() => void> = new Set();

export function setNavigationLoading(isLoading: boolean) {
  globalNavigationState = isLoading;
  navigationListeners.forEach(listener => listener());
}

export function NavigationButton({ href, children, className, variant }: NavigationButtonProps) {
  const [isNavigating, setIsNavigating] = useState(false);
  const router = useRouter();
  const t = useTranslations('navigation');
  
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setNavigationLoading(true);
    setIsNavigating(true);
    
    // Navigate to the target page
    router.push(href);
  };

  // Listen for global navigation state changes
  useEffect(() => {
    const updateState = () => {
      setIsNavigating(globalNavigationState);
    };
    
    navigationListeners.add(updateState);
    
    return () => {
      navigationListeners.delete(updateState);
    };
  }, []);

  // Fallback timeout in case the target page doesn't signal completion
  useEffect(() => {
    if (!isNavigating) return;
    
    const fallbackTimer = setTimeout(() => {
      setNavigationLoading(false);
    }, 8000); // 8 second fallback
    
    return () => {
      clearTimeout(fallbackTimer);
    };
  }, [isNavigating]);

  return (
    <>
      {isNavigating && (
        <div className="page-loading-overlay show">
          <div className="text-center space-y-6">
            <div className="relative w-20 h-20 flex items-center justify-center mx-auto">
              <div className="triangle-loader-outer absolute"></div>
              <div className="triangle-loader-inner absolute"></div>
            </div>
            <p className="text-gray-300 text-lg font-medium tracking-wide">{t('loading')}</p>
          </div>
        </div>
      )}
      <Button 
        variant={variant}
        className={className}
        disabled={isNavigating}
        onClick={handleClick}
      >
        {children}
      </Button>
    </>
  );
} 