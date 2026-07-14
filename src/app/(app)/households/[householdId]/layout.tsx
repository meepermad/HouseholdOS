import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function HouseholdLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("household_memberships")
    .select("id")
    .eq("household_id", householdId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (!membership) notFound();

  return children;
}
