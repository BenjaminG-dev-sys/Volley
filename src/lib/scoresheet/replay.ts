import { applyEvent, initialState } from "./reducer";
import { type MatchEvent, type MatchSetup, type MatchState, RuleError } from "./types";

export interface ReplayResult {
  state: MatchState;
  /** Eventos rechazados por las reglas (p. ej. llegados desde una cola offline desfasada). */
  rejected: { seq: number; error: string }[];
  /** Cantidad de eventos efectivos que aún se pueden deshacer. */
  undoDepth: number;
}

/**
 * Reconstruye el estado del partido desde la lista inmutable de eventos.
 * `undo` deshace el último evento aplicado (no los rechazados).
 */
export function replayDetailed(setup: MatchSetup, events: MatchEvent[]): ReplayResult {
  const sorted = [...events].sort((a, b) => a.seq - b.seq);
  const stack: MatchState[] = [initialState(setup)];
  const rejected: ReplayResult["rejected"] = [];
  let lastSeq = 0;

  for (const ev of sorted) {
    lastSeq = Math.max(lastSeq, ev.seq);
    if (ev.type === "undo") {
      if (stack.length > 1) stack.pop();
      continue;
    }
    try {
      stack.push(applyEvent(stack[stack.length - 1], ev, setup));
    } catch (e) {
      if (!(e instanceof RuleError)) throw e;
      rejected.push({ seq: ev.seq, error: e.message });
    }
  }

  const state = { ...stack[stack.length - 1], lastSeq };
  return { state, rejected, undoDepth: stack.length - 1 };
}

export function replay(setup: MatchSetup, events: MatchEvent[]): MatchState {
  return replayDetailed(setup, events).state;
}

export function nextSeq(events: Pick<MatchEvent, "seq">[]): number {
  return events.reduce((m, e) => Math.max(m, e.seq), 0) + 1;
}
