import { describe, expect, it } from "vitest";
import { getConsistencyAlerts } from "@/lib/consistency";
import { blankIndicatorValues } from "@/lib/submission";

describe("alertas de consistência", () => {
  it("não bloqueia zeros coerentes", () => {
    expect(getConsistencyAlerts(blankIndicatorValues())).toEqual([]);
  });

  it("detecta composição divergente de renovações", () => {
    const values = blankIndicatorValues();
    Object.assign(values, { contratos_vencimento_mes: "10", contratos_renovados: "7", contratos_nao_renovados: "1", renovacoes_60_dias_ou_mais: "5", renovacoes_menos_60_dias: "5", taxa_renovacao_informada: "70" });
    expect(getConsistencyAlerts(values).map((item) => item.code)).toContain("RENOVACAO_TOTAL");
  });

  it("preserva e sinaliza taxa informada diferente da calculada", () => {
    const values = blankIndicatorValues();
    Object.assign(values, { contratos_vencimento_mes: "10", contratos_renovados: "8", contratos_nao_renovados: "2", renovacoes_60_dias_ou_mais: "5", renovacoes_menos_60_dias: "5", taxa_renovacao_informada: "75" });
    expect(getConsistencyAlerts(values).map((item) => item.code)).toContain("TAXA_RENOVACAO_DIVERGENTE");
    expect(values.taxa_renovacao_informada).toBe("75");
  });
});
