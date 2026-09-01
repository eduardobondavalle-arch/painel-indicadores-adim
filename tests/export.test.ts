import { describe, expect, it } from "vitest";
import { exportFilename, toCsv } from "@/lib/export";

describe("exportações", () => {
  it("gera CSV compatível com Excel em pt-BR", () => {
    const csv = toCsv(["Gestora", "Observação"], [["Ana", "Texto; com separador"]]);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain('"Texto; com separador"');
  });
  it("usa nomes claros com referência e gestora", () => {
    expect(exportFilename("resposta", 8, 2026, "Ana Souza", "pdf")).toBe("adim-resposta-08-2026-ana-souza.pdf");
  });
});
