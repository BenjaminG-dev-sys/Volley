import { expect, test } from "@playwright/test";

// Flujo completo de demo: el planillero anota en la mesa y el marcador público
// (otra pestaña, sin sesión) se actualiza por Realtime sin recargar.
// Ojo: modifica datos; después ejecutar `npm run seed && npm run seed:users`.
test("planillero anota y el marcador público se actualiza en vivo", async ({ browser }) => {
  const scorer = await browser.newContext();
  const page = await scorer.newPage();
  await page.goto("/ingresar?next=/mesa");
  await page.getByLabel("Correo").fill("planillero@demo.ec");
  await page.getByLabel("Contraseña").fill(process.env.DEMO_PASSWORD ?? "Voley2026!");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page.getByRole("heading", { name: "Mesa de control" })).toBeVisible();

  await page.getByRole("link", { name: "Abrir planilla" }).first().click();
  await expect(page.getByText("Sorteo inicial")).toBeVisible();
  const matchUrl = page.url();
  const matchId = matchUrl.split("/").pop()!;

  const viewer = await (await browser.newContext()).newPage();
  await viewer.goto(`/partidos/${matchId}/en-vivo`);
  await expect(viewer.getByText("Conectado en tiempo real")).toBeVisible({ timeout: 20_000 });

  await page.getByRole("button", { name: "Registrar sorteo" }).click();
  for (let i = 0; i < 2; i++) await page.getByRole("button", { name: "Confirmar formación" }).first().click();
  await expect(page.getByRole("button", { name: /Punto/ }).first()).toBeVisible();

  const pointButtons = page.getByRole("button", { name: /^Punto/ });
  await pointButtons.nth(0).click();
  await pointButtons.nth(0).click();
  await pointButtons.nth(1).click();
  await page.getByRole("button", { name: "Tiempo", exact: true }).first().click();

  // Sustitución: tocar un jugador en cancha y elegir un suplente legal
  await page.getByRole("button", { name: /Posición III: N\.º/ }).first().click();
  await page.getByRole("button", { name: /^Entra \d+/ }).first().click();
  await expect(page.getByText(/Sustitución .*sale/)).toBeVisible();

  // Deshacer la sustitución
  await page.getByRole("button", { name: "Deshacer" }).click();
  await expect(page.getByText(/Sustitución .*sale/)).toHaveCount(0);
  await expect(page.getByText("por sincronizar")).toHaveCount(0, { timeout: 15_000 });

  // El marcador público refleja 2-1 y el tiempo, sin recargar
  await expect(viewer.getByText(/Punto para .*\((2-1|1-2)\)/)).toBeVisible({ timeout: 15_000 });
  await expect(viewer.getByText(/Tiempo para/)).toBeVisible();
  await expect(viewer.getByText(/Sustitución/)).toHaveCount(0);
});
