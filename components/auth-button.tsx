import Link from "next/link";
import { Button } from "./ui/button";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "./logout-button";
import { getTranslations } from "next-intl/server";

export async function AuthButton() {
  const supabase = await createClient();
  const t = await getTranslations('home');
  const tNav = await getTranslations('navigation');

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user ? (
    <div className="flex items-center gap-4">
      {t('userGreeting', { email: user.email || 'User' })}
      <LogoutButton />
    </div>
  ) : (
    <div className="flex gap-2">
      <Button asChild size="sm" variant={"outline"}>
        <Link href="/auth/login">{tNav('signIn')}</Link>
      </Button>
      <Button asChild size="sm" variant={"default"}>
        <Link href="/auth/sign-up">{tNav('signUp')}</Link>
      </Button>
    </div>
  );
}
