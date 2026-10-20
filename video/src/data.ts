// Datos reales de la demo: seed de 16 parroquias (scripts/seed.mts) tal como se ve en
// voley.integroecuador.com el 13 oct 2026 (jornada 3). Todas las escenas leen de aquí para que
// nombres, colores, resultados y posiciones coincidan entre sí y con la web.

export const BRAND = {
  name: "Asociación de Ligas Rurales",
  place: "del Cantón Quito",
  short: "Ligas Rurales Quito",
  tournament: "Interparroquial de Ecuavóley 2026",
  web: "voley.integroecuador.com",
  credit: "Plataforma por Integro",
};

export type TeamId =
  | "zambiza" | "calderon" | "cumbaya" | "llanoChico" | "nayon" | "tumbaco" | "pomasqui" | "conocoto"
  | "amaguana" | "pifo" | "puembo" | "yaruqui" | "alangasi" | "guayllabamba" | "pintag" | "elQuinche";

export const TEAMS: Record<TeamId, { short: string; color: string }> = {
  zambiza: { short: "Zámbiza", color: "#0f766e" },
  calderon: { short: "Calderón", color: "#b91c1c" },
  cumbaya: { short: "Cumbayá", color: "#1d4ed8" },
  llanoChico: { short: "Llano Chico", color: "#7c3aed" },
  nayon: { short: "Nayón", color: "#ca8a04" },
  tumbaco: { short: "Tumbaco", color: "#15803d" },
  pomasqui: { short: "Pomasqui", color: "#ea580c" },
  conocoto: { short: "Conocoto", color: "#0369a1" },
  amaguana: { short: "Amaguaña", color: "#be185d" },
  pifo: { short: "Pifo", color: "#4d7c0f" },
  puembo: { short: "Puembo", color: "#9333ea" },
  yaruqui: { short: "Yaruquí", color: "#c2410c" },
  alangasi: { short: "Alangasí", color: "#0891b2" },
  guayllabamba: { short: "Guayllabamba", color: "#a16207" },
  pintag: { short: "Píntag", color: "#1e3a8a" },
  elQuinche: { short: "El Quinche", color: "#991b1b" },
};

export const team = (id: TeamId) => TEAMS[id];

/** Reglamento del torneo (preset ECUAVOLEY de src/lib/scoresheet/rules.ts). */
export const RULES = {
  players: 3,
  roles: ["Servidor", "Colocador", "Volador"] as const,
  bestOf: 3,
  pointsPerSet: 15,
  winBy: 2,
  timeoutsPerSet: 2,
  maxRoster: 7,
  pointsLegend: "2-0 = 3 · 2-1 = 2 y 1",
};

export const VENUES = ["Coliseo de Calderón", "Cancha cubierta de Zámbiza", "Cancha del Parque de Cumbayá"] as const;

/** Resultados cerrados de las jornadas 1 (29 sept) y 2 (6 oct), local primero. */
export const RESULTS: { round: 1 | 2; home: TeamId; away: TeamId; sets: [number, number] }[] = [
  { round: 1, home: "amaguana", away: "conocoto", sets: [0, 2] },
  { round: 1, home: "zambiza", away: "elQuinche", sets: [2, 1] },
  { round: 1, home: "pifo", away: "pomasqui", sets: [0, 2] },
  { round: 1, home: "calderon", away: "pintag", sets: [2, 1] },
  { round: 1, home: "cumbaya", away: "guayllabamba", sets: [2, 0] },
  { round: 1, home: "puembo", away: "tumbaco", sets: [0, 2] },
  { round: 1, home: "yaruqui", away: "nayon", sets: [1, 2] },
  { round: 1, home: "llanoChico", away: "alangasi", sets: [0, 2] },
  { round: 2, home: "elQuinche", away: "conocoto", sets: [2, 0] },
  { round: 2, home: "amaguana", away: "zambiza", sets: [2, 0] },
  { round: 2, home: "pintag", away: "pomasqui", sets: [1, 2] },
  { round: 2, home: "pifo", away: "calderon", sets: [0, 2] },
  { round: 2, home: "puembo", away: "cumbaya", sets: [1, 2] },
  { round: 2, home: "guayllabamba", away: "tumbaco", sets: [0, 2] },
  { round: 2, home: "yaruqui", away: "llanoChico", sets: [2, 0] },
  { round: 2, home: "alangasi", away: "nayon", sets: [1, 2] },
];

export const GROUP_A: TeamId[] = ["elQuinche", "amaguana", "conocoto", "zambiza"];

/** Posiciones del grupo calculadas con los resultados y el sistema 2-0 = 3 · 2-1 = 2 y 1. */
export function standings(group: TeamId[]) {
  const rows = group.map((id) => ({ id, pj: 0, g: 0, p: 0, sf: 0, sc: 0, pts: 0, form: [] as ("G" | "P")[] }));
  const row = (id: TeamId) => rows.find((r) => r.id === id);
  for (const m of RESULTS) {
    const h = row(m.home);
    const a = row(m.away);
    if (!h || !a) continue;
    const [sh, sa] = m.sets;
    const homeWins = sh > sa;
    for (const [r, own, opp, won] of [[h, sh, sa, homeWins], [a, sa, sh, !homeWins]] as const) {
      r.pj++;
      r.sf += own;
      r.sc += opp;
      if (won) r.g++;
      else r.p++;
      r.form.push(won ? "G" : "P");
      r.pts += won ? (opp === 0 ? 3 : 2) : own === 1 ? 1 : 0;
    }
  }
  return rows.sort((x, y) => y.pts - x.pts || y.sf / Math.max(y.sc, 0.5) - x.sf / Math.max(x.sc, 0.5));
}

