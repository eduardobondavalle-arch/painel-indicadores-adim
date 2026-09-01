import { expect, test } from "@playwright/test";

test("formulário é público e o painel permanece isolado", async ({ page }) => {
  test.skip(!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, "Configure o Supabase E2E.");
  await page.goto("/formulario");
  await expect(page.getByRole("heading", { name: "Indicadores mensais da carteira" })).toBeVisible();
  await page.goto("/gestao/visao-geral");
  await expect(page).toHaveURL(/\/gestao(?:\?|$)/);
  await expect(page.getByRole("heading", { name: "Painel de gestão" })).toBeVisible();
});
