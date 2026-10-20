// Estadísticas de un partido derivadas del estado del motor (`replay`). Puras y deterministas.

import type { MatchState, Side } from "@/lib/scoresheet";

export interface TeamMatchStats {
  /** Puntos anotados (sin contar los cambios de saque). */
  points: number;
  /** Puntos ganados con saque propio. */
  serve: number;
  /** Puntos ganados recibiendo (solo con rally point). */
  receive: number;
  /** Jugadas ganadas sin saque que solo recuperaron el saque (puntuación con cambio). */
  sideouts: number;
  /** Puntos regalados por castigos del rival. */
  bySanction: number;
  /** Racha más larga de puntos seguidos dentro de un set. */
  bestRun: number;
  timeouts: number;
  substitutions: number;
  /** Sacador con más puntos en su propio saque. */
  topServer: { number: number; points: number } | null;
}

export interface FlowPoint {
  A: number;
  B: number;
  /** Ventaja de A (positivo) o de B (negativo). */
  lead: number;
}

export interface SetFlow {
  no: number;
  winner: Side | null;
  /** Marcador después de cada punto anotado, empezando en 0-0. */
  points: FlowPoint[];
}

export interface MatchStats {
  teams: Record<Side, TeamMatchStats>;
  flows: SetFlow[];
}

const empty = (): TeamMatchStats => ({
  points: 0,
  serve: 0,
  receive: 0,
  sideouts: 0,
  bySanction: 0,
  bestRun: 0,
  timeouts: 0,
  substitutions: 0,
  topServer: null,
});

export function matchStats(state: MatchState): MatchStats {
  const teams: Record<Side, TeamMatchStats> = { A: empty(), B: empty() };
  const servePoints: Record<Side, Map<number, number>> = { A: new Map(), B: new Map() };
  const flows: SetFlow[] = [];

  for (const set of state.sets) {
    const flow: FlowPoint[] = [{ A: 0, B: 0, lead: 0 }];
    const run: Record<Side, number> = { A: 0, B: 0 };
    for (const r of set.rallies) {
      const t = teams[r.winner];
      const other: Side = r.winner === "A" ? "B" : "A";
      run[other] = 0;
      if (r.sideout) {
        t.sideouts += 1;
        continue;
      }
      t.points += 1;
      if (r.bySanction) t.bySanction += 1;
      if (r.server === r.winner) {
        t.serve += 1;
        const m = servePoints[r.winner];
        m.set(r.serverNumber, (m.get(r.serverNumber) ?? 0) + 1);
      } else t.receive += 1;
      run[r.winner] += 1;
      t.bestRun = Math.max(t.bestRun, run[r.winner]);
      flow.push({ A: r.score.A, B: r.score.B, lead: r.score.A - r.score.B });
    }
    for (const side of ["A", "B"] as Side[]) {
      teams[side].timeouts += set.teams[side].timeouts;
      teams[side].substitutions += set.teams[side].substitutions;
    }
    flows.push({ no: set.no, winner: set.winner, points: flow });
  }

  for (const side of ["A", "B"] as Side[]) {
    let best: { number: number; points: number } | null = null;
    for (const [number, points] of servePoints[side])
      if (!best || points > best.points || (points === best.points && number < best.number)) best = { number, points };
    teams[side].topServer = best;
  }
  return { teams, flows };
}
