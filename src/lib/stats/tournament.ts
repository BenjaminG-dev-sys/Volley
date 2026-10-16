// Destacados de un torneo calculados solo con los resultados (sin leer planillas).

import type { MatchResult } from "@/lib/types";

export interface ResultMatch {
  id: string;
  home: string;
  away: string;
  result: MatchResult;
  bestOf: 3 | 5;
}

export interface TournamentHighlights {
  matches: number;
  sets: number;
  points: number;
  /** Partidos que llegaron al set decisivo. */
  decidingSets: number;
  /** Set con más puntos jugados. */
  longestSet: { matchId: string; home: string; away: string; set: number; score: { home: number; away: number } } | null;
  /** Equipo con más puntos anotados por set jugado. */
  bestAttack: { teamId: string; perSet: number } | null;
  /** Equipo con menos puntos recibidos por set jugado. */
  bestDefense: { teamId: string; perSet: number } | null;
}

export function tournamentHighlights(matches: ResultMatch[]): TournamentHighlights {
  let sets = 0;
  let points = 0;
  let decidingSets = 0;
  let longestSet: TournamentHighlights["longestSet"] = null;
  const perTeam = new Map<string, { for: number; against: number; sets: number }>();
  const add = (id: string, f: number, a: number) => {
    const t = perTeam.get(id) ?? { for: 0, against: 0, sets: 0 };
    t.for += f;
    t.against += a;
    t.sets += 1;
    perTeam.set(id, t);
  };

  for (const m of matches) {
    if (m.result.sets.length === m.bestOf) decidingSets += 1;
    m.result.sets.forEach((s, i) => {
      sets += 1;
      points += s.home + s.away;
      add(m.home, s.home, s.away);
      add(m.away, s.away, s.home);
      const total = s.home + s.away;
      if (!longestSet || total > longestSet.score.home + longestSet.score.away)
        longestSet = { matchId: m.id, home: m.home, away: m.away, set: i + 1, score: { ...s } };
    });
  }

  let bestAttack: TournamentHighlights["bestAttack"] = null;
  let bestDefense: TournamentHighlights["bestDefense"] = null;
  for (const [teamId, t] of [...perTeam].sort(([a], [b]) => a.localeCompare(b))) {
    const f = t.for / t.sets;
    const a = t.against / t.sets;
    if (!bestAttack || f > bestAttack.perSet) bestAttack = { teamId, perSet: f };
    if (!bestDefense || a < bestDefense.perSet) bestDefense = { teamId, perSet: a };
  }
  return { matches: matches.length, sets, points, decidingSets, longestSet, bestAttack, bestDefense };
}
