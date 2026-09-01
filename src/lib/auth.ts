import "server-only";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function getStaff() {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError) console.error("Supabase auth validation failed:", userError.message);
  if (!user) return { supabase, user: null, profile: null };
  const { data: profile, error: profileError } = await supabase
    .from("admin_users")
    .select("id,email,display_name,role,active")
    .eq("id", user.id)
    .eq("active", true)
    .maybeSingle();
  if (profileError) console.error("Supabase staff profile lookup failed:", profileError.message);
  return { supabase, user, profile };
}

export async function requireStaff() {
  const context = await getStaff();
  if (!context.user) redirect("/gestao");
  if (!context.profile) redirect("/gestao/sem-acesso");
  return context as typeof context & { user: NonNullable<typeof context.user>; profile: NonNullable<typeof context.profile> };
}

export async function requireAdminApi() {
  const context = await getStaff();
  if (!context.user || !context.profile) return { ok: false as const, status: 401, error: "Não autenticado." };
  if (context.profile.role !== "admin") return { ok: false as const, status: 403, error: "Ação permitida apenas para administradores." };
  return { ok: true as const, ...context };
}
