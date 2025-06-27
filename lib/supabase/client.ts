import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
        debug: process.env.NODE_ENV === 'development'
      },
      global: {
        headers: {
          'X-Client-Info': 'deepest-research-web-app'
        }
      },
      db: {
        schema: 'public'
      },
      realtime: {
        params: {
          eventsPerSecond: 10
        }
      }
    }
  );
}

// Helper function to handle common Supabase errors
export function handleSupabaseError(error: { code?: string; message?: string }, operation: string) {
  console.error(`Supabase error during ${operation}:`, error);
  
  if (error?.code === 'PGRST116') {
    return `No ${operation} found`;
  }
  
  if (error?.code === '42501') {
    return 'Permission denied - please check your account status';
  }
  
  if (error?.code === '23505') {
    return 'This item already exists';
  }
  
  if (error?.code === '23503') {
    return 'Cannot delete - item is being used elsewhere';
  }
  
  if (error?.message?.includes('JWT expired')) {
    return 'Session expired - please log in again';
  }
  
  if (error?.message?.includes('Invalid API key')) {
    return 'Authentication failed - please log in again';
  }
  
  return error?.message || `An error occurred during ${operation}`;
}

// Helper function to check if user is authenticated
export async function checkAuthStatus() {
  const supabase = createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error) {
    console.error('Auth check error:', error);
    return { user: null, error };
  }
  
  return { user, error: null };
}
