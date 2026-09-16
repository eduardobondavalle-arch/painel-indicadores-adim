import { describe, expect, it } from "vitest";
import { OFFICIAL_KPIS, awardPerformance, calculatePerformance, deriveOfficialKpis, normalizeKpi, scoringConfigurationIssues, type BonusInputs, type ScoringConfiguration } from "@/lib/scoring";
import { blankIndicatorValues } from "@/lib/submission";

const config: ScoringConfiguration = {
  pillars: [
    { id: "p1", pillar_number: 1, name: "Crescimento e Receita", weight: 35, minimum_lock: 70 },
    { id: "p2", pillar_number: 2, name: "Renovação e Retenção", weight: 25, minimum_lock: 70 },
    { id: "p3", pillar_number: 3, name: "Rescisão e Retenção de Carteira", weight: 15, minimum_lock: 70 },
    { id: "p4", pillar_number: 4, name: "Manutenção", weight: 15, minimum_lock: 70 },
    { id: "p5", pillar_number: 5, name: "Relacionamento e Atendimento", weight: 10, minimum_lock: 70, complaint_absence_weight: 15 },
  ],
  parameters: OFFICIAL_KPIS.map(k => ({ indicator_key: k.key, pillar_id: `p${k.pillar}`, weight: k.weight,
    minimum_goal: Math.min(k.zero, k.full), maximum_goal: Math.max(k.zero, k.full), direction: k.direction,
    formal_complaint_veto: false })),
  bonuses: [300, 500, 800].map((amount, i) => ({ id: `b${i}`, label: `Faixa ${i}`, amount, minimum_score: [50, 70, 90][i] })),
};

const example = (overrides: Record<string, string | number> = {}, extras: BonusInputs = {}) => ({
  values: { ...blankIndicatorValues(), ...overrides },
  bonus: { eligible_renewals: 0, adjustments_due: 0, adjustments_on_time: 0, eligible_vacancies: 0,
    maintenance_csat: 4.5, owner_satisfaction_scale: "nps" as const, tenant_satisfaction_scale: "nps" as const,
    cash_go_verified: 0, ...extras },
});

describe("régua oficial e limites", () => {
  it("configura cinco pilares, 15 KPIs, pesos totais e termo ajustável de 15%", () => {
    expect(OFFICIAL_KPIS).toHaveLength(15);
    expect(scoringConfigurationIssues(config.pillars, config.parameters, config.bonuses)).toEqual([]);
    const changed = { ...config.pillars[4], complaint_absence_weight: 14 };
    expect(scoringConfigurationIssues([...config.pillars.slice(0, 4), changed], config.parameters, config.bonuses)).not.toEqual([]);
  });

  it("normaliza 0–100 em ambas as direções sem arredondar cedo", () => {
    expect(normalizeKpi(100, 0, 50, "higher_is_better")).toBe(100);
    expect(normalizeKpi(-1, 0, 50, "higher_is_better")).toBe(0);
    expect(normalizeKpi(5, 24, 4, "lower_is_better")).toBe(95);
    expect(normalizeKpi(0, 24, 4, "lower_is_better")).toBe(100);
    expect(normalizeKpi(30, 24, 4, "lower_is_better")).toBe(0);
  });

  it("deriva os 15 KPIs das entradas oficiais sem misturar NPS e CSAT", () => {
    const { values, bonus } = example({ renovacoes_taxa_cobrada: 4, contratos_migrados_garantida: 2,
      imoveis_locados_incorporados: 1, imoveis_vagos_trazidos: 1, contratos_vencimento_mes: 10, contratos_renovados: 9,
      renovacoes_60_dias_ou_mais: 6, renovacoes_menos_60_dias: 3, total_rescisoes: 5,
      rescisoes_sem_inconformidade: 3, inconformidade_resolvida: 1, desocupados_permaneceram_adim: 3,
      tempo_primeira_resposta_horas: 5, tempo_resolucao_horas: 60, chamados_abertos: 20,
      chamados_reabertos: 1, tempo_resposta_mensagens_horas: 3, nps_proprietarios: 70, nps_locatarios: 60 },
    { eligible_renewals: 10, adjustments_due: 5, adjustments_on_time: 4, eligible_vacancies: 4, maintenance_csat: 4.2 });
    expect(deriveOfficialKpis(values, bonus)).toEqual({
      i1: 40, i2: 2, i3: 2, i4: 90, i5: 6 / 9 * 100, i6: 80, i7: 80, i8: 75,
      i9: 5, i10: 60, i11: 5, i12: 4.2, i13: 3, i14: 70, i15: 60,
    });
    expect(deriveOfficialKpis(values, { ...bonus, maintenance_csat: null }).i12).toBeNull();
    expect(deriveOfficialKpis(values, { ...bonus, owner_satisfaction_scale: null }).i14).toBeNull();
  });

  it("distingue denominador zero de dados faltantes e rejeita frações incoerentes", () => {
    const { values, bonus } = example();
    const k = deriveOfficialKpis(values, bonus);
    expect([k.i1, k.i4, k.i6, k.i7, k.i8, k.i11, k.i5]).toEqual([100, 100, 100, 100, 100, 0, 0]);
    expect(deriveOfficialKpis(values, { ...bonus, eligible_renewals: null }).i1).toBeNull();
    expect(deriveOfficialKpis({ ...values, renovacoes_taxa_cobrada: 2 }, { ...bonus, eligible_renewals: 1 }).i1).toBeNull();
    const result = calculatePerformance(values, { ...bonus, maintenance_csat: null }, config);
    expect(result.score).toBeNull();
    expect(result.bonus).toBeNull();
    expect(result.missing).toContain("i12");
  });

  it("aplica R$0/R$300/R$500/R$800 exatamente nos limiares não arredondados", () => {
    const ranges = config.bonuses;
    expect(ranges.map(r => r.minimum_score)).toEqual([50, 70, 90]);
    expect([49.99, 50, 69.99, 70, 89.99, 90, 100].map(s => awardPerformance(s, [{ locked: false }], ranges)))
      .toEqual([0, 300, 300, 500, 500, 800, 800]);
    expect(awardPerformance(90, [{ locked: true }], ranges)).toBe(500);
    expect(awardPerformance(90, [{ locked: false }], ranges.map(r => r.amount === 800 ? { ...r, minimum_score: 95 } : r))).toBe(500);
  });
});

