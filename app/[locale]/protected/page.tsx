import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ResearchChat } from "@/components/chat/ResearchChat";
import Link from "next/link";
import { PageLoadComplete } from "@/components/PageLoadComplete";

export default async function ProtectedPage() {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    redirect("/auth/login");
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-900 text-white">
      {/* A minimal header */}
      <header className="flex w-full items-center justify-between p-4 border-b border-purple-800/30">
        <Link href="/" className="flex items-center">
          <div className="w-8 h-8">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L22 20H2L12 2Z" stroke="#7c3aed" strokeWidth="2" fill="none"/>
            </svg>
          </div>
          <span className="ml-2 text-lg font-semibold text-purple-300">DeepResearch</span>
        </Link>
        {/* You can add a logout button or user info here if desired */}
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-4">
        <ResearchChat />
      </main>
      
      {/* Signal that the page has loaded completely */}
      <PageLoadComplete />
    </div>
  );
}
