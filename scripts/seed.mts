// Datos de demostración (todo ecuavóley). Uso: npm run seed  (lee .env.local; requiere INSFORGE_API_KEY)
// Borra y vuelve a crear organizaciones, sedes, árbitros, torneo, equipos, jugadores y partidos.
// Los partidos terminados se generan reproduciendo eventos con el motor de planilla.
// 16 equipos en 4 grupos de 4. Las fechas son relativas al día en que se ejecuta: la jornada 3 siempre es "hoy".

import { createAdminClient } from "@insforge/sdk";
import { buildSetup, eventToRow, matchPatch } from "../src/lib/match";
import { simulateMatch, rng } from "../src/lib/scoresheet/simulate";
import { makeCedula } from "../src/lib/tournament/cedula";
import { roundRobin, snakeGroups, groupLabel } from "../src/lib/tournament/scheduler";
import type { PlayerPublic, Team, Tournament } from "../src/lib/types";

const url = process.env.NEXT_PUBLIC_INSFORGE_URL;
const apiKey = process.env.INSFORGE_API_KEY;
if (!url || !apiKey) throw new Error("Faltan NEXT_PUBLIC_INSFORGE_URL / INSFORGE_API_KEY en .env.local");
const db = createAdminClient({ baseUrl: url, apiKey }).database;

async function q<T>(p: PromiseLike<{ data: T | null; error: unknown }>, what: string): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(`${what}: ${JSON.stringify(error)}`);
  return data as T;
}

const rand = rng(2026);
const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)];

const MEN = ["Carlos", "Luis", "Jorge", "Diego", "Andrés", "Fernando", "Pablo", "Santiago", "Javier", "Marco", "Byron", "Edison", "Wilson", "Patricio"];
const LAST = ["Andrade", "Zambrano", "Cedeño", "Guerrero", "Mendoza", "Vera", "Paredes", "Chávez", "Morales", "Salazar",
  "Quiñónez", "Bravo", "Villacís", "Ortiz", "Jaramillo", "Loor", "Castro", "Cevallos", "Benítez", "Montalvo"];

// 16 parroquias rurales del Distrito Metropolitano de Quito. `zone` elige la asociación
// (1 = norte, 2 = valles) y `r` es el nivel relativo para la simulación.
const PARISHES = [
  { name: "Liga Parroquial Zámbiza", short: "Zámbiza", c1: "#0f766e", zone: 1, r: 0.56 },
  { name: "Liga Parroquial Calderón", short: "Calderón", c1: "#b91c1c", zone: 1, r: 0.52 },
  { name: "Liga Parroquial Cumbayá", short: "Cumbayá", c1: "#1d4ed8", zone: 2, r: 0.5 },
  { name: "Liga Parroquial Llano Chico", short: "Llano Chico", c1: "#7c3aed", zone: 1, r: 0.46 },
  { name: "Liga Parroquial Nayón", short: "Nayón", c1: "#ca8a04", zone: 1, r: 0.48 },
  { name: "Liga Parroquial Tumbaco", short: "Tumbaco", c1: "#15803d", zone: 2, r: 0.53 },
  { name: "Liga Parroquial Pomasqui", short: "Pomasqui", c1: "#ea580c", zone: 1, r: 0.51 },
  { name: "Liga Parroquial Conocoto", short: "Conocoto", c1: "#0369a1", zone: 2, r: 0.49 },
  { name: "Liga Parroquial Amaguaña", short: "Amaguaña", c1: "#be185d", zone: 2, r: 0.55 },
  { name: "Liga Parroquial Pifo", short: "Pifo", c1: "#4d7c0f", zone: 2, r: 0.47 },
  { name: "Liga Parroquial Puembo", short: "Puembo", c1: "#9333ea", zone: 2, r: 0.5 },
  { name: "Liga Parroquial Yaruquí", short: "Yaruquí", c1: "#c2410c", zone: 2, r: 0.45 },
  { name: "Liga Parroquial Alangasí", short: "Alangasí", c1: "#0891b2", zone: 2, r: 0.52 },
  { name: "Liga Parroquial Guayllabamba", short: "Guayllabamba", c1: "#a16207", zone: 1, r: 0.44 },
  { name: "Liga Parroquial Píntag", short: "Píntag", c1: "#1e3a8a", zone: 2, r: 0.54 },
  { name: "Liga Parroquial El Quinche", short: "El Quinche", c1: "#991b1b", zone: 2, r: 0.48 },
];
// 3 titulares (servidor, colocador, volador) + 3 suplentes; el tope de ecuavóley es 7.
const ECUA_ROLES = ["servidor", "colocador", "volador", "servidor", "colocador", "volador"] as const;
const REFEREES = ["Luis Paredes", "Carmen Vélez", "Jorge Almeida", "Patricia Ruiz", "Diego Cárdenas", "Silvia Narváez"];
const TIMES = ["10:00", "11:30", "13:00", "14:30"]; // hora de Ecuador

