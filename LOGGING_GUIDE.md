# Comprehensive Logging System Setup Guide

## 🎯 Overview

This logging system provides production-grade logging with **zero configuration** and minimal code changes. It combines:

- **Pino** for high-performance structured backend logging
- **Sentry** for automatic error monitoring and alerting
- **Automatic request/response logging** for all API routes
- **Client-side error tracking** for React components

## 🚀 Quick Setup (5 Minutes)

### 1. Environment Configuration

Add these variables to your `.env.local`:

```bash
# Required for Sentry (get free account at sentry.io)
NEXT_PUBLIC_SENTRY_DSN=https://your-dsn@o123456.ingest.sentry.io/123456
SENTRY_ORG=your-org-name
SENTRY_PROJECT=your-project-name

# Optional - Controls log verbosity (default: info)
LOG_LEVEL=info  # debug, info, warn, error
```

### 2. Automatic API Logging (One-Line Change)

Transform any API route from this:

```typescript
// Before: app/api/example/route.ts
export async function POST(req: NextRequest) {
  const data = await req.json();
  // your logic
  return NextResponse.json({ success: true });
}
```

To this:

```typescript
// After: app/api/example/route.ts
import { loggedApi } from '@/lib/api-middleware';

async function handler(req: NextRequest) {
  const data = await req.json();
  // your logic - no changes needed!
  return NextResponse.json({ success: true });
}

export const POST = loggedApi(handler);
```

**That's it!** You now get:
- ✅ Automatic request/response logging
- ✅ Performance monitoring
- ✅ Error tracking
- ✅ Request ID tracing
- ✅ Slow query detection

### 3. Client-Side Logging (React Components)

```typescript
// Before
import React from 'react';

export function MyComponent() {
  const handleClick = () => {
    // something happens
  };
  
  return <button onClick={handleClick}>Click me</button>;
}
```

```typescript
// After
import React from 'react';
import { useLogger } from '@/lib/client-logger';

export function MyComponent() {
  const logger = useLogger('MyComponent');
  
  const handleClick = () => {
    logger.interaction('button_click', { buttonType: 'primary' });
    // something happens
  };
  
  return <button onClick={handleClick}>Click me</button>;
}
```

## 📊 What You Get Out of the Box

### Development Mode
- Beautiful console logs with colors and timestamps
- Full request/response details
- Component interaction tracking
- Performance warnings for slow operations

### Production Mode
- Structured JSON logs optimized for log aggregation
- Automatic error reporting to Sentry
- Performance metrics and slow query alerts
- User session replay on errors (configurable)

## 🔧 Advanced Usage

### API Route Variants

```typescript
import { loggedApi, loggedSensitiveApi, loggedAuthApi } from '@/lib/api-middleware';

// Standard API logging
export const GET = loggedApi(handler);

// Sensitive endpoints (payments, personal data) - redacts sensitive fields
export const POST = loggedSensitiveApi(handler, ['credit_card', 'ssn']);

// Auth endpoints - includes auth-specific logging
export const POST = loggedAuthApi(handler);
```

### Database Operations

```typescript
import { logDbOperation } from '@/lib/api-middleware';

// Wrap database calls for automatic logging
const users = await logDbOperation('SELECT', 'users', async () => {
  return await supabase
    .from('users')
    .select('*')
    .eq('id', userId);
});
```

### Business Logic Logging

```typescript
import { businessLogger } from '@/lib/logger';

// Track important business events
businessLogger.research(userId, query, 'openai', 0.05);
businessLogger.payment(userId, 2999, 'USD', 'completed');
businessLogger.workflow(workflowId, userId, 'completed', { steps: 5 });
```

### Client-Side Error Boundaries

```typescript
import { componentLogger } from '@/lib/client-logger';

class ErrorBoundary extends React.Component {
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    componentLogger.renderError('ErrorBoundary', error, errorInfo);
  }
}
```

## 🎛️ Configuration Options

### Logging Levels
```bash
LOG_LEVEL=debug  # Maximum verbosity (development)
LOG_LEVEL=info   # Default (recommended)
LOG_LEVEL=warn   # Only warnings and errors
LOG_LEVEL=error  # Only errors
```

### Sentry Configuration
The system automatically configures Sentry with:
- Error filtering (skips common browser extension errors)
- Performance monitoring (10% sampling in production)
- Session replay on errors
- Source map upload for better stack traces

