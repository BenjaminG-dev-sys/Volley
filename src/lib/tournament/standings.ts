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

export function matchPoints(winnerSets: number, loserSets: number, bestOf: 3 | 5): [number, number] {
  const tieBreakLoss = loserSets === Math.floor(bestOf / 2);
  return tieBreakLoss ? [2, 1] : [3, 0];
}

export function computeStandings(teamIds: string[], matches: FinishedMatch[]): StandingRow[] {
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
    const [pw, pl] = matchPoints(Math.max(hs, as), Math.min(hs, as), m.bestOf);
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
