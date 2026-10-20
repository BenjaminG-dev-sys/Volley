// Conflictos de calendario: un equipo o una sede con dos partidos que se superponen.

export interface SchedulableMatch {
  id: string;
  home_team_id: string;
  away_team_id: string;
  venue_id: string | null;
  scheduled_at: string | null;
}

export interface Conflict {
  a: string;
  b: string;
  reason: "team" | "venue";
  /** Equipo o sede en conflicto. */
  ref: string;
}

/** Pares de partidos que se superponen (duración estimada `minutes`). */
export function detectConflicts(matches: SchedulableMatch[], minutes = 120): Conflict[] {
  const ms = matches
    .filter((m) => m.scheduled_at)
    .map((m) => ({ ...m, t: Date.parse(m.scheduled_at!) }))
    .sort((x, y) => x.t - y.t);
  const out: Conflict[] = [];
  const span = minutes * 60_000;
  for (let i = 0; i < ms.length; i++) {
    for (let j = i + 1; j < ms.length && ms[j].t - ms[i].t < span; j++) {
      const a = ms[i];
      const b = ms[j];
      const teams = [a.home_team_id, a.away_team_id].filter((t) => t === b.home_team_id || t === b.away_team_id);
      for (const t of teams) out.push({ a: a.id, b: b.id, reason: "team", ref: t });
      if (a.venue_id && a.venue_id === b.venue_id) out.push({ a: a.id, b: b.id, reason: "venue", ref: a.venue_id });
    }
  }
  return out;
}

/** Ids de partidos con algún conflicto. */
export const conflictedIds = (cs: Conflict[]) => new Set(cs.flatMap((c) => [c.a, c.b]));
