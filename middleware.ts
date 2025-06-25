import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';
import { updateSession } from './lib/supabase/middleware';
import { NextRequest, NextResponse } from 'next/server';

const intlMiddleware = createMiddleware(routing);

export default async function middleware(request: NextRequest) {
  // Skip all API routes completely to prevent webhook issues
  if (request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next();
  }
  
  // First handle authentication with Supabase
  const authResponse = await updateSession(request);
  
  // If auth middleware returned a redirect, use it
  if (authResponse.status === 302 || authResponse.status === 307) {
    return authResponse;
  }
  
  // Otherwise, apply internationalization middleware
  return intlMiddleware(request);
}

export const config = {
  // Match all pathnames except for
  // - … if they start with `/api`, `/_next` or `/_vercel`
  // - … the ones containing a dot (e.g. `favicon.ico`)
  matcher: [
    '/((?!api/|_next/|_vercel/|.*\\.).*)'
  ],
};
