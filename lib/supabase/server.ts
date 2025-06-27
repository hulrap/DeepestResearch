import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient(isServiceRole = false) {
  const cookieStore = await cookies();

  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  
  const supabaseKey = isServiceRole ? supabaseServiceRoleKey : supabaseAnonKey;

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
      auth: {
        persistSession: !isServiceRole, // Service role doesn't need session persistence
        autoRefreshToken: !isServiceRole,
        detectSessionInUrl: !isServiceRole,
        flowType: 'pkce',
        debug: process.env.NODE_ENV === 'development'
      },
      global: {
        headers: {
          'X-Client-Info': `deepest-research-server-${isServiceRole ? 'admin' : 'user'}`
        }
      },
      db: {
        schema: 'public'
      }
    },
  );
};

// Helper function to safely execute database operations with proper error handling
export async function safeDbOperation<T>(
  operation: () => Promise<{ data: T | null; error: { code?: string; message?: string } | null }>,
  operationName: string
): Promise<{ data: T | null; error: string | null }> {
  try {
    const result = await operation();
    
    if (result.error) {
      console.error(`Database operation '${operationName}' failed:`, result.error);
      
      // Handle common Supabase errors
      if (result.error.code === 'PGRST116') {
        return { data: null, error: 'Resource not found' };
      }
      
      if (result.error.code === '42501') {
        return { data: null, error: 'Permission denied' };
      }
      
      if (result.error.code === '23505') {
        return { data: null, error: 'Resource already exists' };
      }
      
      return { data: null, error: result.error.message || 'Database operation failed' };
    }
    
    return { data: result.data, error: null };
  } catch (error) {
    console.error(`Unexpected error in '${operationName}':`, error);
    return { 
      data: null, 
      error: error instanceof Error ? error.message : 'Unexpected error occurred' 
    };
  }
}

// Helper function to initialize user data on first login/signup
export async function initializeUserData(userId: string) {
  const supabase = await createClient(); // Use anon key for initialization
  
  try {
    // Check if user configuration already exists
    const { data: existingConfig } = await supabase
      .from('user_configuration')
      .select('id')
      .eq('user_id', userId)
      .single();
    
    if (existingConfig) {
      return { success: true, message: 'User already initialized' };
    }

    // Initialize user configuration with intelligent defaults
    const { error: configError } = await supabase.rpc('initialize_user_configuration', {
      p_user_id: userId
    });
    
    if (configError) {
      console.error('Failed to initialize user configuration:', configError);
      return { success: false, error: 'Failed to initialize user configuration' };
    }

    // Initialize user usage limits
    const { error: limitsError } = await supabase.rpc('initialize_user_usage_limits', {
      p_user_id: userId
    });
    
    if (limitsError) {
      console.error('Failed to initialize usage limits:', limitsError);
      return { success: false, error: 'Failed to initialize usage limits' };
    }

    console.log(`Successfully initialized user data for: ${userId}`);
    return { success: true, message: 'User initialization completed' };

  } catch (error) {
    console.error('Unexpected error during user initialization:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unexpected initialization error' 
    };
  }
}
