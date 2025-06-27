import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  
  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  
  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: process.env.NODE_ENV === 'development',
  
  // Set additional tags for all events
  initialScope: {
    tags: {
      component: "server",
    },
  },
  
  beforeSend(event, hint) {
    // Add server-specific context
    if (event.request) {
      // Don't log sensitive headers
      const allowedHeaders = ['user-agent', 'content-type', 'accept'];
      if (event.request.headers) {
        event.request.headers = Object.keys(event.request.headers)
          .filter(key => allowedHeaders.includes(key.toLowerCase()))
          .reduce((obj: any, key) => {
            obj[key] = event.request?.headers?.[key];
            return obj;
          }, {});
      }
    }
    
    return event;
  },
}); 