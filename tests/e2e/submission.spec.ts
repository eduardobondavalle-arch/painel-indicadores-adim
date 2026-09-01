import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const enabled = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.E2E_MANAGER_EMAIL);

test("envio completo gera protocolo e o segundo envio é bloqueado", async ({ page }) => {
  test.skip(!enabled, "Configure Supabase, service role e E2E_MANAGER_EMAIL.");
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const now = new Date(); const month = now.getMonth() + 1; const year = now.getFullYear(); const email = process.env.E2E_MANAGER_EMAIL!; const name = process.env.E2E_MANAGER_NAME || "Gestora E2E";
  const manager = await supabase.from("managers").upsert({ name, email, active: true, joined_on: `${year}-01-01`, notes: "CADASTRO AUTOMATIZADO E2E", is_demo: true }, { onConflict: "email" }).select("id").single();
  const period = await supabase.from("submission_periods").upsert({ reference_month: month, reference_year: year, status: "open", opens_at: new Date(Date.now() - 60_000).toISOString(), closes_at: new Date(Date.now() + 86_400_000).toISOString() }, { onConflict: "reference_month,reference_year" }).select("id").single();
  await supabase.from("responses").update({ status: "deleted", deleted_at: new Date().toISOString() }).eq("manager_id", manager.data!.id).eq("period_id", period.data!.id).in("status", ["submitted", "reopened"]);

  async function fillAndSubmit() {
    await page.goto("/formulario");
    await page.getByLabel("Nome completo da gestora").fill(name);
    await page.getByLabel("E-mail corporativo").fill(email);
    await page.locator("#motivo_nao_renovados").fill("Não se aplica");
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.locator("#motivo_real_perda").fill("Não se aplica");
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.locator("#pontos_atencao").fill("Sem pontos críticos");
    await page.locator("#faria_diferente").fill("Manteria o planejamento");
    await page.getByRole("button", { name: "Revisar dados" }).click();
    await page.getByText("Confirmo que conferi os dados.").click();
    await page.getByRole("button", { name: "Confirmar envio" }).click();
  }
  await fillAndSubmit();
  await expect(page.getByText("Envio registrado")).toBeVisible();
  await expect(page.getByText(/ADIM-/)).toBeVisible();
  await fillAndSubmit();
  await expect(page.getByText(/Já existe um envio registrado/)).toBeVisible();
});