const sheetCases = [
  { name: "Gestora 1", raw: { renovacoes_taxa_cobrada: 4, contratos_migrados_garantida: 4, imoveis_locados_incorporados: 1, total_rescisoes: 4, rescisoes_sem_inconformidade: 4, desocupados_permaneceram_adim: 3, tempo_primeira_resposta_horas: 3, tempo_resolucao_horas: 40, chamados_abertos: 20, chamados_reabertos: 1, tempo_resposta_mensagens_horas: 1.5, nps_proprietarios: 78, nps_locatarios: 75, cash_go_adesoes: 2 }, bonus: { eligible_renewals: 10, eligible_vacancies: 3, maintenance_csat: 4.7, cash_go_verified: 2 }, pillars: [92, 70, 100, 93.75, 100], score: 88.7625, performance: 500, cash: 200 },
  { name: "Gestora 2", raw: { total_rescisoes: 5, rescisoes_sem_inconformidade: 3, desocupados_permaneceram_adim: 3, tempo_primeira_resposta_horas: 8, tempo_resolucao_horas: 60, chamados_abertos: 18, chamados_reabertos: 3, tempo_resposta_mensagens_horas: 5, nps_proprietarios: 55, nps_locatarios: 50 }, bonus: { eligible_vacancies: 4, maintenance_csat: 4 }, pillars: [40, 70, 68.75, 60.66666666666667, 68.25], score: 57.7375, performance: 300, cash: 0 },
  { name: "Gestora 3", raw: { total_rescisoes: 3, rescisoes_sem_inconformidade: 3, desocupados_permaneceram_adim: 2, tempo_primeira_resposta_horas: 2.5, tempo_resolucao_horas: 36, chamados_abertos: 22, tempo_resposta_mensagens_horas: 1, nps_proprietarios: 85, nps_locatarios: 82 }, bonus: { eligible_vacancies: 2, maintenance_csat: 4.8, cash_go_verified: 3 }, pillars: [40, 70, 100, 100, 100], score: 71.5, performance: 500, cash: 300 },
  { name: "Gestora 4", raw: { total_rescisoes: 6, rescisoes_sem_inconformidade: 3, desocupados_permaneceram_adim: 2, tempo_primeira_resposta_horas: 18, tempo_resolucao_horas: 90, chamados_abertos: 15, chamados_reabertos: 5, tempo_resposta_mensagens_horas: 10, nps_proprietarios: 35, nps_locatarios: 32, reclamacoes_google: 1 }, bonus: { eligible_vacancies: 5, maintenance_csat: 3.2, cash_go_verified: 1 }, pillars: [40, 70, 31.25, 14.75, 0], score: 38.4, performance: 0, cash: 100 },
  { name: "Gestora 5", raw: { total_rescisoes: 4, rescisoes_sem_inconformidade: 4, desocupados_permaneceram_adim: 3, tempo_primeira_resposta_horas: 5, tempo_resolucao_horas: 50, chamados_abertos: 19, chamados_reabertos: 2, tempo_resposta_mensagens_horas: 3, nps_proprietarios: 68, nps_locatarios: 65 }, bonus: { eligible_vacancies: 3, maintenance_csat: 4.4, cash_go_verified: 1 }, pillars: [40, 70, 100, 83.0921052631579, 92.5], score: 68.21381578947368, performance: 300, cash: 100 },
] as const;

