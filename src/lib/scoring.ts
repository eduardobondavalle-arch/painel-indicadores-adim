import type { RawIndicatorValues } from "@/lib/submission";
import { parseBrazilianNumber } from "@/lib/submission";

export type Pillar = { id: string; pillar_number: number; name: string; weight: number | null; minimum_lock: number | null };
export type ScoringParameter = { id?: string; indicator_key: string; pillar_id: string; weight: number | null; minimum_goal: number | null; maximum_goal: number | null; direction: "higher_is_better" | "lower_is_better" | null; formal_complaint_veto: boolean };
export type BonusRange = { id: string; label: string; minimum_score: number | null; amount: number };

export function scoringConfigurationIssues(pillars: Pillar[], parameters: ScoringParameter[], bonuses: BonusRange[]) {
  const issues: string[] = [];
  if (pillars.length !== 5 || pillars.some((pillar) => pillar.weight == null || pillar.minimum_lock == null)) issues.push("Preencha peso e trava mínima dos cinco pilares.");
  const pillarWeight = pillars.reduce((sum, pillar) => sum + Number(pillar.weight ?? 0), 0);
  if (Math.abs(pillarWeight - 100) > 0.01) issues.push("Os pesos dos pilares devem somar 100%.");
  if (!parameters.length) issues.push("Configure ao menos um indicador.");
  if (parameters.some((parameter) => parameter.weight == null || parameter.minimum_goal == null || parameter.maximum_goal == null || !parameter.direction)) issues.push("Complete peso, metas e direção de todos os indicadores configurados.");
  for (const pillar of pillars) {
    const own = parameters.filter((parameter) => parameter.pillar_id === pillar.id);
    if (own.length && Math.abs(own.reduce((sum, parameter) => sum + Number(parameter.weight ?? 0), 0) - 100) > 0.01) issues.push(`Os pesos dos indicadores do pilar “${pillar.name}” devem somar 100%.`);
  }
  if (bonuses.length !== 3 || bonuses.some((bonus) => bonus.minimum_score == null)) issues.push("Defina as três faixas de bônus.");
  return issues;
}

export function calculateScore(values: RawIndicatorValues, pillars: Pillar[], parameters: ScoringParameter[]) {
  const pillarScores = pillars.map((pillar) => {
    const own = parameters.filter((parameter) => parameter.pillar_id === pillar.id);
    const score = own.reduce((sum, parameter) => {
      const value = parseBrazilianNumber(values[parameter.indicator_key] ?? 0) || 0;
      const min = Number(parameter.minimum_goal); const max = Number(parameter.maximum_goal);
      let normalized = max === min ? (value >= max ? 100 : 0) : ((value - min) / (max - min)) * 100;
      if (parameter.direction === "lower_is_better") normalized = 100 - normalized;
      return sum + Math.max(0, Math.min(100, normalized)) * (Number(parameter.weight) / 100);
    }, 0);
    return { ...pillar, score, locked: score < Number(pillar.minimum_lock) };
  });
  const veto = parameters.some((parameter) => parameter.formal_complaint_veto && Number(values[parameter.indicator_key] ?? 0) > 0);
  const score = pillarScores.reduce((sum, pillar) => sum + pillar.score * (Number(pillar.weight) / 100), 0);
  return { score: Number(score.toFixed(2)), pillarScores, veto: veto || pillarScores.some((pillar) => pillar.locked) };
}
