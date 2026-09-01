import { requireStaff } from "@/lib/auth";
import { ManagersManager } from "@/components/dashboard/managers-manager";
import { PageHeader } from "@/components/dashboard/page-header";

export default async function ManagersPage() {
  const { supabase, profile } = await requireStaff();
  const { data, error } = await supabase.from("managers").select("id,name,email,active,joined_on,notes,is_demo,created_at").order("active", { ascending: false }).order("name");
  return <><PageHeader eyebrow="Equipe" title="Controle de gestoras" description="O cadastro ativo define quem pode enviar e quem aparece como pendente em cada mês." />{error ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error.message}</div> : <ManagersManager initialManagers={data ?? []} canEdit={profile.role === "admin"} />}</>;
}
