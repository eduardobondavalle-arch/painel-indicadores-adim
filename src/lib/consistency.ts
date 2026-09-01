import type { RawIndicatorValues } from "@/lib/submission";
import { parseBrazilianNumber } from "@/lib/submission";

export type ConsistencyAlert = { code: string; message: string; keys: string[] };

const n = (values: RawIndicatorValues, key: string) => parseBrazilianNumber(values[key] ?? 0) || 0;

export function getConsistencyAlerts(values: RawIndicatorValues): ConsistencyAlert[] {
  const alerts: ConsistencyAlert[] = [];
  const compare = (code: string, left: number, right: number, message: string, keys: string[]) => {
    if (left !== right) alerts.push({ code, message, keys });
  };

  compare("RENOVACAO_TOTAL", n(values, "contratos_renovados") + n(values, "contratos_nao_renovados"), n(values, "contratos_vencimento_mes"), "Renovados + não renovados difere dos contratos com vencimento.", ["contratos_renovados", "contratos_nao_renovados", "contratos_vencimento_mes"]);
  compare("RENOVACAO_ANTECEDENCIA", n(values, "renovacoes_60_dias_ou_mais") + n(values, "renovacoes_menos_60_dias"), n(values, "contratos_vencimento_mes"), "A soma das renovações por antecedência difere do total com vencimento.", ["renovacoes_60_dias_ou_mais", "renovacoes_menos_60_dias", "contratos_vencimento_mes"]);
  compare("RESCISAO_VISTORIA", n(values, "rescisoes_sem_inconformidade") + n(values, "inconformidade_resolvida") + n(values, "inconformidade_nao_resolvida"), n(values, "total_rescisoes"), "A composição das vistorias difere do total de rescisões.", ["rescisoes_sem_inconformidade", "inconformidade_resolvida", "inconformidade_nao_resolvida", "total_rescisoes"]);
  compare("RESCISAO_DEBITOS", n(values, "rescisoes_sem_debito") + n(values, "rescisoes_com_debito"), n(values, "total_rescisoes"), "Rescisões sem débito + com débito difere do total de rescisões.", ["rescisoes_sem_debito", "rescisoes_com_debito", "total_rescisoes"]);
  compare("CHAMADOS_ANDAMENTO", n(values, "chamados_resolvidos") + n(values, "chamados_em_aberto"), n(values, "chamados_abertos"), "Resolvidos + em aberto difere dos chamados abertos no mês.", ["chamados_resolvidos", "chamados_em_aberto", "chamados_abertos"]);
  compare("CHAMADOS_RESPONSABILIDADE", n(values, "chamados_responsabilidade_proprietario") + n(values, "chamados_responsabilidade_locatario"), n(values, "chamados_abertos"), "A classificação por responsabilidade difere do total de chamados.", ["chamados_responsabilidade_proprietario", "chamados_responsabilidade_locatario", "chamados_abertos"]);
  compare("CHAMADOS_SLA", n(values, "chamados_dentro_sla") + n(values, "chamados_fora_sla"), n(values, "chamados_resolvidos"), "Chamados dentro + fora do SLA difere dos chamados resolvidos.", ["chamados_dentro_sla", "chamados_fora_sla", "chamados_resolvidos"]);
  compare("CARTEIRA_TIPO", n(values, "contratos_residenciais") + n(values, "contratos_comerciais"), n(values, "contratos_ativos_fim_mes"), "Residenciais + comerciais difere do total de contratos ativos.", ["contratos_residenciais", "contratos_comerciais", "contratos_ativos_fim_mes"]);
  compare("CARTEIRA_MODALIDADE", n(values, "administracao_simples") + n(values, "administracao_garantida"), n(values, "contratos_ativos_fim_mes"), "Administração simples + garantida difere do total de contratos ativos.", ["administracao_simples", "administracao_garantida", "contratos_ativos_fim_mes"]);

  const renewalBase = n(values, "contratos_vencimento_mes");
  const calculatedRenewal = renewalBase > 0 ? (n(values, "contratos_renovados") / renewalBase) * 100 : 0;
  if (renewalBase > 0 && Math.abs(calculatedRenewal - n(values, "taxa_renovacao_informada")) > 0.1) {
    alerts.push({ code: "TAXA_RENOVACAO_DIVERGENTE", message: "A taxa de renovação informada diverge da taxa calculada pelo sistema.", keys: ["taxa_renovacao_informada", "contratos_renovados", "contratos_vencimento_mes"] });
  }
  const reworkBase = n(values, "chamados_abertos");
  const calculatedRework = reworkBase > 0 ? (n(values, "chamados_reabertos") / reworkBase) * 100 : 0;
  if (reworkBase > 0 && Math.abs(calculatedRework - n(values, "taxa_retrabalho_informada")) > 0.1) {
    alerts.push({ code: "TAXA_RETRABALHO_DIVERGENTE", message: "A taxa de retrabalho informada diverge da taxa calculada pelo sistema.", keys: ["taxa_retrabalho_informada", "chamados_reabertos", "chamados_abertos"] });
  }
  return alerts;
}
