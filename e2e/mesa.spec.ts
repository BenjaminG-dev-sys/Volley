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

  await expect(page.getByText("Juego bloqueado.")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Punto/ }).first()).toBeDisabled();
  await page.getByRole("button", { name: "Iniciar cronómetro" }).click();
  await expect(page.getByText("Juego bloqueado.")).toHaveCount(0);

  // Ecuavóley con cambio de saque: solo suma quien saca; el que recibe y gana la jugada recupera el saque.
  const point = () => page.getByRole("button", { name: /^Punto/ }).first();
  await point().click(); // 1-0 (saca el local)
  await point().click(); // 2-0
  await page.getByRole("button", { name: /^Gana la jugada/ }).click(); // cambio de saque, sigue 2-0
  await point().click(); // 2-1 (ahora saca el visitante)
  // Solo puede pedir tiempo el equipo que tiene el saque
  await page.locator("button:not([disabled])", { hasText: /^\s*Tiempo\s*$/ }).first().click();

  // Sustitución libre: tocar un jugador en cancha y elegir un suplente
  await page.getByRole("button", { name: /(Colocador|Volador): N\.º/ }).first().click();
  await page.getByRole("button", { name: /^Entra \d+/ }).first().click();
  await expect(page.getByText(/Sustitución .*sale/)).toBeVisible();

  // Deshacer la sustitución
  await page.getByRole("button", { name: "Deshacer" }).click();
  await expect(page.getByText(/Sustitución .*sale/)).toHaveCount(0);
  await expect(page.getByText("por sincronizar")).toHaveCount(0, { timeout: 15_000 });

  // El marcador público refleja 2-1 y el tiempo, sin recargar
  await expect(viewer.getByText(/Punto para .*\(2-1\)/)).toBeVisible({ timeout: 15_000 });
  await expect(viewer.getByText(/Tiempo para/)).toBeVisible();
  await expect(viewer.getByText(/Sustitución/)).toHaveCount(0);
});
