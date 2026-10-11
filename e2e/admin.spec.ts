import { expect, test } from "@playwright/test";

test("el admin navega torneos, nóminas y usuarios", async ({ page }) => {
  await page.goto("/ingresar?next=/admin");
  await page.getByLabel("Correo").fill("admin@demo.ec");
  await page.getByLabel("Contraseña").fill(process.env.DEMO_PASSWORD ?? "Voley2026!");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page.getByRole("heading", { name: "Torneos" })).toBeVisible();

  await page.getByRole("link", { name: /Campeonato Nacional Sub-19/ }).click();
  await expect(page.getByText("Equipos inscritos")).toBeVisible();
  await expect(page.getByText("Asigna planillero")).toBeVisible();

  await page.getByRole("link", { name: "Equipos y nóminas" }).click();
  await page.getByRole("link", { name: /Cóndores/ }).click();
  await expect(page.getByText("12/14 jugadores")).toBeVisible();
  // Cédula inválida: la valida el servidor
  await page.getByLabel("Nombres").fill("Prueba");
  await page.getByLabel("Apellidos").fill("Demo");
  await page.getByLabel("Cédula").fill("1710034066");
  await page.getByLabel("Fecha de nacimiento").fill("2009-05-05");
  await page.getByLabel("Número").fill("13");
  await page.getByRole("button", { name: "Registrar" }).click();
  await expect(page.getByText(/Dígito verificador incorrecto/)).toBeVisible();

  await page.getByRole("link", { name: "Usuarios y roles" }).click();
  await expect(page.getByText("planillero@demo.ec").first()).toBeVisible();
});
