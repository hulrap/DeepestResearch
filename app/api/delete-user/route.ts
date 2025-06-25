import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  // First, authenticate the user with regular client
  const supabase = await createClient(); // Regular client for authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized - Please log in' }, { status: 401 });
  }

  const { userId } = await req.json();

  if (!userId) {
    return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
  }

  // Security check: Users can only delete their own account
  if (user.id !== userId) {
    return NextResponse.json({ error: 'Forbidden - You can only delete your own account' }, { status: 403 });
  }

  try {
    // Now use service role for the actual deletion operations
    const adminSupabase = await createClient(true);

    // 1. Delete user data from the 'profiles' table (this cascades to all Stripe tables in our DB)
    const { error: profileError } = await adminSupabase
      .from('profiles')
      .delete()
      .eq('id', userId);

    if (profileError) {
      return NextResponse.json({ error: 'Failed to delete profile data' }, { status: 500 });
    }

    // 2. Delete the user from Supabase Auth (requires service_role key)
    const { error: userError } = await adminSupabase.auth.admin.deleteUser(userId);

    if (userError) {
      return NextResponse.json({ error: 'Failed to delete user account' }, { status: 500 });
    }

    return NextResponse.json({ message: 'User account and related data deleted successfully' }, { status: 200 });
  } catch {
    return NextResponse.json({ error: 'An unexpected error occurred during account deletion' }, { status: 500 });
  }
} 