## 📈 Real-World Examples

### Converting Your Existing API Routes

#### Before: `app/api/deep-research/route.ts`
```typescript
export async function POST(req: NextRequest) {
  try {
    const { query, provider } = await req.json();
    
    const result = await callAI(provider, query);
    
    return NextResponse.json({ result });
  } catch (error) {
    console.error('Research failed:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
```

#### After: `app/api/deep-research/route.ts`
```typescript
import { loggedApi } from '@/lib/api-middleware';
import { businessLogger } from '@/lib/logger';

async function handler(req: NextRequest) {
  const { query, provider } = await req.json();
  
  const result = await callAI(provider, query);
  
  // Optional: Log business events
  businessLogger.research(userId, query, provider, result.cost);
  
  return NextResponse.json({ result });
}

export const POST = loggedApi(handler);
```

**Benefits:**
- Automatic error handling and logging
- Request/response tracing
- Performance monitoring
- Business event tracking
- No try/catch needed (handled by middleware)

### Client Component Example

#### Before: `components/ResearchInterface.tsx`
```typescript
const handleSubmit = async (query: string) => {
  setLoading(true);
  
  try {
    const response = await fetch('/api/deep-research', {
      method: 'POST',
      body: JSON.stringify({ query, provider: 'openai' })
    });
    
    const data = await response.json();
    setResult(data.result);
  } catch (error) {
    console.error('Research failed:', error);
    setError('Something went wrong');
  } finally {
    setLoading(false);
  }
};
```

#### After: `components/ResearchInterface.tsx`
```typescript
import { useLogger, userLogger } from '@/lib/client-logger';

const logger = useLogger('ResearchInterface');

const handleSubmit = async (query: string) => {
  const startTime = performance.now();
  setLoading(true);
  
  try {
    logger.interaction('research_submit', { query: query.substring(0, 50), provider: 'openai' });
    
    const response = await fetch('/api/deep-research', {
      method: 'POST',
      body: JSON.stringify({ query, provider: 'openai' })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    setResult(data.result);
    
    const duration = performance.now() - startTime;
    logger.info('Research completed', { duration, resultLength: data.result?.length });
    
  } catch (error) {
    logger.error('Research failed', error, { query: query.substring(0, 50) });
    userLogger.apiError('/api/deep-research', response?.status || 0, error.message);
    setError('Something went wrong');
  } finally {
    setLoading(false);
  }
};
```

## 🔍 Monitoring Your App

### In Development
All logs appear in your console with clear formatting:
```
[INFO] 15:30:45 Incoming POST request {"requestId":"req_123","method":"POST","pathname":"/api/deep-research"}
[INFO] 15:30:46 Research query executed {"userId":"user_123","query":"What is AI?","provider":"openai","cost":0.05}
[INFO] 15:30:47 API response 200 in 1243ms {"requestId":"req_123","statusCode":200,"duration":1243}
```

### In Production
- Structured JSON logs in Vercel/server logs
- Real-time error alerts in Sentry
- Performance insights and slow query reports
- User session replays for debugging

## 🚨 Security Features

- **Automatic PII redaction** for sensitive fields
- **Header sanitization** (authorization tokens, cookies)
- **Request body filtering** for passwords, API keys
- **Configurable sensitive field detection**

## 🎯 Migration Strategy

1. **Start small**: Convert 1-2 API routes first
2. **Add client logging**: Use `useLogger` in key components
3. **Set up Sentry**: Get the free tier for error monitoring
4. **Gradually expand**: Convert more routes as you update them
5. **Monitor**: Watch logs and tune configuration

## 🆘 Troubleshooting

### Common Issues

**"Logs not appearing in production"**
- Check `LOG_LEVEL` environment variable
- Verify Sentry DSN is correct
- Ensure Next.js is building successfully

**"Too many logs in development"**
- Set `LOG_LEVEL=warn` to reduce verbosity
- Comment out `logger.debug()` calls

**"Sentry not receiving errors"**
- Check `NEXT_PUBLIC_SENTRY_DSN` is set
- Verify Sentry project is active
- Test with `throw new Error('test')` in a component

## 🎉 Next Steps

1. Set up your Sentry account (free tier)
2. Convert your first API route
3. Add logging to your main components
4. Monitor for 24 hours
5. Tune configuration based on what you see

The system is designed to grow with your app. Start simple and add more detailed logging as needed! 