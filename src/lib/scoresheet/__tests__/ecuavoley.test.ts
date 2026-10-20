import { describe, expect, it } from "vitest";
import { replay, replayDetailed } from "../replay";
import { ECUAVOLEY, VOLEY_FIVB, describeRules, resolveRules, rulesOf } from "../rules";
import { simulateMatch } from "../simulate";
import type { MatchEvent, MatchEventInput, MatchSetup, Side } from "../types";
import { setup as voleySetup } from "./helpers";

const players = (p: string) => Array.from({ length: 7 }, (_, i) => ({ number: i + 1, name: `${p}${i + 1}` }));

const ecua = (overrides?: Parameters<typeof resolveRules>[1]): MatchSetup => {
  const rules = resolveRules("ecuavoley", overrides);
  return {
    bestOf: rules.bestOf,
    pointsPerSet: rules.pointsPerSet,
    pointsDecidingSet: rules.pointsDecidingSet,
    rules,
    teams: { A: { name: "Zámbiza", players: players("A") }, B: { name: "Calderón", players: players("B") } },
  };
};

/** Partido de ecuavóley para pruebas: `scored("AAB")` hace que cada letra sea un punto efectivo (gana el saque si hace falta). */
class Ecua {
  events: MatchEvent[] = [];
  constructor(public s: MatchSetup = ecua()) {}
  add(...evs: MatchEventInput[]) {
    for (const e of evs) this.events.push({ ...e, seq: this.events.length + 1 } as MatchEvent);
    return this;
  }
  get state() {
    return replay(this.s, this.events);
  }
  start(serving: Side = "A") {
    return this.add(
      { type: "coin_toss", serving, leftTeam: "A" },
      { type: "lineup", team: "A", positions: [1, 2, 3] },
      { type: "lineup", team: "B", positions: [1, 2, 3] },
    );
  }
  lineups() {
    return this.add({ type: "lineup", team: "A", positions: [1, 2, 3] }, { type: "lineup", team: "B", positions: [1, 2, 3] });
  }
  scored(seq: string) {
    for (const c of seq as Iterable<Side>) {
      if (this.state.serving !== c) this.add({ type: "point", team: c }); // cambio
      this.add({ type: "point", team: c });
    }
    return this;
  }
  /** Lleva el set a `a`-`b` para `winner` intercalando puntos. */
  setTo(winner: Side, a: number, b: number) {
    const loser: Side = winner === "A" ? "B" : "A";
    const w = winner === "A" ? a : b;
    const l = winner === "A" ? b : a;
    const seq: Side[] = [];
    for (let i = 0; i < l; i++) seq.push(loser, winner);
    seq.length = Math.min(seq.length, l * 2);
    const already = seq.filter((x) => x === winner).length;
    for (let i = already; i < w; i++) seq.push(winner);
    return this.scored(seq.join(""));
  }
  get rejected() {
    return replayDetailed(this.s, this.events).rejected;
  }
}

describe("reglamento", () => {
  it("sin reglas explícitas el partido es vóley FIVB", () => {
    expect(rulesOf(voleySetup)).toEqual(VOLEY_FIVB);
  });

  it("resuelve presets y descarta ajustes inválidos", () => {
    const r = resolveRules("ecuavoley", { pointsPerSet: 12, pointsDecidingSet: 12, scoring: "nope" as never, maxSubstitutions: -1 });
    expect(r).toMatchObject({ sport: "ecuavoley", bestOf: 3, pointsPerSet: 12, pointsDecidingSet: 12, scoring: "sideout", maxSubstitutions: 6 });
    expect(resolveRules("voley", null, 3).bestOf).toBe(3);
    expect(describeRules(ECUAVOLEY)).toBe("Ecuavóley · al mejor de 3 · sets a 15 · con cambio de saque");
  });
});

describe("ecuavóley: formación", () => {
  it("exige 3 jugadores y no admite líbero", () => {
    const m = new Ecua().add({ type: "coin_toss", serving: "A", leftTeam: "A" });
    expect(m.add({ type: "lineup", team: "A", positions: [1, 2, 3, 4, 5, 6] }).rejected[0].error).toMatch(/3 jugadores/);
    expect(m.add({ type: "lineup", team: "A", positions: [1, 2, 3], liberos: [5] }).rejected[1].error).toMatch(/no usa líbero/);
    m.lineups();
    expect(m.state.phase).toBe("playing");
    expect(m.state.sets[0].teams.A.positions).toEqual([1, 2, 3]);
  });

  it("rechaza el líbero durante el juego", () => {
    const m = new Ecua().start().add({ type: "libero_in", team: "A", libero: 7, replaced: 3 });
    expect(m.rejected[0].error).toMatch(/no usa líbero/);
  });
});

