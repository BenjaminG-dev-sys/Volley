// Cruces de semifinales a partir de las tablas de grupos (1 a N grupos).

import type { StandingRow } from "./standings";

export interface GroupRanking {
  group: string;
  rows: StandingRow[];
}

const better = (a: StandingRow, b: StandingRow) =>
  b.points - a.points || b.won - a.won || b.setRatio - a.setRatio || b.pointRatio - a.pointRatio || a.teamId.localeCompare(b.teamId);

/**
 * Semifinales según la cantidad de grupos:
 * - 1 grupo: 1.º–4.º y 2.º–3.º.
 * - 2 grupos: 1.º A–2.º B y 1.º B–2.º A (cruzadas).
 * - 3 grupos: los 3 primeros + el mejor segundo; el mejor primero enfrenta al mejor segundo.
 * - 4 o más: los primeros de los grupos A–D: 1.º A–1.º D y 1.º B–1.º C.
 */
export function semifinalPairs(groups: GroupRanking[]): [string, string][] {
  const gs = [...groups].sort((a, b) => a.group.localeCompare(b.group)).filter((g) => g.rows.length);
  const need = (cond: boolean, msg: string) => {
    if (!cond) throw new Error(msg);
  };
  if (gs.length === 1) {
    const r = gs[0].rows;
    need(r.length >= 4, "Se necesitan al menos 4 equipos para semifinales.");
    return [
      [r[0].teamId, r[3].teamId],
      [r[1].teamId, r[2].teamId],
    ];
  }
  if (gs.length === 2) {
    const [a, b] = gs;
    need(a.rows.length >= 2 && b.rows.length >= 2, "Cada grupo necesita al menos 2 equipos.");
    return [
      [a.rows[0].teamId, b.rows[1].teamId],
      [b.rows[0].teamId, a.rows[1].teamId],
    ];
  }
  if (gs.length === 3) {
    need(gs.some((g) => g.rows.length >= 2), "Se necesita al menos un segundo lugar.");
    const firsts = gs.map((g) => g.rows[0]).sort(better);
    const bestSecond = gs.filter((g) => g.rows.length >= 2).map((g) => g.rows[1]).sort(better)[0];
    return [
      [firsts[0].teamId, bestSecond.teamId],
      [firsts[1].teamId, firsts[2].teamId],
    ];
  }
  const [a, b, c, d] = gs;
  return [
    [a.rows[0].teamId, d.rows[0].teamId],
    [b.rows[0].teamId, c.rows[0].teamId],
  ];
}
