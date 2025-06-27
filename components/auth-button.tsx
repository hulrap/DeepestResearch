import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { LogoutButton } from "./logout-button";
import { getTranslations } from "next-intl/server";

export async function AuthButton() {
  const supabase = await createClient();
  const t = await getTranslations('home');
  const tNav = await getTranslations('navigation');

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const email = user?.email ?? 'Guest';

  if (user) {
    return (
      <div className="flex items-center gap-4">
        <p className="text-sm">
          {t('welcome')}, {email}!
        </p>
        <LogoutButton />
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <Link
        href="/login"
        className="px-3 py-2 flex rounded-md no-underline bg-btn-background hover:bg-btn-background-hover"
      >
        {tNav('login')}
      </Link>
      <Link
        href="/sign-up"
        className="px-3 py-2 flex rounded-md no-underline bg-foreground text-background hover:bg-foreground/90"
      >
        {tNav('signup')}
      </Link>
    </div>
  );
}
