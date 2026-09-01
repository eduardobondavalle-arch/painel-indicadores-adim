import { describe, expect, it } from "vitest";
import { calculateMetrics } from "@/lib/calculations";
import { blankIndicatorValues } from "@/lib/submission";

describe("indicadores calculados", () => {
  it("calcula taxas sem sobrescrever a entrada", () => {
    const values = blankIndicatorValues();
    Object.assign(values, { contratos_vencimento_mes: "10", contratos_renovados: "8", taxa_renovacao_informada: "75", cash_go_adesoes: "3", cash_go_nao_converteram: "2" });
    const metrics = calculateMetrics(values);
    expect(metrics.find((item) => item.key === "taxa_renovacao_calculada")?.value).toBe(80);
    expect(metrics.find((item) => item.key === "taxa_conversao_cash_go")?.value).toBe(60);
    expect(values.taxa_renovacao_informada).toBe("75");
  });
});
