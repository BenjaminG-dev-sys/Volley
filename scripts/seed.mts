// Datos de demostración. Uso: npm run seed  (lee .env.local; requiere INSFORGE_API_KEY)
// Borra y vuelve a crear organizaciones, sedes, torneo, equipos, jugadores y partidos.
// Los partidos terminados se generan reproduciendo eventos con el motor de planilla.

import { createAdminClient } from "@insforge/sdk";
import { buildSetup, eventToRow, matchPatch } from "../src/lib/match";
import { simulateMatch, rng } from "../src/lib/scoresheet/simulate";
import { makeCedula } from "../src/lib/tournament/cedula";
import { roundRobin, snakeGroups, groupLabel } from "../src/lib/tournament/scheduler";
import type { PlayerPublic, Team } from "../src/lib/types";

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

const FIRST = ["María", "Daniela", "Valentina", "Camila", "Sofía", "Gabriela", "Andrea", "Paula", "Isabella", "Mishel",
  "Doménica", "Emilia", "Fernanda", "Ariana", "Nicole", "Karla", "Josselyn", "Thalía", "Dayana", "Allison"];
const LAST = ["Andrade", "Zambrano", "Cedeño", "Guerrero", "Mendoza", "Vera", "Paredes", "Chávez", "Morales", "Salazar",
  "Quiñónez", "Bravo", "Villacís", "Ortiz", "Jaramillo", "Loor", "Castro", "Cevallos", "Benítez", "Montalvo"];

const CLUBS = [
  { name: "Club Deportivo Cóndores de Quito", short: "Cóndores", city: "Quito", province: "Pichincha", c1: "#1d4ed8", c2: "#ffffff", prov: 17, r: 0.58 },
  { name: "Club Volcán Cotopaxi", short: "Volcán", city: "Latacunga", province: "Cotopaxi", c1: "#b91c1c", c2: "#fde68a", prov: 5, r: 0.5 },
  { name: "Club Guerreras del Guayas", short: "Guerreras", city: "Guayaquil", province: "Guayas", c1: "#0e7490", c2: "#ffffff", prov: 9, r: 0.56 },
  { name: "Club Marea Manabita", short: "Marea", city: "Manta", province: "Manabí", c1: "#0369a1", c2: "#fbbf24", prov: 13, r: 0.47 },
  { name: "Club Tomebamba Vóley", short: "Tomebamba", city: "Cuenca", province: "Azuay", c1: "#7c3aed", c2: "#ffffff", prov: 1, r: 0.54 },
  { name: "Club Halcones de Loja", short: "Halcones", city: "Loja", province: "Loja", c1: "#15803d", c2: "#ffffff", prov: 11, r: 0.45 },
  { name: "Club Amazonas Vóley", short: "Amazonas", city: "Tena", province: "Napo", c1: "#166534", c2: "#facc15", prov: 15, r: 0.43 },
  { name: "Club Pacífico Esmeraldas", short: "Pacífico", city: "Esmeraldas", province: "Esmeraldas", c1: "#ea580c", c2: "#1f2937", prov: 8, r: 0.49 },
];

const POSITIONS = ["armador", "opuesto", "central", "central", "punta", "punta", "armador", "opuesto", "central", "punta"] as const;
const REFEREES = ["Luis Paredes", "Carmen Vélez", "Jorge Almeida", "Patricia Ruiz", "Diego Cárdenas", "Silvia Narváez"];

async function wipe() {
  // El orden respeta las claves foráneas (match_events cae en cascada con matches).
  for (const t of ["matches", "tournament_teams", "players", "teams", "tournaments", "venues", "organizations"]) {
    const key = t === "tournament_teams" ? "tournament_id" : "id";
    await q(db.from(t).delete().not(key, "is", null), `wipe ${t}`);
  }
}

