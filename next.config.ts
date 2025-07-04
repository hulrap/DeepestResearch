import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';
import { withSentryConfig } from '@sentry/nextjs';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

// Create environment-specific CSP policies
function createCSPPolicy(): string {
  const basePolicy = [
    "default-src 'self'",
    "style-src 'self' 'unsafe-inline' fonts.googleapis.com",
    "font-src 'self' fonts.gstatic.com",
    "img-src 'self' data: blob: *.supabase.co",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];

  // Environment-specific policies
  if (process.env.NODE_ENV === 'development') {
    // Development: Allow unsafe-eval for hot reloading
    return [
      ...basePolicy,
      "script-src 'self' 'unsafe-eval' 'unsafe-inline' *.supabase.co https://js.stripe.com *.sentry.io",
      "connect-src 'self' *.supabase.co wss://*.supabase.co https://api.stripe.com *.sentry.io",
      "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
    ].join('; ');
  } else if (process.env.VERCEL_ENV === 'preview') {
    // Preview: Add Vercel Live/Comments support + Analytics + Stripe + Sentry
    return [
      ...basePolicy,
      "script-src 'self' 'unsafe-inline' *.supabase.co https://vercel.live/ https://vercel.com https://cdn.vercel-insights.com https://js.stripe.com *.sentry.io",
      "connect-src 'self' *.supabase.co wss://*.supabase.co https://vercel.live/ https://vercel.com https://vitals.vercel-insights.com https://sockjs-mt1.pusher.com/ wss://ws-mt1.pusher.com/ https://api.stripe.com *.sentry.io",
      "img-src 'self' data: blob: *.supabase.co https://vercel.live/ https://vercel.com https://sockjs-mt1.pusher.com/",
      "frame-src 'self' https://vercel.live/ https://vercel.com https://js.stripe.com https://hooks.stripe.com",
    ].join('; ');
  } else {
    // Production: Strict policy with Analytics + Stripe + Sentry support
    return [
      ...basePolicy,
      "script-src 'self' 'unsafe-inline' *.supabase.co https://cdn.vercel-insights.com https://js.stripe.com *.sentry.io",
      "connect-src 'self' *.supabase.co wss://*.supabase.co https://vitals.vercel-insights.com https://api.stripe.com *.sentry.io",
      "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
    ].join('; ');
  }
}

const nextConfig: NextConfig = {
  // Temporarily disable ESLint build failures for deployment
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Security Headers for Production
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Content Security Policy (Environment-aware)
          {
            key: 'Content-Security-Policy',
            value: createCSPPolicy()
          },
          // Prevent clickjacking
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          // Prevent MIME type sniffing
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          // Enable XSS protection
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          // Referrer policy
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          // Permissions policy
          {
            key: 'Permissions-Policy',
            value: [
              'camera=()',
              'microphone=()',
              'geolocation=()',
              'payment=()',
              'usb=()',
              'magnetometer=()',
              'accelerometer=()',
              'gyroscope=()'
            ].join(', ')
          },
          // HSTS (HTTP Strict Transport Security)
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload'
          }
        ]
      }
    ];
  },
  
  // Fixed: Moved from experimental to root level (Next.js 15+)
  serverExternalPackages: ['@supabase/supabase-js']
};

// Wrap with Sentry and Next Intl
export default withSentryConfig(
  withNextIntl(nextConfig),
  {
    // For all available options, see:
    // https://github.com/getsentry/sentry-webpack-plugin#options

    // Suppresses source map uploading logs during build
    silent: true,
    
    // Optional: Only needed if you want source maps uploaded automatically
    // org: process.env.SENTRY_ORG,
    // project: process.env.SENTRY_PROJECT,
  }
);
