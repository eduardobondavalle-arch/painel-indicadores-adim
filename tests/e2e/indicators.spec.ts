import { expect, test } from "@playwright/test";

test("mostra todos os indicadores do bloco sem seleção individual", async ({ page }) => {
  test.skip(!process.env.E2E_ADMIN_EMAIL || !process.env.E2E_ADMIN_PASSWORD, "Configure as credenciais E2E.");

  await page.goto("/gestao");
  await page.getByLabel("E-mail").fill(process.env.E2E_ADMIN_EMAIL!);
  await page.getByLabel("Senha").fill(process.env.E2E_ADMIN_PASSWORD!);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.goto("/gestao/indicadores");

  await expect(page.getByLabel("Categoria")).toHaveValue("1");
  await expect(page.getByLabel("Indicador", { exact: true })).toHaveCount(0);
  await expect(page.locator('section[aria-labelledby^="indicator-"]')).toHaveCount(11);

  await page.getByLabel("Categoria").selectOption("2");

  await expect(page).toHaveURL(/categoria=2/);
  await expect(page.locator('section[aria-labelledby^="indicator-"]')).toHaveCount(9);
  await expect(page.getByRole("heading", { name: "Total de rescisões no mês" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Rescisões sem inconformidade na vistoria de saída" })).toBeVisible();
});
