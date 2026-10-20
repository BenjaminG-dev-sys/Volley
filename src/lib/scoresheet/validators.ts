import { applyEvent, currentSet } from "./reducer";
import { isBackRow } from "./rotation";
import { type MatchEventInput, type MatchSetup, type MatchState, RuleError, type Side } from "./types";

/** Devuelve el mensaje de error si el evento no es válido, o `null` si se puede registrar. */
export function validateEvent(state: MatchState, event: MatchEventInput, setup: MatchSetup): string | null {
  try {
    applyEvent(state, event, setup);
    return null;
  } catch (e) {
    if (e instanceof RuleError) return e.message;
    throw e;
  }
}

export function remaining(state: MatchState, team: Side) {
  const set = currentSet(state);
  const { timeoutsPerSet, maxSubstitutions } = state.rules;
  if (!set) return { timeouts: timeoutsPerSet, substitutions: maxSubstitutions };
  const ts = set.teams[team];
  return {
    timeouts: timeoutsPerSet - ts.timeouts,
    substitutions: maxSubstitutions - ts.substitutions,
  };
}

/** Jugadores que pueden entrar por `out` según las reglas (para el modal de sustitución). */
export function legalSubstitutes(state: MatchState, setup: MatchSetup, team: Side, out: number): number[] {
  return setup.teams[team].players
    .map((p) => p.number)
    .filter((n) => validateEvent(state, { type: "substitution", team, out, in: n }, setup) === null);
}

/** Zagueros que el líbero puede reemplazar ahora mismo. */
export function liberoTargets(state: MatchState, setup: MatchSetup, team: Side, libero: number): number[] {
  const set = currentSet(state);
  if (!set) return [];
  return set.teams[team].positions
    .filter((_, i) => isBackRow(i))
    .filter((n) => validateEvent(state, { type: "libero_in", team, libero, replaced: n }, setup) === null);
}
