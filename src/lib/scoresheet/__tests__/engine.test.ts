import { describe, expect, it } from "vitest";
import { applyEvent, initialState } from "../reducer";
import { replay } from "../replay";
import { rotate } from "../rotation";
import { legalSubstitutes, liberoTargets, validateEvent } from "../validators";
import { Sim, setup } from "./helpers";

describe("rotación", () => {
  it("rota en sentido horario: II pasa a I", () => {
    expect(rotate([1, 2, 3, 4, 5, 6])).toEqual([2, 3, 4, 5, 6, 1]);
  });
});

describe("inicio del partido", () => {
  it("exige sorteo y formaciones antes de anotar", () => {
    const s = new Sim();
    expect(s.state.phase).toBe("coin_toss");
    s.toss("B", "A");
    expect(s.state.phase).toBe("lineups");
    expect(validateEvent(s.state, { type: "point", team: "A" }, setup)).toMatch(/No hay un set/);
    s.lineups();
    expect(s.state.phase).toBe("playing");
    expect(s.state.serving).toBe("B");
  });

  it("valida la formación inicial", () => {
    const s = new Sim().toss();
    const st = s.state;
    expect(validateEvent(st, { type: "lineup", team: "A", positions: [1, 2, 3, 4, 5] }, setup)).toMatch(/6 jugadores/);
    expect(validateEvent(st, { type: "lineup", team: "A", positions: [1, 1, 3, 4, 5, 6] }, setup)).toMatch(/repetidos/);
    expect(validateEvent(st, { type: "lineup", team: "A", positions: [1, 2, 3, 4, 5, 11] }, setup)).toMatch(/líbero/);
    expect(validateEvent(st, { type: "lineup", team: "A", positions: [1, 2, 3, 4, 5, 99] }, setup)).toMatch(/nómina/);
    expect(
      validateEvent(st, { type: "lineup", team: "A", positions: [1, 2, 3, 4, 5, 6], liberos: [7] }, setup),
    ).toMatch(/no está registrado como líbero/);
  });
});

describe("rally point y saque", () => {
  it("el sacador conserva el saque al ganar; el receptor rota al recuperarlo", () => {
    const s = new Sim().toss("A").lineups([1, 2, 3, 4, 5, 6], [7, 8, 9, 10, 11, 1]);
    s.points("A");
    let st = s.state;
    expect(st.sets[0].score).toEqual({ A: 1, B: 0 });
    expect(st.serving).toBe("A");
    expect(st.sets[0].teams.A.positions).toEqual([1, 2, 3, 4, 5, 6]);

    s.points("B");
    st = s.state;
    expect(st.serving).toBe("B");
    expect(st.sets[0].teams.B.positions).toEqual([8, 9, 10, 11, 1, 7]);
    expect(st.sets[0].rallies[1]).toMatchObject({ winner: "B", server: "A", serverNumber: 1 });
  });

  it("set a 25 con diferencia de 2", () => {
    const s = new Sim().toss().lineups().setTo("A", 24, 24);
    // setTo deja al ganador anotando el último: 24-24 no cierra.
    expect(s.state.sets[0].winner).toBeNull();
    s.points("A");
    expect(s.state.sets[0].winner).toBeNull(); // 25-24
    s.points("A");
    const st = s.state;
    expect(st.sets[0].winner).toBe("A");
    expect(st.sets[0].score).toEqual({ A: 26, B: 24 });
    expect(st.setsWon).toEqual({ A: 1, B: 0 });
    expect(st.phase).toBe("lineups");
  });

  it("alterna el primer saque y el lado entre sets", () => {
    const s = new Sim().toss("A", "A").lineups().setTo("B", 20, 25);
    const st = s.state;
    expect(st.currentSet).toBe(2);
    expect(st.serving).toBe("B"); // no sacó primero en el set 1
    expect(st.leftTeam).toBe("B");
  });
});

describe("partido completo a 5 sets", () => {
  it("3-2 con set decisivo a 15, cambio de cancha a los 8, cierre con firmas", () => {
    const s = new Sim().toss("A", "A");
    s.lineups().setTo("A", 25, 20);
    s.lineups().setTo("B", 22, 25);
    s.lineups().setTo("A", 25, 18);
    s.lineups().setTo("B", 23, 25);
    let st = s.state;
    expect(st.setsWon).toEqual({ A: 2, B: 2 });
    expect(st.phase).toBe("coin_toss"); // sorteo del set decisivo

    s.toss("B", "B").lineups();
    st = s.state;
    expect(st.currentSet).toBe(5);
    expect(st.serving).toBe("B");

    s.points("BBBBBBBB"); // B llega a 8
    st = s.state;
    expect(st.notice).toBe("Cambio de cancha");
    expect(st.leftTeam).toBe("A");
    expect(st.sets[4].switchedAtEight).toBe(true);

    s.setTo("B", 13, 15);
    st = s.state;
    expect(st.sets[4].score).toEqual({ A: 13, B: 15 });
    expect(st.winner).toBe("B");
    expect(st.setsWon).toEqual({ A: 2, B: 3 });
    expect(st.phase).toBe("finished");
    expect(validateEvent(st, { type: "point", team: "A" }, setup)).not.toBeNull();

    expect(validateEvent(st, { type: "close", captainA: "", captainB: "x", referee: "y" }, setup)).toMatch(/firmas/);
    s.add({ type: "close", captainA: "Capitana A", captainB: "Capitana B", referee: "Árbitro" });
    expect(s.state.phase).toBe("closed");
  });

  it("al mejor de 3 se gana con 2 sets", () => {
    const s = new Sim({ ...setup, bestOf: 3 }).toss();
    s.lineups().setTo("A", 25, 10).lineups().setTo("A", 25, 10);
    expect(s.state.winner).toBe("A");
  });
});