async function wipe() {
  // El orden respeta las claves foráneas (match_events cae en cascada con matches).
  for (const t of ["matches", "tournament_teams", "players", "teams", "tournaments", "venues", "organizations", "referees"]) {
    const key = t === "tournament_teams" ? "tournament_id" : "id";
    await q(db.from(t).delete().not(key, "is", null), `wipe ${t}`);
  }
}

/** Fecha ISO para la jornada `round` (1–3): la 3 es hoy, cada jornada anterior una semana antes. */
function roundSlot(round: number, slot: number) {
  const todayEct = new Date(Date.now() - 5 * 3600_000).toISOString().slice(0, 10);
  const day = new Date(Date.parse(`${todayEct}T12:00:00Z`) - (3 - round) * 7 * 86400_000).toISOString().slice(0, 10);
  // 8 partidos por jornada: dos a la vez (en sedes distintas) en cada horario.
  return new Date(`${day}T${TIMES[Math.floor(slot / 2) % TIMES.length]}:00-05:00`).toISOString();
}

async function main() {
  console.log("Limpiando datos anteriores…");
  await wipe();

  console.log("Organizaciones, sedes y árbitros…");
  const orgs = await q<{ id: string; short_name: string }[]>(
    db.from("organizations").insert([
      { name: "Liga Cantonal de Ecuavóley de Quito (demo)", short_name: "LCEQ", kind: "league", province: "Pichincha" },
      { name: "Asociación de Ligas Parroquiales del Norte", short_name: "ALP Norte", kind: "association", province: "Pichincha" },
      { name: "Asociación de Ligas Parroquiales de los Valles", short_name: "ALP Valles", kind: "association", province: "Pichincha" },
    ]).select("id, short_name"),
    "organizations",
  );
  const venues = await q<{ id: string }[]>(
    db.from("venues").insert([
      { name: "Coliseo de Calderón", city: "Quito", province: "Pichincha" },
      { name: "Cancha cubierta de Zámbiza", city: "Quito", province: "Pichincha" },
      { name: "Cancha del Parque de Cumbayá", city: "Quito", province: "Pichincha" },
    ]).select("id"),
    "venues",
  );
  await q(
    db.from("referees").insert(
      REFEREES.map((name, i) => ({ name, city: "Quito", level: i < 2 ? "provincial" : "parroquial", active: true })),
    ),
    "referees",
  );

  console.log("Torneo interparroquial de ecuavóley…");
  const [tournament] = await q<Pick<Tournament, "id" | "best_of" | "sport" | "rules">[]>(
    db.from("tournaments").insert([{
      organization_id: orgs[0].id,
      name: "Interparroquial de Ecuavóley 2026",
      season: 2026,
      category: "Mayores",
      branch: "masculino",
      city: "Quito",
      format: "groups_knockout",
      best_of: 3,
      sport: "ecuavoley",
      rules: null, // reglamento ECUAVOLEY: sets a 15 con cambio de saque
      status: "active",
    }]).select("id, best_of, sport, rules"),
    "tournament",
  );

  console.log("Equipos y jugadores…");
  const teams = await q<Team[]>(
    db.from("teams").insert(PARISHES.map((p) => ({
      organization_id: orgs[p.zone].id,
      name: p.name, short_name: p.short, city: "Quito", province: "Pichincha",
      color_primary: p.c1, color_secondary: "#ffffff", sport: "ecuavoley",
    }))).select("*"),
    "teams",
  );

  let serial = 900000;
  const players = await q<PlayerPublic[]>(
    db.from("players").insert(teams.flatMap((team) => ECUA_ROLES.map((position, i) => {
      serial += 1 + Math.floor(rand() * 5000);
      const month = String(1 + Math.floor(rand() * 12)).padStart(2, "0");
      const day = String(1 + Math.floor(rand() * 28)).padStart(2, "0");
      return {
        team_id: team.id,
        first_name: pick(MEN),
        last_name: `${pick(LAST)} ${pick(LAST)}`,
        cedula: makeCedula(17, serial),
        birth_date: `${1985 + Math.floor(rand() * 15)}-${month}-${day}`,
        number: i + 1,
        position,
        is_libero: false,
        is_captain: i === 0,
      };
    }))).select("*"),
    "players",
  );

  console.log("Grupos y calendario…");
  const groups = snakeGroups(teams.map((t) => t.id), 4);
  await q(db.from("tournament_teams").insert(
    groups.flatMap((g, gi) => g.map((teamId, si) => ({ tournament_id: tournament.id, team_id: teamId, group_label: groupLabel(gi), seed: si + 1 }))),
  ), "tournament_teams");

  const fixtures = groups.flatMap((g, gi) => roundRobin(g).map((f) => ({ ...f, group: groupLabel(gi) })));
  const slotsUsed = new Map<number, number>();
  const inserted = await q<{ id: string; home_team_id: string; away_team_id: string; round: number; scheduled_at: string }[]>(
    db.from("matches").insert(fixtures.map((f, i) => {
      const slot = slotsUsed.get(f.round) ?? 0;
      slotsUsed.set(f.round, slot + 1);
      return {
        tournament_id: tournament.id,
        stage: "group",
        group_label: f.group,
        round: f.round,
        home_team_id: f.home,
        away_team_id: f.away,
        venue_id: venues[slot % venues.length].id,
        scheduled_at: roundSlot(f.round, slot),
        referee_1: REFEREES[i % REFEREES.length],
        referee_2: REFEREES[(i + 3) % REFEREES.length],
      };
    })).select("id, home_team_id, away_team_id, round, scheduled_at"),
    "matches",
  );
  const matches = inserted.sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));

  const byTeam = (id: string) => players.filter((p) => p.team_id === id);
  const team = (id: string) => teams.find((t) => t.id === id)!;
  const rating = (id: string) => PARISHES[teams.findIndex((t) => t.id === id)].r;
  const captain = (id: string) => {
    const c = byTeam(id).find((p) => p.is_captain)!;
    return `${c.first_name} ${c.last_name}`;
  };

  // Jornadas 1 y 2 terminadas. Jornada 3 (hoy): el primer partido de las 10:00 en vivo, el primero de
  // las 11:30 queda como "partido demo" para llevarlo desde el sorteo, y el resto programados.
  const today = matches.filter((m) => m.round === 3);
  const live = today[0];
  const demo = today.find((m) => m.scheduled_at > live.scheduled_at);
  for (const [i, m] of matches.entries()) {
    const isLive = m.id === live?.id;
    if (m.round > 2 && !isLive) continue;
    const setup = buildSetup(tournament, team(m.home_team_id), team(m.away_team_id), byTeam(m.home_team_id), byTeam(m.away_team_id));
    const { events, state } = simulateMatch(setup, {
      seed: 500 + i,
      pA: 0.5 + (rating(m.home_team_id) - rating(m.away_team_id)) * 0.6,
      stopAt: isLive ? { set: 2, points: 11 } : undefined,
      signatures: { captainA: captain(m.home_team_id), captainB: captain(m.away_team_id), referee: REFEREES[i % REFEREES.length] },
    });
    const rows = events.map((e, k) => eventToRow(m.id, k + 1, e));
    for (let k = 0; k < rows.length; k += 500) await q(db.from("match_events").insert(rows.slice(k, k + 500)), "match_events");
    await q(db.from("matches").update(matchPatch(state, m.home_team_id, m.away_team_id)).eq("id", m.id), "match patch");
    console.log(`  ${team(m.home_team_id).short_name} vs ${team(m.away_team_id).short_name}: ${isLive ? "EN VIVO" : `${state.setsWon.A}-${state.setsWon.B}`} (${rows.length} eventos)`);
  }

  console.log(`Listo. Torneo ${tournament.id}`);
  if (demo) console.log(`Partido demo (sin empezar, hoy 11:30): ${team(demo.home_team_id).short_name} vs ${team(demo.away_team_id).short_name} · /mesa/${demo.id}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
