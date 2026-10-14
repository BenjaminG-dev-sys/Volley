import { expect, test } from "@playwright/test";

test("el admin navega el panel, torneos, nóminas y usuarios", async ({ page }) => {
  await page.goto("/ingresar?next=/admin");
  await page.getByLabel("Correo").fill("admin@demo.ec");
  await page.getByLabel("Contraseña").fill(process.env.DEMO_PASSWORD ?? "Voley2026!");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page.getByRole("heading", { name: "Hoy en la liga" })).toBeVisible();

  const nav = page.getByRole("navigation", { name: "Panel" });
  await nav.getByRole("link", { name: "Torneos" }).click();
  await page.getByRole("link", { name: /Campeonato Metropolitano Sub-19/ }).click();
  const tabs = page.getByRole("navigation", { name: "Secciones del torneo" });
  await tabs.getByRole("link", { name: "Equipos", exact: true }).click();
  await expect(page.getByText("Equipos inscritos")).toBeVisible();
  await tabs.getByRole("link", { name: "Partidos", exact: true }).click();
  await expect(page.getByText(/Planillero, árbitros/)).toBeVisible();

  await nav.getByRole("link", { name: "Equipos y nóminas" }).click();
  await page.getByRole("link", { name: /Conocoto/ }).click();
  await expect(page.getByText(/12\/14 jugadores/)).toBeVisible();
  // Cédula inválida: la valida el servidor
  const add = page.locator("form", { has: page.getByRole("button", { name: "Registrar" }) });
  await add.getByLabel("Nombres").fill("Prueba");
  await add.getByLabel("Apellidos").fill("Demo");
  await add.getByLabel("Cédula").fill("1710034066");
  await add.getByLabel("Fecha de nacimiento").fill("2009-05-05");
  await add.getByLabel("Número").fill("13");
  await add.getByRole("button", { name: "Registrar" }).click();
  await expect(page.getByText(/Dígito verificador incorrecto/)).toBeVisible();

  // Buscador global
  await page.keyboard.press("Control+k");
  await page.getByPlaceholder(/Escribe al menos 2 letras/).fill("Conocoto");
  await expect(page.getByRole("dialog", { name: "Buscar" }).getByText(/Conocoto/).first()).toBeVisible();
  await page.keyboard.press("Escape");

  await nav.getByRole("link", { name: "Usuarios y roles" }).click();
  await expect(page.getByText("planillero@demo.ec").first()).toBeVisible();
});
