// Crea los usuarios demo y asigna roles. Uso: npm run seed:users
// Requiere que el proyecto tenga desactivada la verificación de correo (insforge.toml).
import { createAdminClient, createClient } from "@insforge/sdk";

const baseUrl = process.env.NEXT_PUBLIC_INSFORGE_URL!;
const anonKey = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY!;
const admin = createAdminClient({ baseUrl, apiKey: process.env.INSFORGE_API_KEY! }).database;
const PASSWORD = process.env.DEMO_PASSWORD ?? "Voley2026!";

const USERS = [
  { email: "admin@demo.ec", name: "Admin Demo", role: "admin" },
  { email: "organizador@demo.ec", name: "Organizadora Demo", role: "organizer" },
  { email: "planillero@demo.ec", name: "Planillero Demo", role: "scorer" },
] as const;

for (const u of USERS) {
  const c = createClient({ baseUrl, anonKey, isServerMode: true });
  // Si ya existe, basta con iniciar sesión para obtener su id.
  const created = await c.auth.signUp({ email: u.email, password: PASSWORD, name: u.name });
  const res = created.error ? await c.auth.signInWithPassword({ email: u.email, password: PASSWORD }) : created;
  const id = res.data?.user?.id;
  if (!id) throw new Error(`${u.email}: ${res.error?.message}`);
  const { error: e2 } = await admin.from("profiles").upsert([{ user_id: id, email: u.email, display_name: u.name, role: u.role }]);
  if (e2) throw new Error(`${u.email} perfil: ${e2.message}`);
  console.log(`✓ ${u.email} (${u.role})`);
}

// El planillero queda asignado a todos los partidos no terminados.
const { data: scorer } = await admin.from("profiles").select("user_id").eq("email", "planillero@demo.ec").single();
const { error } = await admin.from("matches").update({ scorer_id: scorer!.user_id }).neq("status", "finished");
if (error) throw new Error(error.message);
console.log("✓ planillero asignado a los partidos en vivo y programados");
