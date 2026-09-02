import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const api = readFileSync(join(process.cwd(), "src", "app", "api", "admin", "periods", "route.ts"), "utf8");
const manager = readFileSync(join(process.cwd(), "src", "components", "dashboard", "periods-manager.tsx"), "utf8");

describe("ajuste de períodos", () => {
  it("permite atualizar a data limite pela API administrativa", () => {
    expect(api).toContain("closesAt: z.iso.datetime().nullable().optional()");
    expect(api).toContain("payload.closes_at = body.closesAt");
    expect(api).toContain('action = body.closesAt !== undefined ? "period.adjusted"');
  });

  it("preserva a abertura original ao reativar um período já aberto anteriormente", () => {
    expect(api).toContain("if (!current.opens_at) payload.opens_at = now.toISOString()");
    expect(api).toContain("payload.accept_late = body.acceptLate");
  });

  it("oferece ajuste de prazo e reativação no mesmo formulário", () => {
    expect(manager).toContain("Ajustar período");
    expect(manager).toContain("Nova data e hora limite");
    expect(manager).toContain("Reativar período após salvar");
    expect(manager).toContain("Salvar e reativar");
  });

  it("mantém as ações independentes de abrir, reabrir e fechar", () => {
    expect(manager).toContain('period.status === "closed" ? "Reabrir" : "Abrir"');
    expect(manager).toContain(">Fechar</Button>");
  });
});
