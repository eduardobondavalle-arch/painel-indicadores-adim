import { z } from "zod";
import { INDICATORS, type IndicatorDefinition } from "@/lib/indicators";

export type RawIndicatorValues = Record<string, string | number>;
export type SubmissionInput = {
  managerName: string;
  managerEmail: string;
  referenceMonth: number;
  referenceYear: number;
  confirmedReview: boolean;
  values: RawIndicatorValues;
  bonusInputs?: PublicBonusInputs;
};

export type PublicBonusInputs = {
  eligible_renewals: number;
  adjustments_due: number;
  adjustments_on_time: number;
  eligible_vacancies: number;
  maintenance_csat: number;
  owner_satisfaction_scale: "nps";
  tenant_satisfaction_scale: "nps";
};

const bonusInputSchema = z.object({
  eligible_renewals: z.coerce.number().int().nonnegative(),
  adjustments_due: z.coerce.number().int().nonnegative(),
  adjustments_on_time: z.coerce.number().int().nonnegative(),
  eligible_vacancies: z.coerce.number().int().nonnegative(),
  maintenance_csat: z.coerce.number().min(1).max(5),
  owner_satisfaction_scale: z.literal("nps"),
  tenant_satisfaction_scale: z.literal("nps"),
});

const baseSchema = z.object({
  managerName: z.string().trim().min(3, "Informe o nome completo da gestora."),
  managerEmail: z.email("Informe um e-mail corporativo válido.").transform((value) => value.toLowerCase()),
  referenceMonth: z.coerce.number().int().min(1).max(12),
  referenceYear: z.coerce.number().int().min(2020).max(2100),
  confirmedReview: z.literal(true, { error: "Confirme que os dados foram conferidos." }),
  values: z.record(z.string(), z.union([z.string(), z.number()])),
  bonusInputs: bonusInputSchema.optional(),
});

export function parseBrazilianNumber(value: string | number): number {
  if (typeof value === "number") return value;
  const cleaned = value.trim().replace(/R\$/g, "").replace(/\s/g, "");
  if (!cleaned) return Number.NaN;
  if (cleaned.includes(",")) return Number(cleaned.replace(/\./g, "").replace(",", "."));
  return Number(cleaned);
}

export function validateIndicator(indicator: IndicatorDefinition, raw: string | number | undefined) {
  const value = raw == null ? "" : String(raw).trim();
  if (indicator.type === "text") {
    if (indicator.key === "descricao_reclamacoes") return null;
    return value.length > 0 ? null : "Este campo é obrigatório.";
  }
  const numeric = parseBrazilianNumber(raw ?? "");
  if (!Number.isFinite(numeric)) return "Informe um número válido.";
  if (numeric < 0) return "O valor não pode ser negativo.";
  if (indicator.type === "integer" && !Number.isInteger(numeric)) return "Informe um número inteiro.";
  if ((indicator.type === "percent" || indicator.type === "nps") && numeric > 100) return "Informe um valor entre 0 e 100.";
  return null;
}

export function parseSubmission(input: unknown): SubmissionInput {
  const parsed = baseSchema.parse(input);
  const issues: z.core.$ZodIssue[] = [];
  for (const indicator of INDICATORS) {
    const message = validateIndicator(indicator, parsed.values[indicator.key]);
    if (message) {
      issues.push({ code: "custom", path: ["values", indicator.key], message, input: parsed.values[indicator.key] });
    }
  }
  const complaintTotal = ["reclamacoes_google", "reclamacoes_reclame_aqui", "reclamacoes_diretoria"]
    .reduce((sum, key) => sum + (parseBrazilianNumber(parsed.values[key] ?? 0) || 0), 0);
  if (complaintTotal > 0 && !String(parsed.values.descricao_reclamacoes ?? "").trim()) {
    issues.push({ code: "custom", path: ["values", "descricao_reclamacoes"], message: "Descreva as reclamações registradas.", input: parsed.values.descricao_reclamacoes });
  }
  if (parsed.bonusInputs) {
    const extra = parsed.bonusInputs;
    const compare = (condition: boolean, field: string, message: string) => {
      if (condition) issues.push({ code: "custom", path: ["bonusInputs", field], message, input: extra[field as keyof PublicBonusInputs] });
    };
    compare(extra.adjustments_on_time > extra.adjustments_due, "adjustments_on_time", "Os reajustes corretos não podem superar os devidos.");
    compare(extra.eligible_renewals < (parseBrazilianNumber(parsed.values.renovacoes_taxa_cobrada ?? 0) || 0), "eligible_renewals", "As renovações elegíveis não podem ser inferiores às taxas cobradas.");
    compare(extra.eligible_vacancies < (parseBrazilianNumber(parsed.values.desocupados_permaneceram_adim ?? 0) || 0), "eligible_vacancies", "As desocupações elegíveis não podem ser inferiores às retidas.");
  }
  if (issues.length) throw new z.ZodError(issues);
  return parsed;
}

export function serializeIndicatorValues(values: RawIndicatorValues) {
  return INDICATORS.map((indicator) => ({
    key: indicator.key,
    number: indicator.number,
    block: indicator.block,
    label: indicator.label,
    type: indicator.type,
    value: indicator.type === "text"
      ? String(values[indicator.key] ?? "").trim()
      : parseBrazilianNumber(values[indicator.key] ?? ""),
  }));
}

export function blankIndicatorValues(): Record<string, string> {
  return Object.fromEntries(INDICATORS.map((indicator) => [indicator.key, indicator.type === "text" ? "" : "0"]));
}
