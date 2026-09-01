import { expect, test } from "@playwright/test";

test("login administrativo e exportação protegida", async ({ page }) => {
  test.skip(!process.env.E2E_ADMIN_EMAIL || !process.env.E2E_ADMIN_PASSWORD, "Configure as credenciais E2E.");
  await page.goto("/gestao");
  await page.getByLabel("E-mail").fill(process.env.E2E_ADMIN_EMAIL!);
  await page.getByLabel("Senha").fill(process.env.E2E_ADMIN_PASSWORD!);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/gestao\/visao-geral/);
  await expect(page.getByRole("heading", { name: /.+/ }).first()).toBeVisible();
  const response = await page.request.get("/api/admin/export?type=monthly&format=xlsx");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("spreadsheetml");
});
