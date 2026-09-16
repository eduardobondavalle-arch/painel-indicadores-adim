import type { RawIndicatorValues } from "@/lib/submission";
import { parseBrazilianNumber } from "@/lib/submission";

export type Pillar = {
  id: string;
  pillar_number: number;
  name: string;
  weight: number | null;
  minimum_lock: number | null;
  complaint_absence_weight?: number | null;
};
export type ScoringParameter = {
  id?: string;
  indicator_key: string;
  pillar_id: string;
  weight: number | null;
  minimum_goal: number | null;
  maximum_goal: number | null;
  direction: "higher_is_better" | "lower_is_better" | null;
  formal_complaint_veto: boolean;
};
export type BonusRange = { id: string; label: string; minimum_score: number | null; amount: number };
export type ScoringConfiguration = { pillars: Pillar[]; parameters: ScoringParameter[]; bonuses: BonusRange[] };

export type BonusInputs = {
  eligible_renewals?: number | null;
  adjustments_due?: number | null;
  adjustments_on_time?: number | null;
  eligible_vacancies?: number | null;
  maintenance_csat?: number | null;
  owner_satisfaction_scale?: "nps" | "csat_0_100" | null;
  tenant_satisfaction_scale?: "nps" | "csat_0_100" | null;
  directorate_complaints_attributable?: number | null;
  cash_go_verified?: number | null;
  capture_fee_amount?: number | null;
  migration_commission_amount?: number | null;
};

export const OFFICIAL_KPIS = [
  { key: "i1", number: 1, name: "Taxa de renovação com cobrança de taxa", pillar: 1, weight: 40, zero: 0, full: 50, direction: "higher_is_better" },
  { key: "i2", number: 2, name: "Migrações para Administração Garantida", pillar: 1, weight: 35, zero: 0, full: 2, direction: "higher_is_better" },
  { key: "i3", number: 3, name: "Captação via proprietário da carteira", pillar: 1, weight: 25, zero: 0, full: 1, direction: "higher_is_better" },
  { key: "i4", number: 4, name: "Taxa de renovação dos contratos vencidos", pillar: 2, weight: 50, zero: 60, full: 95, direction: "higher_is_better" },
  { key: "i5", number: 5, name: "Renovações tratadas com 60+ dias", pillar: 2, weight: 30, zero: 0, full: 100, direction: "higher_is_better" },
  { key: "i6", number: 6, name: "Reajustes corretos e no prazo", pillar: 2, weight: 20, zero: 0, full: 100, direction: "higher_is_better" },
  { key: "i7", number: 7, name: "Rescisões sem inconformidade ou resolvidas", pillar: 3, weight: 50, zero: 0, full: 80, direction: "higher_is_better" },
  { key: "i8", number: 8, name: "Retenção após desocupação elegível", pillar: 3, weight: 50, zero: 50, full: 90, direction: "higher_is_better" },
  { key: "i9", number: 9, name: "Tempo médio de primeira resposta (h)", pillar: 4, weight: 30, zero: 24, full: 4, direction: "lower_is_better" },
  { key: "i10", number: 10, name: "Tempo médio de resolução (h)", pillar: 4, weight: 30, zero: 96, full: 48, direction: "lower_is_better" },
  { key: "i11", number: 11, name: "Taxa de retrabalho", pillar: 4, weight: 25, zero: 20, full: 0, direction: "lower_is_better" },
  { key: "i12", number: 12, name: "CSAT pós-manutenção (1–5)", pillar: 4, weight: 15, zero: 3, full: 4.5, direction: "higher_is_better" },
  { key: "i13", number: 13, name: "Tempo médio de resposta às mensagens (h)", pillar: 5, weight: 35, zero: 12, full: 2, direction: "lower_is_better" },
  { key: "i14", number: 14, name: "Satisfação dos proprietários (0–100)", pillar: 5, weight: 30, zero: 30, full: 70, direction: "higher_is_better" },
  { key: "i15", number: 15, name: "Satisfação dos locatários (0–100)", pillar: 5, weight: 20, zero: 30, full: 70, direction: "higher_is_better" },
] as const;

const clamp = (number: number) => Math.max(0, Math.min(100, number));
const parse = (value: string | number | null | undefined): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const number = parseBrazilianNumber(value);
  return Number.isFinite(number) ? number : null;
};

function ratio(numerator: number | null, denominator: number | null, whenZero: 0 | 100): number | null {
  if (numerator === null || denominator === null || denominator < 0 || numerator < 0) return null;
  if (denominator === 0) return numerator === 0 ? whenZero : null;
  if (numerator > denominator) return null;
  return numerator / denominator * 100;
}