describe("paridade dos cinco exemplos ilustrativos do XLSX (Cálculo!C:G)", () => {
  for (const sample of sheetCases) {
    it(sample.name, () => {
      const input = example(sample.raw, sample.bonus);
      const result = calculatePerformance(input.values, input.bonus, config);
      expect(result.configurationIssues).toEqual([]);
      expect(result.missing).toEqual([]);
      expect(result.pillarScores.map(p => p.score)).toEqual(sample.pillars.map(x => expect.closeTo(x, 8)));
      expect(result.score).toBeCloseTo(sample.score, 8);
      expect(result.bonus).toBe(sample.performance);
      expect(result.cashGo).toBe(sample.cash);
      expect(result.total).toBe(sample.performance + sample.cash);
    });
  }

  it("reclamação formal zera apenas relacionamento; Cash Go permanece pago", () => {
    const input = example({ ...sheetCases[0].raw, reclamacoes_reclame_aqui: 1 }, sheetCases[0].bonus);
    const normal = calculatePerformance(example(sheetCases[0].raw, sheetCases[0].bonus).values, input.bonus, config);
    const blocked = calculatePerformance(input.values, input.bonus, config);
    expect(blocked.pillarScores[4].score).toBe(0);
    expect(blocked.score).toBeCloseTo(normal.score! - 10, 8);
    expect(blocked.cashGo).toBe(200);
    expect(blocked.complaintApplied).toBe(true);
  });

  it("Cash Go não altera o score nem o bônus de performance; débito gerencial não altera nada", () => {
    const input = example(sheetCases[0].raw, sheetCases[0].bonus);
    const baseline = calculatePerformance(input.values, input.bonus, config);
    const changed = calculatePerformance({ ...input.values, rescisoes_sem_debito: 1, rescisoes_com_debito: 4, cash_go_adesoes: 999 },
      { ...input.bonus, cash_go_verified: 7 }, config);
    expect(changed.score).toBe(baseline.score);
    expect(changed.bonus).toBe(baseline.bonus);
    expect(changed.cashGo).toBe(700);
  });
});

describe("cenários completos e versão histórica", () => {
  const optimal = () => example({ contratos_vencimento_mes: 10, contratos_renovados: 10,
    renovacoes_taxa_cobrada: 10, renovacoes_60_dias_ou_mais: 10, renovacoes_menos_60_dias: 0,
    contratos_migrados_garantida: 2, imoveis_locados_incorporados: 1,
    tempo_primeira_resposta_horas: 4, tempo_resolucao_horas: 48,
    chamados_abertos: 10, tempo_resposta_mensagens_horas: 2,
    nps_proprietarios: 70, nps_locatarios: 70, cash_go_adesoes: 3 },
  { eligible_renewals: 10, adjustments_due: 10, adjustments_on_time: 10, maintenance_csat: 4.5, cash_go_verified: 3 });

  it("D/G: desempenho pleno paga R$800 e Cash Go permanece separado", () => {
    const { values, bonus } = optimal();
    const result = calculatePerformance(values, bonus, config);
    expect(result.score).toBe(100);
    expect(result.pillarScores.map(p => p.score)).toEqual([100, 100, 100, 100, 100]);
    expect([result.bonus, result.cashGo, result.total]).toEqual([800, 300, 1100]);
  });

  it("E: score >=90 com pilar <70 cai para R$500; F: reclamação zera o pilar, não o bônus inteiro", () => {
    const { values, bonus } = optimal();
    const gated = calculatePerformance({ ...values, nps_proprietarios: 30, nps_locatarios: 30 }, bonus, config);
    expect(gated.score).toBe(95);
    expect(gated.pillarScores[4].score).toBe(50);
    expect(gated.bonus).toBe(500);
    const complaint = calculatePerformance({ ...values, reclamacoes_google: 1 }, bonus, config);
    expect(complaint.pillarScores[4].score).toBe(0);
    expect(complaint.score).toBe(90);
    expect([complaint.bonus, complaint.cashGo, complaint.total]).toEqual([500, 300, 800]);
  });

  it("mudanças administrativas usam valores atuais sem modificar o snapshot da régua antiga", () => {
    const { values, bonus } = optimal();
    const changed = { ...values, tempo_resposta_mensagens_horas: 7 };
    const old = structuredClone(config); // equivalent to the period's frozen configuration
    const original = calculatePerformance(changed, bonus, old);
    const updated = structuredClone(config);
    updated.pillars[4].complaint_absence_weight = 20;
    updated.parameters.find(k => k.indicator_key === "i13")!.weight = 30;
    expect(scoringConfigurationIssues(updated.pillars, updated.parameters, updated.bonuses)).toEqual([]);
    expect(calculatePerformance(changed, bonus, old).score).toBe(original.score);
    expect(calculatePerformance(changed, bonus, updated).score).not.toBe(original.score);
    const corrected = calculatePerformance({ ...changed, tempo_resposta_mensagens_horas: 2 }, bonus, old);
    expect(corrected.score).not.toBe(original.score);
    expect(changed.tempo_resposta_mensagens_horas).toBe(7); // original submission is not mutated
  });
});
