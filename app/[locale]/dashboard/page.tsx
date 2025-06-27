import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AgentDashboard from "@/components/dashboard/AgentDashboard";

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    redirect("/auth/login");
  }

  return <AgentDashboard userId={data.user.id} />;
} 