/** Raw results in the units used by the official spreadsheet: percentages 0–100, hours, counts, CSAT 1–5. */
export function deriveOfficialKpis(values: RawIndicatorValues, bonus: BonusInputs): Record<string, number | null> {
  const n = (key: string) => parse(values[key]);
  const renewed = n("contratos_renovados");
  const inAdvance = n("renovacoes_60_dias_ou_mais");
  const late = n("renovacoes_menos_60_dias");
  const eligible = parse(bonus.eligible_vacancies);
  const retained = n("desocupados_permaneceram_adim");
  const clean = n("rescisoes_sem_inconformidade");
  const resolved = n("inconformidade_resolvida");
  const ownerScale = bonus.owner_satisfaction_scale;
  const tenantScale = bonus.tenant_satisfaction_scale;
  return {
    i1: ratio(n("renovacoes_taxa_cobrada"), parse(bonus.eligible_renewals), 100),
    i2: n("contratos_migrados_garantida"),
    i3: n("imoveis_locados_incorporados") === null || n("imoveis_vagos_trazidos") === null
      ? null : n("imoveis_locados_incorporados")! + n("imoveis_vagos_trazidos")!,
    i4: ratio(renewed, n("contratos_vencimento_mes"), 100),
    i5: inAdvance === null || late === null ? null : ratio(inAdvance, inAdvance + late, 0),
    i6: ratio(parse(bonus.adjustments_on_time), parse(bonus.adjustments_due), 100),
    i7: clean === null || resolved === null ? null : ratio(clean + resolved, n("total_rescisoes"), 100),
    i8: ratio(retained, eligible, 100),
    i9: n("tempo_primeira_resposta_horas"),
    i10: n("tempo_resolucao_horas"),
    i11: ratio(n("chamados_reabertos"), n("chamados_abertos"), 0),
    i12: parse(bonus.maintenance_csat),
    i13: n("tempo_resposta_mensagens_horas"),
    i14: ownerScale === "nps" ? n("nps_proprietarios") : null,
    i15: tenantScale === "nps" ? n("nps_locatarios") : null,
  };
}

export function normalizeKpi(value: number, zero: number, full: number, direction: "higher_is_better" | "lower_is_better") {
  if (!Number.isFinite(value) || zero === full) throw new Error("Meta ou resultado de KPI inválido.");
  if (direction === "higher_is_better" && full <= zero) throw new Error("Metas crescentes inválidas.");
  if (direction === "lower_is_better" && full >= zero) throw new Error("Metas decrescentes inválidas.");
  return clamp((value - zero) / (full - zero) * 100);
}

export function scoringConfigurationIssues(pillars: Pillar[], parameters: ScoringParameter[], bonuses: BonusRange[]) {
  const issues: string[] = [];
  if (pillars.length !== 5 || new Set(pillars.map(p => p.pillar_number)).size !== 5 ||
    pillars.some(p => p.weight == null || p.minimum_lock == null || Number(p.weight) < 0 || Number(p.minimum_lock) < 0))
    issues.push("Configure peso e trava dos cinco pilares oficiais.");
  if (Math.abs(pillars.reduce((sum, p) => sum + Number(p.weight ?? 0), 0) - 100) > 1e-7)
    issues.push("Os pesos dos pilares devem somar 100%.");
  if (parameters.length !== 15 || new Set(parameters.map(p => p.indicator_key)).size !== 15 ||
    OFFICIAL_KPIS.some(k => !parameters.some(p => p.indicator_key === k.key)))
    issues.push("Configure exatamente os 15 KPIs oficiais.");
  for (const pillar of pillars) {
    const own = parameters.filter(p => p.pillar_id === pillar.id);
    const remainder = pillar.pillar_number === 5 ? Number(pillar.complaint_absence_weight ?? NaN) : 0;
    if (!Number.isFinite(remainder) || remainder < 0 || remainder > 100 ||
      Math.abs(own.reduce((sum, p) => sum + Number(p.weight ?? 0), 0) + remainder - 100) > 1e-7)
      issues.push(`Os pesos do pilar ${pillar.pillar_number} devem somar 100% (incluindo a condição de reclamação no pilar 5).`);
  }
  for (const kpi of OFFICIAL_KPIS) {
    const param = parameters.find(p => p.indicator_key === kpi.key);
    if (!param) continue;
    if (pillars.find(p => p.id === param.pillar_id)?.pillar_number !== kpi.pillar ||
      param.weight == null || param.minimum_goal == null || param.maximum_goal == null || !param.direction ||
      !Number.isFinite(Number(param.weight)) || Number(param.weight) < 0 ||
      (param.direction === "higher_is_better" && Number(param.maximum_goal) <= Number(param.minimum_goal)) ||
      (param.direction === "lower_is_better" && Number(param.maximum_goal) <= Number(param.minimum_goal)))
      issues.push(`Parâmetros inválidos para ${kpi.key.toUpperCase()}.`);
  }
  const thresholds = [300, 500, 800].map(amount => bonuses.find(b => Number(b.amount) === amount)?.minimum_score);
  if (bonuses.length !== 3 || thresholds.some(value => value == null || Number(value) < 0 || Number(value) > 100) ||
    !(Number(thresholds[0]) < Number(thresholds[1]) && Number(thresholds[1]) < Number(thresholds[2])))
    issues.push("Configure faixas crescentes e distintas para R$300, R$500 e R$800.");
  return issues;
}