describe("tiempos y sustituciones", () => {
  it("máximo 2 tiempos por set", () => {
    const s = new Sim().toss().lineups().add({ type: "timeout", team: "A" }, { type: "timeout", team: "A" });
    expect(validateEvent(s.state, { type: "timeout", team: "A" }, setup)).toMatch(/2 tiempos/);
    expect(validateEvent(s.state, { type: "timeout", team: "B" }, setup)).toBeNull();
  });

  it("el titular solo vuelve por su suplente y en su posición; una vez por set", () => {
    const s = new Sim().toss().lineups();
    s.add({ type: "substitution", team: "A", out: 3, in: 7 });
    let st = s.state;
    expect(st.sets[0].teams.A.positions[2]).toBe(7);
    // El 7 solo puede salir por el 3
    expect(validateEvent(st, { type: "substitution", team: "A", out: 7, in: 8 }, setup)).toMatch(/titular N.º 3/);
    expect(legalSubstitutes(st, setup, "A", 7)).toEqual([3]);
    // El 3 no puede entrar por otro jugador
    expect(validateEvent(st, { type: "substitution", team: "A", out: 4, in: 3 }, setup)).toMatch(/titular/);
    s.add({ type: "substitution", team: "A", out: 7, in: 3 });
    st = s.state;
    expect(st.sets[0].teams.A.positions[2]).toBe(3);
    // El 3 ya completó su ciclo; el 7 ya no puede volver a entrar
    expect(validateEvent(st, { type: "substitution", team: "A", out: 3, in: 8 }, setup)).toMatch(/ya completó/);
    expect(validateEvent(st, { type: "substitution", team: "A", out: 4, in: 7 }, setup)).toMatch(/ya entró/);
    expect(st.sets[0].teams.A.substitutions).toBe(2);
  });

  it("máximo 6 sustituciones por set y se reinician en el siguiente", () => {
    const s = new Sim().toss().lineups();
    s.add(
      { type: "substitution", team: "A", out: 1, in: 7 },
      { type: "substitution", team: "A", out: 2, in: 8 },
      { type: "substitution", team: "A", out: 3, in: 9 },
      { type: "substitution", team: "A", out: 4, in: 10 },
      { type: "substitution", team: "A", out: 7, in: 1 },
      { type: "substitution", team: "A", out: 8, in: 2 },
    );
    expect(validateEvent(s.state, { type: "substitution", team: "A", out: 9, in: 3 }, setup)).toMatch(/6 sustituciones/);
    s.setTo("A", 25, 0).lineups();
    expect(s.state.sets[1].teams.A.substitutions).toBe(0);
  });
});

describe("líbero", () => {
  it("solo reemplaza zagueros, no al sacador, y sale al rotar a delantera", () => {
    const s = new Sim().toss("B").lineups([1, 2, 3, 4, 5, 6]);
    let st = s.state;
    // posiciones: I=1, II=2, III=3, IV=4, V=5, VI=6
    expect(validateEvent(st, { type: "libero_in", team: "A", libero: 11, replaced: 3 }, setup)).toMatch(/zaguero/);
    expect(liberoTargets(st, setup, "A", 11).sort()).toEqual([1, 5, 6]);

    s.add({ type: "libero_in", team: "A", libero: 11, replaced: 5 });
    st = s.state;
    expect(st.sets[0].teams.A.positions[4]).toBe(11);
    expect(validateEvent(st, { type: "substitution", team: "A", out: 5, in: 7 }, setup)).toMatch(/líbero/);
    // Reemplazos seguidos sin rally: no permitido
    expect(validateEvent(st, { type: "libero_out", team: "A" }, setup)).toMatch(/rally/);

    // A recupera el saque: el líbero (en V) saldría a IV, así que vuelve el 5 y rota.
    s.points("A");
    st = s.state;
    expect(st.sets[0].teams.A.liberoOnCourt).toBeNull();
    expect(st.sets[0].teams.A.positions).toEqual([2, 3, 4, 5, 6, 1]);
    expect(st.log.some((l) => l.text.includes("por rotación"))).toBe(true);

    // A saca: el líbero no puede reemplazar al sacador (posición I)
    s.points("A");
    st = s.state;
    expect(validateEvent(st, { type: "libero_in", team: "A", libero: 11, replaced: 2 }, setup)).toMatch(/no puede sacar/);
  });
});

