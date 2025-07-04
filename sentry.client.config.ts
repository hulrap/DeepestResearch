import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  
  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  
  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: process.env.NODE_ENV === 'development',
  
  replaysOnErrorSampleRate: 1.0,
  
  // This sets the sample rate to be 10%. You may want this to be 100% while
  // in development and sample at a lower rate in production
  replaysSessionSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0.1,
  
  // You can remove this option if you're not planning to use the Sentry Session Replay feature:
  integrations: [
    Sentry.replayIntegration({
      // Additional Replay configuration goes in here, for example:
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
  
  beforeSend(event, hint) {
    // Filter out low-value errors
    if (event.exception) {
      const error = hint.originalException;
      
      // Skip common browser extension errors
      if (error instanceof Error) {
        if (error.message.includes('Non-Error promise rejection captured')) {
          return null;
        }
        if (error.message.includes('ResizeObserver loop limit exceeded')) {
          return null;
        }
        if (error.message.includes('Network request failed')) {
          return null;
        }
      }
    }
    
    return event;
  },
  
  // Set additional tags for all events
  initialScope: {
    tags: {
      component: "client",
    },
  },
}); 