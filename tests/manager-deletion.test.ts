import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(join(process.cwd(), "supabase", "migrations", "202609020001_manager_deletion.sql"), "utf8");
const managerUi = readFileSync(join(process.cwd(), "src", "components", "dashboard", "managers-manager.tsx"), "utf8");

describe("exclusão de gestoras", () => {
  it("permite remover o cadastro preservando os envios históricos", () => {
    expect(migration).toContain("alter column manager_id drop not null");
    expect(migration).toContain("on delete set null");
    expect(migration).toContain("if p_delete_data and v_response_count > 0 then");
  });

  it("remove dependências antes das respostas e do cadastro", () => {
    const history = migration.indexOf("delete from public.change_history");
    const alerts = migration.indexOf("delete from public.consistency_alerts");
    const values = migration.indexOf("delete from public.response_values");
    const responses = migration.indexOf("delete from public.responses");
    const manager = migration.indexOf("delete from public.managers");
    expect(history).toBeGreaterThan(-1);
    expect(alerts).toBeGreaterThan(-1);
    expect(values).toBeGreaterThan(-1);
    expect(responses).toBeGreaterThan(values);
    expect(manager).toBeGreaterThan(responses);
  });

  it("restringe a operação a administradores e registra auditoria", () => {
    expect(migration).toContain("if not public.is_admin(auth.uid())");
    expect(migration).toContain("manager.deleted_with_data");
    expect(migration).toContain("manager.deleted_registration");
    expect(migration).toContain("grant execute on function public.delete_manager(uuid, boolean) to authenticated");
  });

  it("exibe as duas confirmações e mantém a inativação disponível", () => {
    expect(managerUi).toContain("Essa ação não poderá ser desfeita");
    expect(managerUi).toContain("Excluir somente o cadastro");
    expect(managerUi).toContain("Excluir cadastro e dados preenchidos");
    expect(managerUi).toContain('manager.active ? "Inativar" : "Ativar"');
  });
});