describe("sanciones", () => {
  it("castigo: punto y saque para el rival (con rotación)", () => {
    const s = new Sim().toss("A").lineups();
    s.add({ type: "sanction", team: "A", kind: "penalty", player: 4 });
    const st = s.state;
    expect(st.sets[0].score).toEqual({ A: 0, B: 1 });
    expect(st.serving).toBe("B");
    expect(st.sets[0].teams.B.positions).toEqual([2, 3, 4, 5, 6, 1]);
    expect(st.sets[0].rallies[0].bySanction).toBe(true);
  });

  it("retraso: primero amonestación, luego castigo", () => {
    const s = new Sim().toss("A").lineups();
    s.add({ type: "sanction", team: "B", kind: "delay" });
    expect(s.state.sanctions[0].kind).toBe("delay_warning");
    expect(s.state.sets[0].score).toEqual({ A: 0, B: 0 });
    s.add({ type: "sanction", team: "B", kind: "delay" });
    expect(s.state.sanctions[1].kind).toBe("delay_penalty");
    expect(s.state.sets[0].score).toEqual({ A: 1, B: 0 });
  });

  it("expulsado no puede volver a entrar en el set; descalificado en todo el partido", () => {
    const s = new Sim().toss().lineups();
    s.add({ type: "sanction", team: "A", kind: "expulsion", player: 2 });
    expect(s.state.notice).toMatch(/debe ser sustituido/);
    s.add({ type: "substitution", team: "A", out: 2, in: 7 });
    expect(validateEvent(s.state, { type: "substitution", team: "A", out: 7, in: 2 }, setup)).toMatch(/expulsado/);
    s.add({ type: "sanction", team: "A", kind: "disqualification", player: 3 });
    s.add({ type: "substitution", team: "A", out: 3, in: 8 });
    s.setTo("B", 0, 25);
    expect(
      validateEvent(s.state, { type: "lineup", team: "A", positions: [1, 2, 3, 4, 5, 6] }, setup),
    ).toMatch(/descalificado/);
  });
});

describe("deshacer y replay", () => {
  it("undo reconstruye exactamente el estado previo", () => {
    const base = new Sim().toss().lineups().points("AABAB").add({ type: "timeout", team: "B" });
    const before = base.state;
    const withUndo = new Sim();
    withUndo.events = [...base.events];
    withUndo.points("B").add({ type: "substitution", team: "A", out: 1, in: 7 });
    withUndo.add({ type: "undo" }, { type: "undo" });
    const after = withUndo.state;
    expect({ ...after, lastSeq: 0 }).toEqual({ ...before, lastSeq: 0 });
    expect(withUndo.detailed.undoDepth).toBe(base.detailed.undoDepth);
  });

  it("undo puede deshacer un fin de set", () => {
    const s = new Sim().toss().lineups().setTo("A", 25, 10);
    expect(s.state.setsWon.A).toBe(1);
    s.add({ type: "undo" });
    const st = s.state;
    expect(st.setsWon.A).toBe(0);
    expect(st.sets[0].score).toEqual({ A: 24, B: 10 });
    expect(st.phase).toBe("playing");
  });

  it("ignora eventos inválidos y los reporta", () => {
    const s = new Sim().toss().lineups().add({ type: "timeout", team: "A" }, { type: "timeout", team: "A" }, { type: "timeout", team: "A" });
    const { state, rejected } = s.detailed;
    expect(state.sets[0].teams.A.timeouts).toBe(2);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].seq).toBe(6);
  });

  it("applyEvent no muta el estado anterior", () => {
    const st0 = replay(setup, new Sim().toss().lineups().events);
    const copy = structuredClone(st0);
    applyEvent(st0, { type: "point", team: "B" }, setup);
    expect(st0).toEqual(copy);
    expect(initialState(setup).phase).toBe("coin_toss");
  });
});

describe("cambio de cancha manual", () => {
  it("intercambia los lados, se deshace y se mantiene en el set siguiente", () => {
    const s = new Sim().toss("A", "A").lineups().add({ type: "switch_sides" });
    expect(s.state.leftTeam).toBe("B");
    expect(s.state.log.at(-1)?.text).toBe("Cambio de cancha: Club B a la izquierda");
    expect(new Sim().toss("A", "A").lineups().add({ type: "switch_sides" }, { type: "undo" }).state.leftTeam).toBe("A");
    s.points("A".repeat(25));
    expect(s.state.currentSet).toBe(2);
    expect(s.state.leftTeam).toBe("A");
  });

  it("no se registra antes del sorteo", () => {
    const { rejected } = new Sim().add({ type: "switch_sides" }).detailed;
    expect(rejected).toHaveLength(1);
  });
});
