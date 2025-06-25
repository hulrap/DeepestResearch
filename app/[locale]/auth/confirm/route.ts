import { createClient } from "@/lib/supabase/server";
import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/en/protected";

  // Create redirect link without the secret token - always use English locale for auth flows
  const redirectTo = new URL(next, origin);
  const errorRedirectTo = new URL("/en/auth/error", origin);

  if (token_hash && type) {
    const supabase = await createClient();

    try {
      const { error } = await supabase.auth.verifyOtp({
        type,
        token_hash,
      });
      
      if (!error) {
        // Successfully verified - redirect to protected area
        console.log(`Successfully verified ${type} for user`);
        return NextResponse.redirect(redirectTo);
      } else {
        console.error("Auth verification error:", error);
        // Redirect to error page with descriptive message
        errorRedirectTo.searchParams.set("error", error.message);
        return NextResponse.redirect(errorRedirectTo);
      }
    } catch (err) {
      console.error("Auth verification exception:", err);
      errorRedirectTo.searchParams.set("error", "Verification failed");
      return NextResponse.redirect(errorRedirectTo);
    }
  }

  // Missing required parameters
  console.error("Missing token_hash or type in confirmation URL");
  errorRedirectTo.searchParams.set("error", "Invalid confirmation link");
  return NextResponse.redirect(errorRedirectTo);
}
