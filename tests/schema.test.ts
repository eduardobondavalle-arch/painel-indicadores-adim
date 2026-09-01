import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { INDICATORS } from "@/lib/indicators";

const migration = readFileSync(join(process.cwd(), "supabase", "migrations", "202609010001_initial_schema.sql"), "utf8");

describe("contrato de segurança do banco", () => {
  it("mantém o catálogo canônico de chaves sincronizado com a aplicação", () => {
    for (const indicator of INDICATORS) expect(migration).toContain(`'${indicator.key}'`);
  });

  it("ativa RLS e não concede leitura pública das respostas", () => {
    expect(migration).toContain("alter table public.responses enable row level security");
    expect(migration).toContain("revoke all on all tables in schema public from anon");
    expect(migration).not.toContain("grant select on public.responses to anon");
  });

  it("impõe unicidade ativa e auditoria obrigatória", () => {
    expect(migration).toContain("responses_one_active_per_manager_period");
    expect(migration).toContain("Justificativa obrigatória");
    expect(migration).toContain("when unique_violation");
  });
});
