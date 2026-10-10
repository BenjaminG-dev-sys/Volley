import { describe, expect, it } from "vitest";
import { replayDetailed } from "../replay";
import { simulateMatch } from "../simulate";
import type { MatchEvent } from "../types";
import { setup } from "./helpers";

describe("simulador de partidos", () => {
  it("produce planillas legales y reproducibles", () => {
    for (let seed = 1; seed <= 40; seed++) {
      const { events, state } = simulateMatch(setup, { seed, pA: 0.45 + (seed % 10) / 100, signatures: { captainA: "a", captainB: "b", referee: "r" } });
      const stored = events.map((e, i) => ({ ...e, seq: i + 1 }) as MatchEvent);
      const { state: replayed, rejected } = replayDetailed(setup, stored);
      expect(rejected).toEqual([]);
      expect(replayed.phase).toBe("closed");
      expect(replayed.setsWon).toEqual(state.setsWon);
      expect(Math.max(replayed.setsWon.A, replayed.setsWon.B)).toBe(3);
      for (const s of replayed.sets) {
        const target = s.no === 5 ? 15 : 25;
        const w = Math.max(s.score.A, s.score.B);
        const l = Math.min(s.score.A, s.score.B);
        expect(w).toBeGreaterThanOrEqual(target);
        expect(w - l === 2 || (w === target && l <= target - 2)).toBe(true);
      }
    }
  });

  it("puede detenerse a mitad de un set", () => {
    const { state } = simulateMatch(setup, { seed: 7, stopAt: { set: 3, points: 20 } });
    expect(state.phase === "playing" || state.phase === "finished").toBe(true);
    if (state.phase === "playing") {
      expect(state.currentSet).toBe(3);
      const s = state.sets[2].score;
      expect(s.A + s.B).toBe(20);
    }
  });
});