export type KpiResult = { key: string; name: string; value: number | null; goalZero: number; goalFull: number; direction: string; score: number | null; weight: number; contribution: number | null };
export type PillarResult = { number: number; name: string; score: number | null; weight: number; minimumLock: number; locked: boolean | null; absenceContribution: number; kpis: KpiResult[] };
export type PerformanceResult = {
  score: number | null;
  pillarScores: PillarResult[];
  complaintApplied: boolean;
  bonus: number | null;
  cashGo: number | null;
  total: number | null;
  captureFee: number | null;
  migrationCommission: number | null;
  missing: string[];
  configurationIssues: string[];
};

export function awardPerformance(score: number, pillarScores: Pick<PillarResult, "locked">[], bonuses: BonusRange[]): number {
  const thresholds = [300, 500, 800].map(amount => Number(bonuses.find(b => Number(b.amount) === amount)?.minimum_score));
  return score >= thresholds[2] && pillarScores.every(p => p.locked === false) ? 800 :
    score >= thresholds[1] ? 500 : score >= thresholds[0] ? 300 : 0;
}

export function calculatePerformance(values: RawIndicatorValues, bonus: BonusInputs, config: ScoringConfiguration): PerformanceResult {
  const configurationIssues = scoringConfigurationIssues(config.pillars, config.parameters, config.bonuses);
  const metrics = deriveOfficialKpis(values, bonus);
  const complaints = (parse(values.reclamacoes_google) ?? 0) + (parse(values.reclamacoes_reclame_aqui) ?? 0) +
    (parse(bonus.directorate_complaints_attributable) ?? parse(values.reclamacoes_diretoria) ?? 0);
  const complaintApplied = complaints >= 1;
  const missing = OFFICIAL_KPIS.filter(kpi => metrics[kpi.key] === null).map(kpi => kpi.key);
  const pillarScores = [...config.pillars].sort((a, b) => a.pillar_number - b.pillar_number).map(pillar => {
    const kpis = OFFICIAL_KPIS.filter(k => k.pillar === pillar.pillar_number).map(kpi => {
      const param = config.parameters.find(p => p.indicator_key === kpi.key);
      const value = metrics[kpi.key];
      const score = param && value !== null && param.minimum_goal !== null && param.maximum_goal !== null && param.direction
        ? normalizeKpi(value, Number(param.direction === "lower_is_better" ? param.maximum_goal : param.minimum_goal),
          Number(param.direction === "lower_is_better" ? param.minimum_goal : param.maximum_goal), param.direction)
        : null;
      return { key: kpi.key, name: kpi.name, value, goalZero: Number(param?.direction === "lower_is_better" ? param.maximum_goal : param?.minimum_goal),
        goalFull: Number(param?.direction === "lower_is_better" ? param.minimum_goal : param?.maximum_goal),
        direction: param?.direction ?? kpi.direction, score, weight: Number(param?.weight ?? 0), contribution: score === null ? null : score * Number(param?.weight ?? 0) / 100 };
    });
    const absenceContribution = pillar.pillar_number === 5 && !complaintApplied ? Number(pillar.complaint_absence_weight ?? 0) : 0;
    const score = complaintApplied && pillar.pillar_number === 5 ? 0 : kpis.some(k => k.score === null) ? null :
      kpis.reduce((sum, k) => sum + Number(k.contribution), 0) + absenceContribution;
    return { number: pillar.pillar_number, name: pillar.name, score, weight: Number(pillar.weight ?? 0),
      minimumLock: Number(pillar.minimum_lock ?? 0), locked: score === null ? null : score < Number(pillar.minimum_lock),
      absenceContribution, kpis };
  });
  const score = configurationIssues.length || pillarScores.some(p => p.score === null) ? null :
    pillarScores.reduce((sum, p) => sum + Number(p.score) * p.weight / 100, 0);
  const performanceBonus = score === null ? null : awardPerformance(score, pillarScores, config.bonuses);
  const verified = parse(bonus.cash_go_verified);
  const cashGo = verified === null || !Number.isInteger(verified) || verified < 0 ? null : verified * 100;
  const total = performanceBonus === null || cashGo === null ? null : performanceBonus + cashGo;
  return { score, pillarScores, complaintApplied, bonus: performanceBonus, cashGo, total,
    captureFee: parse(bonus.capture_fee_amount), migrationCommission: parse(bonus.migration_commission_amount),
    missing, configurationIssues };
}
