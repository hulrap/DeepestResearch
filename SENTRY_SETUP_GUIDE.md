# 🔍 Sentry Setup Guide - Step by Step

## 1. Create Your Sentry Account & Project

### Step 1: Sign Up
1. Go to [sentry.io](https://sentry.io)
2. Click "Sign Up" and create a free account
3. Choose "Next.js" as your platform when prompted

### Step 2: Create Project
1. After signup, click "Create Project"
2. Select **"Next.js"** from the platform list
3. Give your project a name (e.g., "deepest-research")
4. Click "Create Project"

## 2. Get Your DSN (Data Source Name)

After creating your project, you'll see a screen with setup instructions. **You need just ONE DSN** - not separate client/server ones.

### Where to Find Your DSN:
1. In your Sentry project dashboard
2. Go to **Settings** → **Projects** → **[Your Project Name]** → **Client Keys (DSN)**
3. Copy the DSN - it looks like: `https://abc123@o456789.ingest.sentry.io/123456`

## 3. Configure Your Environment

Add this to your `.env.local` file:

```bash
# Required: Your Sentry DSN (same for client and server)
NEXT_PUBLIC_SENTRY_DSN=https://your_actual_dsn_here@o123456.ingest.sentry.io/123456

# Optional: Only needed for source maps upload (advanced feature)
SENTRY_ORG=your-org-slug
SENTRY_PROJECT=your-project-slug
```

### How to Find Optional Values (only if you want source maps):
- **SENTRY_ORG**: In Sentry, go to Settings → Organization → General → Organization Slug
- **SENTRY_PROJECT**: In Settings → Projects → [Your Project] → General → Project Slug
- **Personal Access Token**: Only needed if you want automated source map uploads (Settings → Account → User Auth Tokens)

## 4. Test Your Setup

### Quick Test Method:
Add this to any React component temporarily:

```tsx
import * as Sentry from '@sentry/nextjs';

// In a button click handler or useEffect:
const testSentry = () => {
  Sentry.captureMessage('Test from your app!', 'info');
  throw new Error('Test error for Sentry');
};
```

### Run Your App:
```bash
npm run dev
```

Click the test button and check your Sentry dashboard - you should see the error appear within minutes.

## 5. Verify Everything Works

### In Development:
- Errors appear in both console AND Sentry
- Check Sentry dashboard for incoming events

### In Production (after deployment):
- Only critical errors go to Sentry
- Beautiful error reports with user context
- Source maps show exact code locations

## 🎯 Quick Setup Summary

**Minimum required setup (works for 99% of cases):**

1. Create Sentry account at [sentry.io](https://sentry.io)
2. Create Next.js project  
3. Copy your DSN from the project settings
4. Add **ONLY** this to your `.env.local`:
   ```bash
   NEXT_PUBLIC_SENTRY_DSN=https://your_actual_key@o123456.ingest.sentry.io/123456
   ```
5. Restart your dev server
6. Test with a deliberate error

**That's literally it!** The logging system will automatically:
- ✅ Send all unhandled errors to Sentry
- ✅ Add breadcrumb trails for debugging
- ✅ Capture user sessions on errors
- ✅ Filter out noise (browser extensions, etc.)

## 🔧 Troubleshooting

### "DSN not found" error:
- Double-check the DSN is correctly copied
- Make sure it starts with `https://`
- Restart your development server

### No errors showing in Sentry:
- Check browser console for Sentry initialization errors
- Verify the DSN in browser dev tools → Network tab
- Try the test error method above

### Too many/too few errors:
- Adjust `tracesSampleRate` in `sentry.client.config.ts` (0.1 = 10%, 1.0 = 100%)
- Modify the `beforeSend` filter to catch more/fewer error types

## 💡 Pro Tips

1. **Start Simple**: **ONLY** add the DSN first - ignore everything else
2. **Test Locally**: Always test error reporting in development  
3. **Monitor Usage**: Free tier has limits, but they're generous for most projects
4. **Source Maps**: You probably don't need these - they're for advanced debugging
5. **Ignore Complex Setup**: Most tutorials overcomplicate this - the DSN alone gives you 95% of the value

## 🚀 What You Get Out of the Box

Once set up, you automatically get:
- **Real-time error alerts** via email/Slack
- **User session replays** to see exactly what went wrong
- **Performance monitoring** for slow operations
- **Custom event tracking** through our logging system
- **Detailed stack traces** with source code context

The logging system we built integrates seamlessly with Sentry, so all your custom logs and business events will also appear in your Sentry dashboard for comprehensive monitoring. 