import type { RawIndicatorValues } from "@/lib/submission";
import { parseBrazilianNumber } from "@/lib/submission";

export type CalculatedMetric = { key: string; label: string; value: number | null; format: "percent" | "number" };
const num = (values: RawIndicatorValues, key: string) => parseBrazilianNumber(values[key] ?? 0) || 0;
const pct = (part: number, total: number) => total > 0 ? Number(((part / total) * 100).toFixed(2)) : null;

export function calculateMetrics(values: RawIndicatorValues): CalculatedMetric[] {
  const retained = num(values, "desocupados_permaneceram_adim");
  const removed = num(values, "desocupados_retirados");
  const cashConversions = num(values, "cash_go_adesoes");
  const cashRejected = num(values, "cash_go_nao_converteram");
  return [
    { key: "taxa_renovacao_calculada", label: "Taxa calculada de renovação", value: pct(num(values, "contratos_renovados"), num(values, "contratos_vencimento_mes")), format: "percent" },
    { key: "taxa_cobranca_renovacao", label: "Taxa de cobrança de renovação", value: pct(num(values, "renovacoes_taxa_cobrada"), num(values, "contratos_renovados")), format: "percent" },
    { key: "taxa_rescisao_sem_inconformidade", label: "Taxa de rescisões sem inconformidade", value: pct(num(values, "rescisoes_sem_inconformidade"), num(values, "total_rescisoes")), format: "percent" },
    { key: "taxa_inconformidade_resolvida", label: "Taxa de inconformidades resolvidas antes da entrega", value: pct(num(values, "inconformidade_resolvida"), num(values, "inconformidade_resolvida") + num(values, "inconformidade_nao_resolvida")), format: "percent" },
    { key: "taxa_retencao_desocupados", label: "Taxa de retenção dos imóveis desocupados", value: pct(retained, retained + removed), format: "percent" },
    { key: "taxa_chamados_resolvidos", label: "Taxa de chamados resolvidos", value: pct(num(values, "chamados_resolvidos"), num(values, "chamados_abertos")), format: "percent" },
    { key: "taxa_chamados_sla", label: "Taxa de chamados dentro do SLA", value: pct(num(values, "chamados_dentro_sla"), num(values, "chamados_resolvidos")), format: "percent" },
    { key: "taxa_retrabalho_calculada", label: "Taxa calculada de retrabalho", value: pct(num(values, "chamados_reabertos"), num(values, "chamados_abertos")), format: "percent" },
    { key: "taxa_conversao_cash_go", label: "Taxa de conversão do Cash Go", value: pct(cashConversions, cashConversions + cashRejected), format: "percent" },
    { key: "participacao_garantida", label: "Participação da administração garantida", value: pct(num(values, "administracao_garantida"), num(values, "contratos_ativos_fim_mes")), format: "percent" },
    { key: "crescimento_liquido", label: "Crescimento líquido informado da carteira", value: num(values, "imoveis_locados_incorporados") + num(values, "imoveis_vagos_trazidos") - removed, format: "number" },
  ];
}

export function rateDivergences(values: RawIndicatorValues) {
  const calculated = calculateMetrics(values);
  const comparisons = [
    { informedKey: "taxa_renovacao_informada", calculatedKey: "taxa_renovacao_calculada", label: "taxa de renovação" },
    { informedKey: "taxa_retrabalho_informada", calculatedKey: "taxa_retrabalho_calculada", label: "taxa de retrabalho" },
  ];
  return comparisons.flatMap((comparison) => {
    const informed = num(values, comparison.informedKey);
    const system = calculated.find((item) => item.key === comparison.calculatedKey)?.value;
    if (system == null || Math.abs(informed - system) <= 0.1) return [];
    return [{ ...comparison, informed, calculated: system }];
  });
}
