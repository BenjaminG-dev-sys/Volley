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

// La planilla solo se edita en el horario designado (30 min antes a 4 h después).
// Para la demo, el partido en vivo empezó hace 1 h y el primer programado arranca en 15 min.
const now = Date.now();
const { data: live } = await admin.from("matches").select("id").eq("status", "live").limit(1);
const { data: next } = await admin.from("matches").select("id").eq("status", "scheduled").order("scheduled_at").limit(1);
for (const [rows, at] of [[live, now - 3600_000], [next, now + 15 * 60_000]] as const) {
  const id = rows?.[0]?.id;
  if (!id) continue;
  const { error: e3 } = await admin.from("matches").update({ scheduled_at: new Date(at).toISOString() }).eq("id", id);
  if (e3) throw new Error(e3.message);
}
console.log("✓ horarios demo dentro de la ventana de planilla");
