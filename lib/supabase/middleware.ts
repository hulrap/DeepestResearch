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
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Do not run code between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  // IMPORTANT: DO NOT REMOVE auth.getUser()

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Extract pathname without locale for checking routes
  const pathname = request.nextUrl.pathname;
  
  // Add cache control headers for auth-sensitive pages to prevent stale auth state
  const isAuthSensitivePage = 
    pathname === "/" || 
    pathname.match(/^\/[a-z]{2}$/) || // locale root pages
    pathname.includes("/protected") || 
    pathname.includes("/settings") ||
    pathname.includes("/auth");

  if (isAuthSensitivePage) {
    // Prevent caching of auth-sensitive pages to ensure fresh auth state
    supabaseResponse.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate, private');
    supabaseResponse.headers.set('Pragma', 'no-cache');
    supabaseResponse.headers.set('Expires', '0');
  }
  
  // If user is authenticated and trying to access login page, redirect to home page
  if (user && (pathname.endsWith("/auth/login") || pathname.includes("/auth/login"))) {
    const url = request.nextUrl.clone();
    // Preserve locale in the redirect
    const locale = pathname.split('/')[1];
    if (locale && locale.length === 2) {
      url.pathname = `/${locale}`;
    } else {
      url.pathname = "/";
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
     pathname.endsWith("/settings") || pathname.includes("/settings"))
  ) {
    const url = request.nextUrl.clone();
    // Preserve locale in the redirect
    const locale = pathname.split('/')[1];
    if (locale && locale.length === 2) {
      url.pathname = `/${locale}/auth/login`;
    } else {
      url.pathname = "/auth/login";
    }
    const redirectResponse = NextResponse.redirect(url);
    // Ensure redirect also has no-cache headers
    redirectResponse.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate, private');
    return redirectResponse;
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
