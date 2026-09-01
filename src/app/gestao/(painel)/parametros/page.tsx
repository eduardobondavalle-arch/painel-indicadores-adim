import { requireStaff } from "@/lib/auth";
import { ScoringManager } from "@/components/dashboard/scoring-manager";
import { PageHeader } from "@/components/dashboard/page-header";

export default async function ParametersPage() {
  const { supabase, profile } = await requireStaff();
  const [pillars, parameters, bonuses] = await Promise.all([
    supabase.from("scoring_pillars").select("id,pillar_number,name,weight,minimum_lock").order("pillar_number"),
    supabase.from("scoring_parameters").select("id,indicator_key,pillar_id,weight,minimum_goal,maximum_goal,direction,formal_complaint_veto"),
    supabase.from("bonus_ranges").select("id,label,minimum_score,amount").order("amount"),
  ]);
  const error = pillars.error?.message ?? parameters.error?.message ?? bonuses.error?.message;
  return <><PageHeader eyebrow="Modelo configurável" title="Parâmetros de pontuação" description="Defina pilares, metas, direção e faixas. O sistema só libera score e bônus quando a configuração estiver completa." />{error ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</div> : <ScoringManager initialPillars={pillars.data ?? []} initialParameters={parameters.data ?? []} initialBonuses={bonuses.data ?? []} canEdit={profile.role === "admin"} />}</>;
}
