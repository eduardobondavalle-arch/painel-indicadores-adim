import { describe, expect, it } from "vitest";
import { blankIndicatorValues, parseBrazilianNumber, parseSubmission, serializeIndicatorValues } from "@/lib/submission";

const validInput = () => {
  const values = blankIndicatorValues();
  Object.assign(values, { motivo_nao_renovados: "Não se aplica", motivo_real_perda: "Não se aplica", pontos_atencao: "Sem pontos críticos", faria_diferente: "Manteria o planejamento" });
  return { managerName: "Gestora Teste", managerEmail: "gestora@adimimoveis.com.br", referenceMonth: 8, referenceYear: 2026, confirmedReview: true, values };
};

describe("validação do envio", () => {
  it("aceita os 55 valores e serializa todos", () => {
    const parsed = parseSubmission(validInput());
    expect(serializeIndicatorValues(parsed.values)).toHaveLength(55);
  });

  it("exige descrição quando houver reclamação", () => {
    const input = validInput(); input.values.reclamacoes_google = "1";
    expect(() => parseSubmission(input)).toThrow(/reclamações/i);
  });

  it("interpreta moeda brasileira sem perda decimal", () => {
    expect(parseBrazilianNumber("R$ 1.234,56")).toBe(1234.56);
  });
});
