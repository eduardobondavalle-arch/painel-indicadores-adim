import { requireStaff } from "@/lib/auth";
import { PageHeader } from "@/components/dashboard/page-header";
import { PeriodsManager } from "@/components/dashboard/periods-manager";

export default async function PeriodsPage() {
  const { supabase, profile } = await requireStaff();
  const [periodsResult, responsesResult] = await Promise.all([
    supabase.from("submission_periods").select("id,reference_month,reference_year,status,opens_at,closes_at,accept_late,created_at").order("reference_year", { ascending: false }).order("reference_month", { ascending: false }),
    supabase.from("responses").select("period_id,is_late,submitted_manager_name,status").in("status", ["submitted", "reopened"]),
  ]);
  const lateByPeriod = Object.fromEntries((periodsResult.data ?? []).map((period) => [period.id, (responsesResult.data ?? []).filter((response) => response.period_id === period.id && response.is_late).map((response) => response.submitted_manager_name)]));
  const error = periodsResult.error?.message ?? responsesResult.error?.message;
  return <><PageHeader eyebrow="Calendário de coleta" title="Administração de períodos" description="Somente períodos abertos e dentro do prazo aceitam novos formulários; reaberturas após a data limite ficam marcadas como atrasadas." />{error ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</div> : <PeriodsManager periods={periodsResult.data ?? []} lateByPeriod={lateByPeriod} canEdit={profile.role === "admin"} />}</>;
}
