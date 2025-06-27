import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasEnvVars } from "../utils";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  // If the env vars are not set, skip middleware check. You can remove this once you setup the project.
  if (!hasEnvVars) {
    return supabaseResponse;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            supabaseResponse.cookies.set({
              name,
              value,
              ...options,
            });
          });
        },
      },
      global: {
        headers: {
          'x-application-name': process.env.NEXT_PUBLIC_APP_NAME ?? 'deepest-research'
        }
      }
    },
  );

  // Do not run code between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  // IMPORTANT: DO NOT REMOVE auth.getUser()
  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser();

  // Extract pathname without locale for checking routes
  const pathname = request.nextUrl.pathname;
  
  // Add cache control headers for auth-sensitive pages to prevent stale auth state
  const isAuthSensitivePage = 
    pathname === "/" || 
    pathname.match(/^\/[a-z]{2}$/) || // locale root pages
    pathname.includes("/protected") || 
    pathname.includes("/settings") ||
    pathname.includes("/auth") ||
    pathname.includes("/dashboard");

  if (isAuthSensitivePage) {
    // Prevent caching of auth-sensitive pages to ensure fresh auth state
    supabaseResponse.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate, private');
    supabaseResponse.headers.set('Pragma', 'no-cache');
    supabaseResponse.headers.set('Expires', '0');
  }

  // Handle authentication errors
  if (authError) {
    console.error('Authentication error in middleware:', authError);
    // Clear potentially corrupted session
    supabaseResponse.cookies.set('supabase-auth-token', '', { 
      expires: new Date(0),
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    });
  }
  
  // If user is authenticated, ensure their profile and configuration are set up
  if (user && !authError) {
    try {
      // Check if user profile exists
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, account_status')
        .eq('id', user.id)
        .single();

      // If profile doesn't exist, this might be a new user - let the sign-up flow handle it
      if (profileError && profileError.code === 'PGRST116') {
        // Profile doesn't exist - redirect to sign-up success for onboarding
        if (!pathname.includes('/auth/sign-up-success') && !pathname.includes('/auth/')) {
          const url = request.nextUrl.clone();
          const locale = pathname.split('/')[1];
          if (locale && locale.length === 2) {
            url.pathname = `/${locale}/auth/sign-up-success`;
          } else {
            url.pathname = "/auth/sign-up-success";
          }
          const redirectResponse = NextResponse.redirect(url);
          redirectResponse.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate, private');
          return redirectResponse;
        }
      } else if (profile) {
        // Profile exists - check account status
        if (profile.account_status === 'suspended' || profile.account_status === 'banned') {
          // Redirect to error page for suspended/banned accounts
          const url = request.nextUrl.clone();
          const locale = pathname.split('/')[1];
          if (locale && locale.length === 2) {
            url.pathname = `/${locale}/auth/error?error=account_suspended`;
          } else {
            url.pathname = "/auth/error?error=account_suspended";
          }
          const redirectResponse = NextResponse.redirect(url);
          redirectResponse.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate, private');
          return redirectResponse;
        }

        // Check if user needs onboarding (first login)
        if (profile.account_status === 'pending' && !pathname.includes('/auth/sign-up-success')) {
          const url = request.nextUrl.clone();
          const locale = pathname.split('/')[1];
          if (locale && locale.length === 2) {
            url.pathname = `/${locale}/auth/sign-up-success`;
          } else {
            url.pathname = "/auth/sign-up-success";
          }
          const redirectResponse = NextResponse.redirect(url);
          redirectResponse.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate, private');
          return redirectResponse;
        }

        // For protected pages, check subscription and usage limits
        if (pathname.includes("/protected") || pathname.includes("/dashboard")) {
          try {
            // Check user configuration and usage limits
            const { data: userConfig } = await supabase
              .from('user_configuration')
              .select('effective_daily_cost_limit, subscription_plan_type')
              .eq('user_id', user.id)
              .single();

            const { data: usageLimits } = await supabase
              .from('user_usage_limits')
              .select('current_daily_usage, daily_limit_exceeded')
              .eq('user_id', user.id)
              .single();

            // Check if user has exceeded daily limits and needs upgrade
            if (usageLimits?.daily_limit_exceeded && userConfig?.subscription_plan_type === 'free') {
              // Add header to indicate limit exceeded (frontend can show upgrade prompt)
              supabaseResponse.headers.set('X-Usage-Limit-Exceeded', 'true');
              supabaseResponse.headers.set('X-Subscription-Type', 'free');
            }

            // Check subscription status for premium features
            const { data: subscription } = await supabase
              .from('user_subscriptions')
              .select('status, plan_id, current_period_end')
              .eq('user_id', user.id)
              .in('status', ['active', 'trialing'])
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            if (subscription) {
              supabaseResponse.headers.set('X-Subscription-Status', subscription.status);
              supabaseResponse.headers.set('X-Subscription-Plan', subscription.plan_id || 'unknown');
            } else {
              supabaseResponse.headers.set('X-Subscription-Status', 'none');
              supabaseResponse.headers.set('X-Subscription-Plan', 'free');
            }

          } catch (configError) {
            console.error('Error checking user configuration in middleware:', configError);
            // Don't block the request, but log the error
          }
        }
      }
    } catch (error) {
      console.error('Error in user profile check:', error);
      // Don't block the request, continue with normal flow
    }
  }
  
  // If user is authenticated and trying to access login page, redirect to appropriate page
  if (user && !authError && (pathname.endsWith("/auth/login") || pathname.includes("/auth/login"))) {
    const url = request.nextUrl.clone();
    // Preserve locale in the redirect
    const locale = pathname.split('/')[1];
    if (locale && locale.length === 2) {
      url.pathname = `/${locale}/protected`;
    } else {
      url.pathname = "/protected";
    }
    const redirectResponse = NextResponse.redirect(url);
    // Ensure redirect also has no-cache headers
    redirectResponse.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate, private');
    return redirectResponse;
  }

  // If user is not authenticated and trying to access protected pages, redirect to login
  if (
    !user &&
    (pathname.endsWith("/protected") || pathname.includes("/protected") || 
     pathname.endsWith("/settings") || pathname.includes("/settings") ||
     pathname.endsWith("/dashboard") || pathname.includes("/dashboard"))
  ) {
    const url = request.nextUrl.clone();
    // Preserve locale in the redirect
    const locale = pathname.split('/')[1];
    if (locale && locale.length === 2) {
      url.pathname = `/${locale}/auth/login`;
    } else {
      url.pathname = "/auth/login";
    }
    
    // Add the current URL as a redirect parameter
    url.searchParams.set('redirect', pathname);
    
    const redirectResponse = NextResponse.redirect(url);
    // Ensure redirect also has no-cache headers
    redirectResponse.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate, private');
    return redirectResponse;
  }

  // Add security headers for all responses
  supabaseResponse.headers.set('X-Frame-Options', 'DENY');
  supabaseResponse.headers.set('X-Content-Type-Options', 'nosniff');
  supabaseResponse.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  supabaseResponse.headers.set('X-XSS-Protection', '1; mode=block');
  supabaseResponse.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=()'
  );
  
  // Add user context headers for logged-in users (useful for debugging)
  if (user && !authError) {
    supabaseResponse.headers.set('X-User-Id', user.id);
    supabaseResponse.headers.set('X-User-Email', user.email || 'unknown');
  }

  // Cache control for static assets
  if (pathname.startsWith('/_next/static/')) {
    supabaseResponse.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  } else if (pathname.startsWith('/api/')) {
    supabaseResponse.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is.
  // If you're creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally:
  //    return myNewResponse
  // If this is not done, you may be causing the browser and server to go out
  // of sync and terminate the user's session prematurely!

  return supabaseResponse;
}
