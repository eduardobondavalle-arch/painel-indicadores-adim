import "server-only";

import type { createClient } from "@/lib/supabase/server";
import { calculatePerformance, type BonusInputs, type PerformanceResult, type ScoringConfiguration } from "@/lib/scoring";
import type { RawIndicatorValues } from "@/lib/submission";

type Client = Awaited<ReturnType<typeof createClient>>;
type Row = { id: string; period_id: string };

/** One source of truth for the dashboard, ranking, exports and period closing. */
export async function loadPerformance(supabase: Client, responses: Row[]) {
  const ids = responses.map(row => row.id);
  const periodIds = [...new Set(responses.map(row => row.period_id))];
  const [pillars, parameters, bonuses, values, bonusInputs, frozen, latest] = await Promise.all([
    supabase.from("scoring_pillars").select("id,pillar_number,name,weight,minimum_lock,complaint_absence_weight").order("pillar_number"),
    supabase.from("scoring_parameters").select("indicator_key,pillar_id,weight,minimum_goal,maximum_goal,direction,formal_complaint_veto").in("indicator_key", Array.from({ length: 15 }, (_, i) => `i${i + 1}`)),
    supabase.from("bonus_ranges").select("id,label,minimum_score,amount").order("amount"),
    ids.length ? supabase.from("response_values").select("response_id,indicator_key,value_type,value_numeric,value_text").in("response_id", ids) : Promise.resolve({ data: [], error: null }),
    ids.length ? supabase.from("response_bonus_inputs").select("*").in("response_id", ids) : Promise.resolve({ data: [], error: null }),
    periodIds.length ? supabase.from("period_rule_versions").select("period_id,rule_version_id").in("period_id", periodIds) : Promise.resolve({ data: [], error: null }),
    supabase.from("scoring_rule_versions").select("id,configuration").order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const error = [pillars, parameters, bonuses, values, bonusInputs, frozen, latest].find(item => item.error)?.error;
  if (error) throw new Error(`Não foi possível carregar a régua de bonificação: ${error.message}`);
  const live: ScoringConfiguration = {
    pillars: pillars.data ?? [], parameters: parameters.data ?? [], bonuses: bonuses.data ?? [],
  };
  const pins = new Map((frozen.data ?? []).map(row => [row.period_id, row.rule_version_id]));
  const versionIds = [...new Set([...pins.values()])];
  const versions = versionIds.length ? await supabase.from("scoring_rule_versions").select("id,configuration").in("id", versionIds) : { data: [], error: null };
  if (versions.error) throw new Error(versions.error.message);
  const configs = new Map((versions.data ?? []).map(row => [row.id, row.configuration as ScoringConfiguration]));
  const valuesByResponse = new Map<string, RawIndicatorValues>();
  for (const row of values.data ?? []) {
    const own = valuesByResponse.get(row.response_id) ?? {};
    own[row.indicator_key] = row.value_type === "text" ? row.value_text ?? "" : row.value_numeric === null ? "" : Number(row.value_numeric);
    valuesByResponse.set(row.response_id, own);
  }
  const extras = new Map((bonusInputs.data ?? []).map(row => [row.response_id, row as BonusInputs]));
  const results = new Map<string, PerformanceResult>();
  for (const response of responses) {
    const pinned = pins.get(response.period_id);
    const config = pinned ? configs.get(pinned) : live;
    if (!config) throw new Error("Versão congelada das regras não encontrada.");
    // Historical 55-field responses predate the scale declaration; those fields were NPS, never CSAT.
    const stored = extras.get(response.id);
    const bonus: BonusInputs = { ...stored,
      owner_satisfaction_scale: stored?.owner_satisfaction_scale ?? "nps",
      tenant_satisfaction_scale: stored?.tenant_satisfaction_scale ?? "nps" };
    results.set(response.id, calculatePerformance(valuesByResponse.get(response.id) ?? {}, bonus, config));
  }
  return { results, values: valuesByResponse, extras, live, liveVersionId: latest.data?.id ?? null, frozenVersions: pins };
}
