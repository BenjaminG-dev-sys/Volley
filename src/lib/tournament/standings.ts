// Tabla de posiciones con el sistema de puntos FIVB:
// victoria 3-0 / 3-1 (o 2-0 al mejor de 3) = 3 pts; 3-2 (2-1) = 2 pts al ganador y 1 al perdedor.
// Desempate: puntos, partidos ganados, cociente de sets, cociente de puntos y enfrentamiento directo.

export interface FinishedMatch {
  home: string;
  away: string;
  /** Marcadores por set, en orden. */
  sets: { home: number; away: number }[];
  bestOf: 3 | 5;
}

export interface StandingRow {
  teamId: string;
  played: number;
  won: number;
  lost: number;
  points: number;
  setsWon: number;
  setsLost: number;
  pointsWon: number;
  pointsLost: number;
  setRatio: number;
  pointRatio: number;
}

const ratio = (a: number, b: number) => (b === 0 ? (a === 0 ? 0 : Number.POSITIVE_INFINITY) : a / b);

/** Sistema de puntos de la tabla (configurable por torneo en `tournaments.standings`). */
export interface StandingsConfig {
  /** Victoria sin llegar al set decisivo (3-0 / 3-1 o 2-0). */
  win: number;
  /** Victoria en el set decisivo (3-2 o 2-1). */
  winTiebreak: number;
  /** Derrota en el set decisivo. */
  lossTiebreak: number;
  /** Derrota sin llegar al set decisivo. */
  loss: number;
}

export const STANDINGS_PRESETS = {
  fivb: { label: "FIVB: 3 · 2 · 1 · 0", config: { win: 3, winTiebreak: 2, lossTiebreak: 1, loss: 0 } },
  dos_uno: { label: "2 por ganar · 1 por perder", config: { win: 2, winTiebreak: 2, lossTiebreak: 1, loss: 1 } },
  tres_cero: { label: "3 por ganar · 0 por perder", config: { win: 3, winTiebreak: 3, lossTiebreak: 0, loss: 0 } },
} as const satisfies Record<string, { label: string; config: StandingsConfig }>;

export type StandingsPresetId = keyof typeof STANDINGS_PRESETS;
export const DEFAULT_STANDINGS: StandingsConfig = STANDINGS_PRESETS.fivb.config;

/** Configuración válida a partir de lo guardado en la base (o FIVB si falta o es inválida). */
export function standingsConfig(raw: unknown): StandingsConfig {
  const r = (raw ?? {}) as Partial<Record<keyof StandingsConfig, unknown>>;
  const n = (v: unknown, d: number) => (typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 10 ? v : d);
  return {
    win: n(r.win, DEFAULT_STANDINGS.win),
    winTiebreak: n(r.winTiebreak, DEFAULT_STANDINGS.winTiebreak),
    lossTiebreak: n(r.lossTiebreak, DEFAULT_STANDINGS.lossTiebreak),
    loss: n(r.loss, DEFAULT_STANDINGS.loss),
  };
}

/** Leyenda del sistema de puntos, p. ej. "Puntos: 3-0 / 3-1 = 3 · 3-2 = 2 y 1". */
export function pointsLegend(c: StandingsConfig, bestOf: 3 | 5): string {
  const win = bestOf === 5 ? "3-0 / 3-1" : "2-0";
  const tb = bestOf === 5 ? "3-2" : "2-1";
  return `Puntos: ${win} = ${c.win}${c.loss ? ` (perdedor ${c.loss})` : ""} · ${tb} = ${c.winTiebreak} y ${c.lossTiebreak}`;
}

export function matchPoints(winnerSets: number, loserSets: number, bestOf: 3 | 5, config: StandingsConfig = DEFAULT_STANDINGS): [number, number] {
  const tieBreak = loserSets === Math.floor(bestOf / 2);
  return tieBreak ? [config.winTiebreak, config.lossTiebreak] : [config.win, config.loss];
}

export function computeStandings(teamIds: string[], matches: FinishedMatch[], config: StandingsConfig = DEFAULT_STANDINGS): StandingRow[] {
  const rows = new Map<string, StandingRow>(
    teamIds.map((id) => [
      id,
      { teamId: id, played: 0, won: 0, lost: 0, points: 0, setsWon: 0, setsLost: 0, pointsWon: 0, pointsLost: 0, setRatio: 0, pointRatio: 0 },
    ]),
  );
  const h2h = new Map<string, string>(); // "a|b" -> ganador

  for (const m of matches) {
    const home = rows.get(m.home);
    const away = rows.get(m.away);
    if (!home || !away) continue;
    let hs = 0;
    let as = 0;
    for (const s of m.sets) {
      if (s.home > s.away) hs++;
      else as++;
      home.pointsWon += s.home;
      home.pointsLost += s.away;
      away.pointsWon += s.away;
      away.pointsLost += s.home;
    }
    home.played++;
    away.played++;
    home.setsWon += hs;
    home.setsLost += as;
    away.setsWon += as;
    away.setsLost += hs;
    const [w, l] = hs > as ? [home, away] : [away, home];
    const [pw, pl] = matchPoints(Math.max(hs, as), Math.min(hs, as), m.bestOf, config);
    w.won++;
    l.lost++;
    w.points += pw;
    l.points += pl;
    h2h.set([m.home, m.away].sort().join("|"), w.teamId);
  }

  const list = [...rows.values()].map((r) => ({
    ...r,
    setRatio: ratio(r.setsWon, r.setsLost),
    pointRatio: ratio(r.pointsWon, r.pointsLost),
  }));

  return list.sort(
    (a, b) =>
      b.points - a.points ||
      b.won - a.won ||
      b.setRatio - a.setRatio ||
      b.pointRatio - a.pointRatio ||
      headToHead(a.teamId, b.teamId, h2h) ||
      a.teamId.localeCompare(b.teamId),
  );
}

function headToHead(a: string, b: string, h2h: Map<string, string>) {
  const winner = h2h.get([a, b].sort().join("|"));
  if (winner === a) return -1;
  if (winner === b) return 1;
  return 0;
}

export const formatRatio = (r: number) => (Number.isFinite(r) ? r.toFixed(3) : "MAX");
