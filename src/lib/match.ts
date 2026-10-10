// Puente entre el motor de planilla (puro) y las filas de la base de datos.
// Convención: equipo A = local (home), equipo B = visitante (away).

import {
  MAX_SUBSTITUTIONS,
  MAX_TIMEOUTS,
  currentSet,
  type MatchEvent,
  type MatchEventInput,
  type MatchSetup,
  type MatchState,
  type Side,
} from "@/lib/scoresheet";
import type { MatchEventRow, MatchResult, PlayerPublic, Team } from "@/lib/types";

export function buildSetup(
  bestOf: 3 | 5,
  home: Pick<Team, "short_name" | "name">,
  away: Pick<Team, "short_name" | "name">,
  homePlayers: PlayerPublic[],
  awayPlayers: PlayerPublic[],
): MatchSetup {
  const roster = (ps: PlayerPublic[]) =>
    [...ps]
      .sort((a, b) => a.number - b.number)
      .map((p) => ({
        number: p.number,
        name: `${p.first_name} ${p.last_name}`,
        libero: p.is_libero,
        captain: p.is_captain,
      }));
  return {
    bestOf,
    teams: {
      A: { name: home.short_name || home.name, players: roster(homePlayers) },
      B: { name: away.short_name || away.name, players: roster(awayPlayers) },
    },
  };
}

export function rowToEvent(row: Pick<MatchEventRow, "seq" | "type" | "payload" | "created_at">): MatchEvent {
  return { ...(row.payload as object), type: row.type, seq: row.seq, ts: row.created_at } as MatchEvent;
}

export function eventToRow(matchId: string, seq: number, event: MatchEventInput) {
  const { type, ...payload } = event;
  return { match_id: matchId, seq, type, payload, client_ts: new Date().toISOString() };
}

/** Snapshot compacto para el marcador público y los listados. */
export interface LiveState {
  phase: MatchState["phase"];
  currentSet: number;
  setsWon: Record<Side, number>;
  score: Record<Side, number>;
  setScores: Record<Side, number>[];
  serving: Side | null;
  leftTeam: Side;
  timeoutsLeft: Record<Side, number>;
  subsLeft: Record<Side, number>;
  positions: Record<Side, number[]> | null;
  notice: string | null;
  last: string | null;
}

export function toLiveState(state: MatchState): LiveState {
  const set = currentSet(state);
  return {
    phase: state.phase,
    currentSet: state.currentSet,
    setsWon: state.setsWon,
    score: set ? set.score : { A: 0, B: 0 },
    setScores: state.sets.filter((s) => s.winner).map((s) => s.score),
    serving: state.serving,
    leftTeam: state.leftTeam,
    timeoutsLeft: {
      A: MAX_TIMEOUTS - (set?.teams.A.timeouts ?? 0),
      B: MAX_TIMEOUTS - (set?.teams.B.timeouts ?? 0),
    },
    subsLeft: {
      A: MAX_SUBSTITUTIONS - (set?.teams.A.substitutions ?? 0),
      B: MAX_SUBSTITUTIONS - (set?.teams.B.substitutions ?? 0),
    },
    positions: set ? { A: set.teams.A.positions, B: set.teams.B.positions } : null,
    notice: state.notice,
    last: state.log.length ? state.log[state.log.length - 1].text : null,
  };
}

export function toResult(state: MatchState): MatchResult {
  const sets = state.sets.filter((s) => s.winner).map((s) => ({ home: s.score.A, away: s.score.B }));
  return { sets, home_sets: state.setsWon.A, away_sets: state.setsWon.B };
}

/** Campos de `matches` que la mesa actualiza tras cada evento. */
export function matchPatch(state: MatchState, homeId: string, awayId: string) {
  const status = state.phase === "closed" ? "finished" : state.sets.length > 0 || state.lastSeq > 0 ? "live" : "scheduled";
  return {
    status,
    live_state: toLiveState(state),
    result: state.sets.some((s) => s.winner) ? toResult(state) : null,
    winner_team_id: state.phase === "closed" && state.winner ? (state.winner === "A" ? homeId : awayId) : null,
  };
}
