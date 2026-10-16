// Generador de partidos simulados (datos de demostración y pruebas).
// Cada evento se valida con el motor antes de agregarse, así que el resultado
// siempre es una planilla legal.

import { applyEvent, currentSet, initialState } from "./reducer";
import { isBackRow } from "./rotation";
import { type MatchEventInput, type MatchSetup, type MatchState, RuleError, type Side, otherSide } from "./types";

/** PRNG determinista (mulberry32). */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface SimulateOptions {
  seed: number;
  /** Probabilidad de que A gane un rally (0..1). */
  pA?: number;
  /** Detiene la simulación al llegar a este set con al menos `points` puntos jugados. */
  stopAt?: { set: number; points: number };
  signatures?: { captainA: string; captainB: string; referee: string };
}

export function simulateMatch(setup: MatchSetup, opts: SimulateOptions): { events: MatchEventInput[]; state: MatchState } {
  const rand = rng(opts.seed);
  const pA = opts.pA ?? 0.5;
  const events: MatchEventInput[] = [];
  let state = initialState(setup);

  const tryAdd = (e: MatchEventInput) => {
    try {
      state = applyEvent(state, e, setup);
      events.push(e);
      return true;
    } catch (err) {
      if (err instanceof RuleError) return false;
      throw err;
    }
  };
  const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)];
  const nonLibero = (t: Side) => setup.teams[t].players.filter((p) => !p.libero).map((p) => p.number);
  const liberos = (t: Side) => setup.teams[t].players.filter((p) => p.libero).map((p) => p.number);

  let guard = 0;
  while (state.phase !== "finished" && guard++ < 5000) {
    if (state.phase === "coin_toss") {
      tryAdd({ type: "coin_toss", serving: rand() < 0.5 ? "A" : "B", leftTeam: rand() < 0.5 ? "A" : "B" });
      continue;
    }
    if (state.phase === "lineups") {
      for (const t of ["A", "B"] as Side[]) {
        const pool = nonLibero(t);
        const n = state.rules.playersOnCourt;
        // Rota la formación base para variar entre sets
        const shift = Math.floor(rand() * n);
        const base = pool.slice(0, n);
        tryAdd({
          type: "lineup",
          team: t,
          positions: base.map((_, i) => base[(i + shift) % n]),
          liberos: liberos(t).slice(0, state.rules.liberos),
        });
      }
      continue;
    }

    const set = currentSet(state)!;
    if (opts.stopAt && set.no === opts.stopAt.set && set.score.A + set.score.B >= opts.stopAt.points) break;

    const r = rand();
    const team: Side = rand() < 0.5 ? "A" : "B";
    const ts = set.teams[team];
    if (r < 0.02) {
      tryAdd({ type: "timeout", team });
    } else if (r < 0.045) {
      const onCourt = ts.positions.filter((n) => n !== ts.liberoOnCourt?.libero);
      const out = pick(onCourt);
      const bench = nonLibero(team).filter((n) => !ts.positions.includes(n));
      const pair = ts.subPairs.find((p) => p.sub === out && !p.returned);
      tryAdd({ type: "substitution", team, out, in: pair ? pair.starter : pick(bench) });
    } else if (r < 0.1 && ts.liberos.length) {
      if (ts.liberoOnCourt) tryAdd({ type: "libero_out", team });
      else {
        const back = ts.positions.filter((_, i) => isBackRow(i) && i !== 0);
        tryAdd({ type: "libero_in", team, libero: ts.liberos[0], replaced: pick(back) });
      }
    } else if (r < 0.103) {
      tryAdd({ type: "sanction", team, kind: "delay" });
    } else {
      tryAdd({ type: "point", team: rand() < pA ? "A" : otherSide("A") });
    }
  }

  if (state.phase === "finished" && opts.signatures) tryAdd({ type: "close", ...opts.signatures });
  return { events, state };
}
