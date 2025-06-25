'use client';

import { useEffect } from 'react';
import { setNavigationLoading } from './NavigationButton';

export function PageLoadComplete() {
  useEffect(() => {
    // Signal that the page has loaded completely
    // Small delay to ensure all components are rendered
    const timer = setTimeout(() => {
      setNavigationLoading(false);
    }, 100);

    return () => {
      clearTimeout(timer);
    };
  }, []);

  // This component doesn't render anything
  return null;
} 