describe("ecuavóley: puntuación con cambio", () => {
  it("si gana el receptor solo recupera el saque; no hay rotación", () => {
    const m = new Ecua().start("A");
    m.add({ type: "point", team: "B" });
    let st = m.state;
    expect(st.sets[0].score).toEqual({ A: 0, B: 0 });
    expect(st.serving).toBe("B");
    expect(st.sets[0].rallies[0].sideout).toBe(true);
    expect(st.log.at(-1)?.text).toMatch(/Cambio de saque para Calderón/);
    expect(st.sets[0].teams.B.positions).toEqual([1, 2, 3]);

    m.add({ type: "point", team: "B" });
    st = m.state;
    expect(st.sets[0].score).toEqual({ A: 0, B: 1 });
    m.add({ type: "point", team: "A" }, { type: "point", team: "A" });
    expect(m.state.sets[0].score).toEqual({ A: 1, B: 1 });
  });

  it("set a 15 con diferencia de 2 y al mejor de 3", () => {
    const m = new Ecua().start("A").setTo("A", 14, 14).scored("A");
    expect(m.state.sets[0].winner).toBeNull();
    m.scored("A");
    let st = m.state;
    expect(st.sets[0].score).toEqual({ A: 16, B: 14 });
    expect(st.sets[0].winner).toBe("A");
    expect(st.phase).toBe("lineups");
    expect(st.serving).toBe("B"); // alterna el primer saque

    m.lineups().setTo("A", 15, 9);
    st = m.state;
    expect(st.phase).toBe("finished");
    expect(st.winner).toBe("A");
    expect(st.setsWon).toEqual({ A: 2, B: 0 });
  });

  it("set decisivo: sorteo y cambio de cancha a los 8", () => {
    const m = new Ecua().start("A").setTo("A", 15, 10).lineups().setTo("B", 8, 15);
    expect(m.state.phase).toBe("coin_toss");
    m.add({ type: "coin_toss", serving: "B", leftTeam: "B" }).lineups().setTo("B", 0, 7);
    const left = m.state.leftTeam;
    m.scored("B");
    expect(m.state.notice).toBe("Cambio de cancha");
    expect(m.state.leftTeam).not.toBe(left);
  });

  it("variante a 12: gana a los 12 y el decisivo cambia de cancha a los 6", () => {
    const m = new Ecua(ecua({ pointsPerSet: 12, pointsDecidingSet: 12 })).start("A").setTo("A", 12, 5);
    expect(m.state.sets[0].winner).toBe("A");
    m.lineups().setTo("B", 4, 12).add({ type: "coin_toss", serving: "A", leftTeam: "A" }).lineups().setTo("A", 5, 0);
    m.scored("A");
    expect(m.state.notice).toBe("Cambio de cancha");
  });

  it("variante con punto directo: el receptor también suma", () => {
    const m = new Ecua(ecua({ scoring: "rally" })).start("A").add({ type: "point", team: "B" });
    expect(m.state.sets[0].score).toEqual({ A: 0, B: 1 });
    expect(m.state.serving).toBe("B");
  });
});

describe("ecuavóley: tiempos y sustituciones", () => {
  it("solo pide tiempo quien tiene el saque, máximo 2 por set", () => {
    const m = new Ecua().start("A").add({ type: "timeout", team: "B" });
    expect(m.rejected[0].error).toMatch(/saque/);
    m.add({ type: "timeout", team: "A" }, { type: "timeout", team: "A" }, { type: "timeout", team: "A" });
    expect(m.state.sets[0].teams.A.timeouts).toBe(2);
    expect(m.rejected[1].error).toMatch(/2 tiempos/);
  });

  it("sustitución libre: el que salió puede volver por otro jugador", () => {
    const m = new Ecua().start("A").add(
      { type: "substitution", team: "A", out: 1, in: 4 },
      { type: "substitution", team: "A", out: 2, in: 1 },
      { type: "substitution", team: "A", out: 4, in: 5 },
    );
    expect(m.rejected).toEqual([]);
    expect(m.state.sets[0].teams.A.positions).toEqual([5, 1, 3]);
    m.add(
      { type: "substitution", team: "A", out: 5, in: 6 },
      { type: "substitution", team: "A", out: 6, in: 7 },
      { type: "substitution", team: "A", out: 7, in: 2 },
      { type: "substitution", team: "A", out: 2, in: 4 },
    );
    expect(m.rejected[0].error).toMatch(/6 sustituciones/);
  });
});

describe("ecuavóley: simulación", () => {
  it("genera partidos completos y legales", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const s = ecua(seed % 2 ? undefined : { pointsPerSet: 12, pointsDecidingSet: 12 });
      const { events, state } = simulateMatch(s, { seed, pA: 0.55, signatures: { captainA: "A", captainB: "B", referee: "J" } });
      expect(state.phase).toBe("closed");
      expect(Math.max(state.setsWon.A, state.setsWon.B)).toBe(2);
      const evs = events.map((e, i) => ({ ...e, seq: i + 1 }) as MatchEvent);
      const r = replayDetailed(s, evs);
      expect(r.rejected).toEqual([]);
      for (const set of r.state.sets) {
        const target = set.no === 3 ? s.pointsDecidingSet! : s.pointsPerSet!;
        const hi = Math.max(set.score.A, set.score.B);
        expect(hi).toBeGreaterThanOrEqual(target);
        expect(Math.abs(set.score.A - set.score.B)).toBeGreaterThanOrEqual(2);
      }
    }
  });
});
