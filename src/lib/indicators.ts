export type IndicatorType = "integer" | "decimal" | "percent" | "currency" | "nps" | "text";

export type IndicatorDefinition = {
  number: number;
  key: string;
  block: number;
  label: string;
  type: IndicatorType;
  hint?: string;
  restricted?: boolean;
};

export const BLOCKS = [
  { number: 1, title: "Renovação de Contratos", description: "Vencimentos, renovações, antecedência e reajustes." },
  { number: 2, title: "Rescisão e Retenção da Carteira", description: "Encerramentos, vistorias, débitos e retenção dos imóveis." },
  { number: 3, title: "Manutenção e Chamados", description: "Volume, responsabilidade, tempos, SLA, retrabalho e NPS." },
  { number: 4, title: "Relacionamento", description: "Atendimento a proprietários e locatários, NPS e reclamações." },
  { number: 5, title: "Crescimento e Receita", description: "Migrações, Cash Go e imóveis incorporados à carteira." },
  { number: 6, title: "Contexto Operacional", description: "Composição da carteira e aprendizados do mês." },
] as const;

export const INDICATORS: IndicatorDefinition[] = [
  { number: 1, key: "contratos_ativos_mes", block: 1, label: "Total de contratos ativos na carteira no mês", type: "integer" },
  { number: 2, key: "contratos_vencimento_mes", block: 1, label: "Contratos com vencimento no mês", type: "integer" },
  { number: 3, key: "contratos_renovados", block: 1, label: "Desses, quantos foram renovados", type: "integer" },
  { number: 4, key: "contratos_nao_renovados", block: 1, label: "Quantos não foram renovados", type: "integer" },
  { number: 5, key: "motivo_nao_renovados", block: 1, label: "Motivo dos contratos não renovados", type: "text" },
  { number: 6, key: "taxa_renovacao_informada", block: 1, label: "Taxa de renovação do mês — renovados ÷ vencidos", type: "percent" },
  { number: 7, key: "renovacoes_60_dias_ou_mais", block: 1, label: "Renovações tratadas com 60 ou mais dias de antecedência", type: "integer" },
  { number: 8, key: "renovacoes_menos_60_dias", block: 1, label: "Renovações tratadas com menos de 60 dias de antecedência", type: "integer" },
  { number: 9, key: "renovacoes_taxa_cobrada", block: 1, label: "Renovações em que a taxa de renovação foi cobrada", type: "integer" },
  { number: 10, key: "valor_reajustado_mes", block: 1, label: "Total de valor reajustado no mês", type: "currency" },
  { number: 11, key: "percentual_reajuste_medio", block: 1, label: "Percentual de reajuste médio aplicado no mês", type: "percent" },
  { number: 12, key: "total_rescisoes", block: 2, label: "Total de rescisões no mês", type: "integer" },
  { number: 13, key: "rescisoes_sem_inconformidade", block: 2, label: "Rescisões sem inconformidade na vistoria de saída", type: "integer" },
  { number: 14, key: "inconformidade_resolvida", block: 2, label: "Rescisões com inconformidade resolvida antes da entrega ao proprietário", type: "integer" },
  { number: 15, key: "inconformidade_nao_resolvida", block: 2, label: "Rescisões com inconformidade não resolvida na entrega", type: "integer" },
  { number: 16, key: "rescisoes_sem_debito", block: 2, label: "Rescisões sem débito do locatário na entrega", type: "integer", restricted: true },
  { number: 17, key: "rescisoes_com_debito", block: 2, label: "Rescisões com débito do locatário em aberto", type: "integer", restricted: true },
  { number: 18, key: "desocupados_permaneceram_adim", block: 2, label: "Dos desocupados, quantos permaneceram para locação na Adim", type: "integer" },
  { number: 19, key: "desocupados_retirados", block: 2, label: "Dos desocupados, quantos foram retirados pelo proprietário para outra via", type: "integer" },
  { number: 20, key: "motivo_real_perda", block: 2, label: "Dos retirados, qual foi o real motivo da perda", type: "text" },
  { number: 21, key: "chamados_abertos", block: 3, label: "Total de chamados de manutenção abertos no mês", type: "integer" },
  { number: 22, key: "chamados_resolvidos", block: 3, label: "Chamados resolvidos no mês", type: "integer" },
  { number: 23, key: "chamados_em_aberto", block: 3, label: "Chamados em aberto ao fim do mês", type: "integer" },
  { number: 24, key: "chamados_responsabilidade_proprietario", block: 3, label: "Chamados de responsabilidade do proprietário", type: "integer", hint: "Estrutura, infiltração e problemas hidráulicos estruturais." },
  { number: 25, key: "chamados_responsabilidade_locatario", block: 3, label: "Chamados de responsabilidade do locatário", type: "integer", hint: "Danos por uso e quebra de equipamentos durante a ocupação." },
  { number: 26, key: "tempo_primeira_resposta_horas", block: 3, label: "Tempo médio de primeira resposta ao chamado, em horas úteis", type: "decimal" },
  { number: 27, key: "tempo_resolucao_horas", block: 3, label: "Tempo médio de resolução do chamado, em horas", type: "decimal" },
  { number: 28, key: "chamados_dentro_sla", block: 3, label: "Chamados resolvidos dentro do SLA de 48 a 72 horas para reparos simples", type: "integer" },
  { number: 29, key: "chamados_fora_sla", block: 3, label: "Chamados fora do SLA", type: "integer" },
  { number: 30, key: "chamados_reabertos", block: 3, label: "Chamados reabertos ou que geraram retrabalho", type: "integer" },
  { number: 31, key: "taxa_retrabalho_informada", block: 3, label: "Taxa de retrabalho — reabertos ÷ total", type: "percent" },
  { number: 32, key: "nps_manutencao", block: 3, label: "NPS de manutenção, em escala de 0 a 100", type: "nps" },
  { number: 33, key: "tempo_resposta_mensagens_horas", block: 4, label: "Tempo médio de resposta a mensagens, em horas úteis", type: "decimal" },
  { number: 34, key: "nps_proprietarios", block: 4, label: "NPS de proprietários no mês, em escala de 0 a 100", type: "nps" },
  { number: 35, key: "respostas_pesquisa_proprietarios", block: 4, label: "Número de respostas recebidas na pesquisa de proprietários", type: "integer" },
  { number: 36, key: "nps_locatarios", block: 4, label: "NPS de locatários no mês, em escala de 0 a 100", type: "nps" },
  { number: 37, key: "respostas_pesquisa_locatarios", block: 4, label: "Número de respostas recebidas na pesquisa de locatários", type: "integer" },
  { number: 38, key: "reclamacoes_google", block: 4, label: "Reclamações formais no Google atribuíveis à carteira", type: "integer" },
  { number: 39, key: "reclamacoes_reclame_aqui", block: 4, label: "Reclamações no Reclame Aqui atribuíveis à carteira", type: "integer" },
  { number: 40, key: "reclamacoes_diretoria", block: 4, label: "Reclamações escaladas para a diretoria", type: "integer" },
  { number: 41, key: "descricao_reclamacoes", block: 4, label: "Descrição breve de cada reclamação registrada, se houver", type: "text" },
  { number: 42, key: "contratos_migrados_garantida", block: 5, label: "Contratos migrados de administração simples, com taxa de 10%, para administração garantida, com taxa de 15%", type: "integer" },
  { number: 43, key: "valor_alugueis_migrados", block: 5, label: "Valor total dos aluguéis dos contratos migrados", type: "currency" },
  { number: 44, key: "diferenca_taxa_comissao", block: 5, label: "Diferença de taxa gerada — valor da comissão da gestora", type: "currency" },
  { number: 45, key: "cash_go_adesoes", block: 5, label: "Proprietários que aderiram ao Cash Go no mês", type: "integer" },
  { number: 46, key: "cash_go_nao_converteram", block: 5, label: "Proprietários abordados, mas que não fecharam o Cash Go", type: "integer" },
  { number: 47, key: "imoveis_locados_incorporados", block: 5, label: "Imóveis já locados incorporados à carteira por meio de proprietário existente", type: "integer" },
  { number: 48, key: "imoveis_vagos_trazidos", block: 5, label: "Imóveis vagos trazidos por proprietário da carteira para colocar para alugar", type: "integer" },
  { number: 49, key: "contratos_ativos_fim_mes", block: 6, label: "Total de contratos ativos na carteira ao fim do mês", type: "integer" },
  { number: 50, key: "contratos_residenciais", block: 6, label: "Contratos residenciais", type: "integer" },
  { number: 51, key: "contratos_comerciais", block: 6, label: "Contratos comerciais", type: "integer" },
  { number: 52, key: "administracao_simples", block: 6, label: "Contratos com administração simples, taxa de 10%", type: "integer" },
  { number: 53, key: "administracao_garantida", block: 6, label: "Contratos com administração garantida, taxa de 15%", type: "integer" },
  { number: 54, key: "pontos_atencao", block: 6, label: "Pontos de atenção, dificuldades ou situações relevantes do mês", type: "text" },
  { number: 55, key: "faria_diferente", block: 6, label: "O que faria diferente se pudesse refazer o mês", type: "text" },
];

export const INDICATOR_BY_KEY = Object.fromEntries(
  INDICATORS.map((indicator) => [indicator.key, indicator]),
) as Record<string, IndicatorDefinition>;

export function indicatorsForBlock(block: number) {
  return INDICATORS.filter((indicator) => indicator.block === block);
}