async function main() {
  console.log("Limpiando datos anteriores…");
  await wipe();

  console.log("Organizaciones y sedes…");
  const orgs = await q<{ id: string; short_name: string }[]>(
    db.from("organizations").insert([
      { name: "Federación Nacional de Voleibol (demo)", short_name: "FNV", kind: "federation", province: null },
      { name: "Asociación Provincial de Voleibol de Pichincha", short_name: "APV Pichincha", kind: "association", province: "Pichincha" },
      { name: "Asociación Provincial de Voleibol del Guayas", short_name: "APV Guayas", kind: "association", province: "Guayas" },
      { name: "Asociación Provincial de Voleibol del Azuay", short_name: "APV Azuay", kind: "association", province: "Azuay" },
    ]).select("id, short_name"),
    "organizations",
  );
  const fed = orgs[0];

  const venues = await q<{ id: string; city: string }[]>(
    db.from("venues").insert([
      { name: "Coliseo Norte", city: "Quito", province: "Pichincha" },
      { name: "Coliseo del Puerto", city: "Guayaquil", province: "Guayas" },
      { name: "Coliseo Municipal Río Tomebamba", city: "Cuenca", province: "Azuay" },
    ]).select("id, city"),
    "venues",
  );

  console.log("Torneo…");
  const [tournament] = await q<{ id: string; best_of: 3 | 5 }[]>(
    db.from("tournaments").insert([{
      organization_id: fed.id,
      name: "Campeonato Nacional Sub-19 Femenino 2026",
      season: 2026,
      category: "Sub-19",
      branch: "femenino",
      city: "Quito",
      format: "groups_knockout",
      best_of: 5,
      status: "active",
    }]).select("id, best_of"),
    "tournament",
  );

  console.log("Equipos y jugadoras…");
  const teams = await q<Team[]>(
    db.from("teams").insert(CLUBS.map((c) => ({
      organization_id: orgs[1 + ["Pichincha", "Guayas", "Azuay"].indexOf(c.province)].id, // -1 → federación
      name: c.name, short_name: c.short, city: c.city, province: c.province, color_primary: c.c1, color_secondary: c.c2,
    }))).select("*"),
    "teams",
  );

  let serial = 1000;
  const playerRows = teams.flatMap((team, ti) => {
    const club = CLUBS[ti];
    return Array.from({ length: 12 }, (_, i) => {
      const libero = i >= 10;
      const birthYear = 2008 + Math.floor(rand() * 3);
      const month = String(1 + Math.floor(rand() * 12)).padStart(2, "0");
      const day = String(1 + Math.floor(rand() * 28)).padStart(2, "0");
      serial += 1 + Math.floor(rand() * 5000);
      return {
        team_id: team.id,
        first_name: pick(FIRST),
        last_name: `${pick(LAST)} ${pick(LAST)}`,
        cedula: makeCedula(club.prov, serial),
        birth_date: `${birthYear}-${month}-${day}`,
        number: libero ? (i === 10 ? 1 : 12) : [2, 3, 4, 5, 6, 7, 8, 9, 10, 11][i],
        position: libero ? "libero" : POSITIONS[i],
        is_libero: libero,
        is_captain: i === 0,
      };
    });
  });
  const players = await q<PlayerPublic[]>(db.from("players").insert(playerRows).select("*"), "players");

  console.log("Grupos y calendario…");
  const groups = snakeGroups(teams.map((t) => t.id), 2);
  await q(db.from("tournament_teams").insert(
    groups.flatMap((g, gi) => g.map((teamId, si) => ({ tournament_id: tournament.id, team_id: teamId, group_label: groupLabel(gi), seed: si + 1 }))),
  ), "tournament_teams");

  // Jornadas en sábados consecutivos: 26 sep, 3 oct y 10 oct de 2026 (hora de Ecuador, UTC-5).
  const day0 = Date.UTC(2026, 8, 26, 14, 0); // 26 sep 09:00 ECT
  const fixtures = groups.flatMap((g, gi) =>
    roundRobin(g).map((f) => ({ ...f, group: groupLabel(gi) })),
  );
  const slotsUsed = new Map<number, number>();
  const matchRows = fixtures.map((f, i) => {
    const slot = slotsUsed.get(f.round) ?? 0;
    slotsUsed.set(f.round, slot + 1);
    return {
      tournament_id: tournament.id,
      stage: "group",
      group_label: f.group,
      round: f.round,
      home_team_id: f.home,
      away_team_id: f.away,
      venue_id: venues[(f.round - 1) % venues.length].id,
      // 4 partidos por jornada: 09:00, 11:00, 13:00 y 15:00
      scheduled_at: new Date(day0 + (f.round - 1) * 7 * 86400_000 + slot * 2 * 3600_000).toISOString(),
      referee_1: REFEREES[i % REFEREES.length],
      referee_2: REFEREES[(i + 3) % REFEREES.length],
    };
  });
  const matches = await q<{ id: string; home_team_id: string; away_team_id: string; round: number; group_label: string }[]>(
    db.from("matches").insert(matchRows).select("id, home_team_id, away_team_id, round, group_label"),
    "matches",
  );

  const byTeam = (id: string) => players.filter((p) => p.team_id === id);
  const team = (id: string) => teams.find((t) => t.id === id)!;
  const rating = (id: string) => CLUBS[teams.findIndex((t) => t.id === id)].r;

  let liveDone = false;
  for (const [i, m] of matches.entries()) {
    // Jornadas 1 y 2 terminadas; en la jornada 3 un partido en vivo y el resto programados.
    const finished = m.round <= 2;
    const live = !finished && !liveDone && m.group_label === "A";
    if (!finished && !live) continue;
    if (live) liveDone = true;

    const setup = buildSetup(tournament.best_of, team(m.home_team_id), team(m.away_team_id), byTeam(m.home_team_id), byTeam(m.away_team_id));
    const pA = 0.5 + (rating(m.home_team_id) - rating(m.away_team_id)) * 0.6;
    const captain = (id: string) => {
      const c = byTeam(id).find((p) => p.is_captain)!;
      return `${c.first_name} ${c.last_name}`;
    };
    const { events, state } = simulateMatch(setup, {
      seed: 100 + i,
      pA,
      stopAt: live ? { set: 3, points: 27 } : undefined,
      signatures: { captainA: captain(m.home_team_id), captainB: captain(m.away_team_id), referee: REFEREES[i % REFEREES.length] },
    });
    const rows = events.map((e, k) => eventToRow(m.id, k + 1, e));
    for (let k = 0; k < rows.length; k += 500) await q(db.from("match_events").insert(rows.slice(k, k + 500)), "match_events");
    await q(db.from("matches").update(matchPatch(state, m.home_team_id, m.away_team_id)).eq("id", m.id), "match patch");
    console.log(`  ${team(m.home_team_id).short_name} vs ${team(m.away_team_id).short_name}: ${live ? "EN VIVO" : `${state.setsWon.A}-${state.setsWon.B}`} (${rows.length} eventos)`);
  }

  console.log(`Listo. Torneo ${tournament.id}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
