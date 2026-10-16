// Participación de un jugador en un partido, a partir del estado reconstruido por el motor
// (`replay`). Así respeta "deshacer" y funciona igual en vóley y ecuavóley.

import type { MatchState, Side } from "@/lib/scoresheet";

export interface Appearances {
  /** Partidos en los que estuvo en cancha (titular o ingresó). */
  matches: number;
  /** Sets en los que fue titular o ingresó. */
  sets: number;
  /** Sets como titular. */
  starts: number;
  /** Ingresos desde la banca (sustituciones y entradas como líbero). */
  subIns: number;
}

export const emptyAppearances = (): Appearances => ({ matches: 0, sets: 0, starts: 0, subIns: 0 });

/** Suma la participación del N.º `number` del equipo que jugó del lado `side` en `state`. */
export function addAppearances(total: Appearances, state: MatchState, side: Side, number: number): Appearances {
  let played = false;
  for (const set of state.sets) {
    const ts = set.teams[side];
    const started = ts.starters.includes(number);
    const ins = ts.entered.filter((n) => n === number).length;
    if (started) total.starts += 1;
    total.subIns += ins;
    if (started || ins) {
      total.sets += 1;
      played = true;
    }
  }
  if (played) total.matches += 1;
  return total;
}
