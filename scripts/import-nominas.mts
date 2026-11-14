import { readFile } from "node:fs/promises";
import path from "node:path";
import { createAdminClient } from "@insforge/sdk";

type Row = { cedula: string; first_name: string; last_name: string; number: number; tipo?: string };
type TeamIn = { name: string; short_name: string; logo: string; players: Row[] };
type Data = { tournament: string; teams: TeamIn[] };

const [jsonPath, logosDir] = process.argv.slice(2);
if (!jsonPath || !logosDir) throw new Error('Uso: npm run import:nominas -- "<nominas-alrq.json>" "<carpeta de logos>"');

const url = process.env.NEXT_PUBLIC_INSFORGE_URL;
const apiKey = process.env.INSFORGE_API_KEY;
if (!url || !apiKey) throw new Error("Faltan NEXT_PUBLIC_INSFORGE_URL / INSFORGE_API_KEY en .env.local");
const client = createAdminClient({ baseUrl: url, apiKey });
const db = client.database;

async function q<T>(p: PromiseLike<{ data: T | null; error: unknown }>, what: string): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(`${what}: ${JSON.stringify(error)}`);
  return data as T;
}

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

async function main() {
  const data = JSON.parse(await readFile(jsonPath, "utf-8")) as Data;
  const existing = await q<{ id: string; name: string; short_name: string; logo_key: string | null }[]>(
    db.from("teams").select("id, name, short_name, logo_key").eq("sport", "ecuavoley"),
    "leer equipos",
  );
  let created = 0, updated = 0, players = 0;

  for (const t of data.teams) {
    let team = existing.find((e) => norm(e.short_name) === norm(t.short_name));
    if (team) {
      await q(db.from("teams").update({ name: t.name, short_name: t.short_name }).eq("id", team.id), `actualizar ${t.short_name}`);
      updated++;
    } else {
      const [row] = await q<{ id: string; name: string; short_name: string; logo_key: string | null }[]>(
        db.from("teams").insert([{ name: t.name, short_name: t.short_name, city: t.short_name, province: "Pichincha", sport: "ecuavoley" }]).select("id, name, short_name, logo_key"),
        `crear ${t.short_name}`,
      );
      team = row;
      created++;
    }

    const bytes = await readFile(path.join(logosDir, t.logo));
    const file = new File([bytes], `${norm(t.short_name).replace(/[^a-z0-9]+/g, "-")}.png`, { type: "image/png" });
    const up = await q<{ url: string; key: string }>(
      client.storage.from("media").upload(`teams/${team.id}/${crypto.randomUUID()}.png`, file),
      `logo ${t.short_name}`,
    );
    await q(db.from("teams").update({ logo_url: up.url, logo_key: up.key }).eq("id", team.id), `guardar logo ${t.short_name}`);
    if (team.logo_key && team.logo_key !== up.key) await client.storage.from("media").remove(team.logo_key);

    if (t.players.length) {
      const cedulas = t.players.map((p) => p.cedula);
      await q(db.from("players").delete().eq("team_id", team.id), `vaciar nómina ${t.short_name}`);
      await q(db.from("players").delete().in("cedula", cedulas), `liberar cédulas ${t.short_name}`);
      await q(
        db.from("players").insert(
          t.players.map((p) => ({ team_id: team!.id, cedula: p.cedula, first_name: p.first_name, last_name: p.last_name, number: p.number })),
        ),
        `nómina ${t.short_name}`,
      );
      players += t.players.length;
    }
    console.log(`✓ ${t.name} — logo + ${t.players.length} jugadores`);
  }
  console.log(`\nListo: ${created} equipos nuevos, ${updated} actualizados, ${players} jugadores (${data.tournament}).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
