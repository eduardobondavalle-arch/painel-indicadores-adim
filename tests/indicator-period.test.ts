import { describe, expect, it } from "vitest";
import { resolveIndicatorPeriod } from "../src/lib/indicator-period";

const today = new Date(2026, 8, 16);
const periods = [
  { reference_month: 8, reference_year: 2026, status: "closed" },
  { reference_month: 6, reference_year: 2026, status: "open" },
  { reference_month: 9, reference_year: 2026, status: "draft" },
  { reference_month: 12, reference_year: 2025, status: "open" },
];

describe("período inicial dos indicadores", () => {
  it("seleciona o período em aberto mais recente, mesmo com um rascunho posterior", () => {
    expect(resolveIndicatorPeriod({}, periods, today)).toEqual({ month: 6, year: 2026 });
  });

  it("respeita mês e ano escolhidos manualmente", () => {
    expect(resolveIndicatorPeriod({ mes: "2", ano: "2024" }, periods, today)).toEqual({ month: 2, year: 2024 });
  });

  it("mostra o último período cadastrado quando nenhum está aberto", () => {
    expect(resolveIndicatorPeriod({}, periods.filter((period) => period.status !== "open"), today))
      .toEqual({ month: 9, year: 2026 });
  });

  it("usa o mês atual quando não há períodos cadastrados", () => {
    expect(resolveIndicatorPeriod({}, [], today)).toEqual({ month: 9, year: 2026 });
  });

  it("ignora valores de mês e ano inválidos", () => {
    expect(resolveIndicatorPeriod({ mes: "13", ano: "abc" }, periods, today)).toEqual({ month: 6, year: 2026 });
  });
});
