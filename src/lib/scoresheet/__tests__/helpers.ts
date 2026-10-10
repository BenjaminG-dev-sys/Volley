import { replay, replayDetailed } from "../replay";
import type { MatchEvent, MatchEventInput, MatchSetup, Side } from "../types";

export const setup: MatchSetup = {
  bestOf: 5,
  teams: {
    A: {
      name: "Club A",
      players: [
        ...Array.from({ length: 10 }, (_, i) => ({ number: i + 1, name: `A${i + 1}` })),
        { number: 11, name: "A11", libero: true },
        { number: 12, name: "A12", libero: true },
      ],
    },
    B: {
      name: "Club B",
      players: [
        ...Array.from({ length: 11 }, (_, i) => ({ number: i + 1, name: `B${i + 1}` })),
        { number: 12, name: "B12", libero: true },
      ],
    },
  },
};

/** Constructor fluido de partidos para pruebas. */
export class Sim {
  events: MatchEvent[] = [];
  constructor(public s: MatchSetup = setup) {}

  add(...evs: MatchEventInput[]) {
    for (const e of evs) this.events.push({ ...e, seq: this.events.length + 1 } as MatchEvent);
    return this;
  }
  get state() {
    return replay(this.s, this.events);
  }
  get detailed() {
    return replayDetailed(this.s, this.events);
  }
  toss(serving: Side = "A", leftTeam: Side = "A") {
    return this.add({ type: "coin_toss", serving, leftTeam });
  }
  lineups(a = [1, 2, 3, 4, 5, 6], b = [1, 2, 3, 4, 5, 6], la = [11], lb = [12]) {
    return this.add(
      { type: "lineup", team: "A", positions: a, liberos: la },
      { type: "lineup", team: "B", positions: b, liberos: lb },
    );
  }
  points(seq: string) {
    for (const c of seq) this.add({ type: "point", team: c as Side });
    return this;
  }
  /** Lleva el set en curso a `a`-`b` alternando puntos (el ganador anota el último). */
  setTo(winner: Side, a: number, b: number) {
    const st = this.state;
    const set = st.sets[st.sets.length - 1];
    let ca = set.score.A;
    let cb = set.score.B;
    const loser: Side = winner === "A" ? "B" : "A";
    const target = { A: a, B: b };
    // Primero el perdedor llega a su marcador final (intercalando), luego el ganador.
    while (ca + cb < a + b - 1) {
      const needW = target[winner] - 1 - (winner === "A" ? ca : cb);
      const needL = target[loser] - (loser === "A" ? ca : cb);
      const pick: Side = needL > 0 && (needL >= needW || needW <= 0) ? loser : winner;
      this.add({ type: "point", team: pick });
      if (pick === "A") ca++;
      else cb++;
    }
    this.add({ type: "point", team: winner });
    return this;
  }
}