export const OTHER_LEADERS: { group: string; id: TeamId; pts: number }[] = [
  { group: "B", id: "pomasqui", pts: 5 },
  { group: "C", id: "tumbaco", pts: 6 },
  { group: "D", id: "nayon", pts: 4 },
];

/** Jornada 3 (hoy): hora, partido y sede (índice en VENUES). */
export const ROUND3: { time: string; home: TeamId; away: TeamId; venue: number }[] = [
  { time: "10:00", home: "elQuinche", away: "amaguana", venue: 0 },
  { time: "10:00", home: "zambiza", away: "conocoto", venue: 1 },
  { time: "11:30", home: "calderon", away: "pomasqui", venue: 2 },
  { time: "11:30", home: "pintag", away: "pifo", venue: 0 },
  { time: "13:00", home: "cumbaya", away: "tumbaco", venue: 1 },
  { time: "13:00", home: "guayllabamba", away: "puembo", venue: 2 },
  { time: "14:30", home: "alangasi", away: "yaruqui", venue: 0 },
  { time: "14:30", home: "llanoChico", away: "nayon", venue: 1 },
];

/** Nóminas de los dos equipos del partido en vivo (número, nombre, rol; el 1 es capitán). */
export const ROSTERS: Partial<Record<TeamId, { n: number; name: string; role: string }[]>> = {
  elQuinche: [
    { n: 1, name: "Andrés Villacís Mendoza", role: "Servidor" },
    { n: 2, name: "Patricio Villacís Bravo", role: "Colocador" },
    { n: 3, name: "Santiago Benítez Bravo", role: "Volador" },
  ],
  amaguana: [
    { n: 1, name: "Jorge Mendoza Mendoza", role: "Servidor" },
    { n: 2, name: "Javier Quiñónez Morales", role: "Colocador" },
    { n: 3, name: "Pablo Chávez Mendoza", role: "Volador" },
  ],
};

/** Planilla real de Zámbiza 2–1 El Quinche (jornada 1, 29 sept). */
export const SHEET = {
  home: "zambiza" as TeamId,
  away: "elQuinche" as TeamId,
  sets: [[9, 15], [15, 7], [15, 9]] as [number, number][],
  stats: [
    { label: "Puntos (todos con saque)", h: 39, a: 31 },
    { label: "Cambios de saque", h: 31, a: 30 },
    { label: "Racha máxima", h: 4, a: 4 },
    { label: "Puntos por castigo del rival", h: 1, a: 2 },
  ],
  topServer: "Zámbiza N.º 3 · 30 pts",
  captains: ["Javier Guerrero Mendoza", "Andrés Villacís Mendoza"],
  referee: "Luis Paredes",
  // Set 3, punto a punto (Zámbiza – El Quinche).
  set3: [[1, 0], [2, 0], [3, 0], [3, 1], [4, 1], [5, 1], [6, 1], [6, 2], [6, 3], [7, 3], [8, 3], [8, 4], [8, 5], [9, 5], [10, 5], [11, 5], [11, 6], [12, 6], [13, 6], [13, 7], [13, 8], [13, 9], [14, 9], [15, 9]] as [number, number][],
};

// ---------- Ecuavóley con cambio: solo suma quien saca ----------
export type Side = "H" | "A";
export interface RallyState {
  h: number;
  a: number;
  serving: Side;
  last: { winner: Side; scored: boolean } | null;
}

/** Aplica jugadas: si gana el que saca, suma; si gana el que recibe, solo recupera el saque. */
export function applySideout(start: Omit<RallyState, "last">, winners: Side[]): RallyState[] {
  const states: RallyState[] = [];
  let s: RallyState = { ...start, last: null };
  for (const w of winners) {
    const scored = w === s.serving;
    s = {
      h: s.h + (scored && w === "H" ? 1 : 0),
      a: s.a + (scored && w === "A" ? 1 : 0),
      serving: w,
      last: { winner: w, scored },
    };
    states.push(s);
  }
  return states;
}

/** Estado a un frame dado: jugadas en `frames[i]` con ganador `winners[i]`. */
export function rallyAt(frame: number, start: Omit<RallyState, "last">, plays: { f: number; w: Side }[]) {
  const states = applySideout(start, plays.map((p) => p.w));
  let idx = -1;
  plays.forEach((p, i) => {
    if (frame >= p.f) idx = i;
  });
  return { state: idx < 0 ? { ...start, last: null } : states[idx], at: idx < 0 ? null : plays[idx].f, idx };
}

// Las jugadas caen sobre el pulso de la música (múltiplos de 15 frames, ver timeline.ts).
/** Mesa: set 1 El Quinche–Amaguaña desde el 8-5 en vivo de la web (saca El Quinche). */
export const MESA_START = { h: 8, a: 5, serving: "H" as Side };
export const MESA_PLAYS: { f: number; w: Side }[] = [
  { f: 30, w: "H" }, // 9-5
  { f: 60, w: "A" }, // cambio: saca Amaguaña
  { f: 75, w: "A" }, // 9-6
  { f: 90, w: "A" }, // 9-7
  { f: 120, w: "H" }, // cambio: saca El Quinche
  { f: 150, w: "H" }, // 10-7
];

/** Marcador: el mismo set más tarde, de 13-12 a 15-12. */
export const LIVE_START = { h: 13, a: 12, serving: "H" as Side };
export const LIVE_PLAYS: { f: number; w: Side }[] = [
  { f: 30, w: "A" }, // cambio: saca Amaguaña
  { f: 60, w: "H" }, // cambio: saca El Quinche
  { f: 90, w: "H" }, // 14-12
  { f: 120, w: "H" }, // 15-12 → set
];
