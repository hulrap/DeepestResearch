import { defineRouting } from 'next-intl/routing';
import { createNavigation } from 'next-intl/navigation';

export const routing = defineRouting({
  // A list of all locales that are supported
  locales: ['en', 'de', 'fr', 'es', 'it', 'pt', 'nl', 'pl', 'ru', 'ja', 'ko', 'zh', 'ar', 'hi'],
  
  // Used when no locale matches
  defaultLocale: 'en',
  
  // Re-enable automatic locale detection but with cookie preference
  localeDetection: true
});

// Lightweight wrappers around Next.js' navigation APIs
// that consider the routing configuration
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing); 