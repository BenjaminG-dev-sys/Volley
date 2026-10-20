import { describe, expect, it } from "vitest";
import { Sim } from "@/lib/scoresheet/__tests__/helpers";
import { addAppearances, emptyAppearances } from "../appearances";

describe("participación del jugador", () => {
  it("cuenta sets como titular, ingresos y partidos jugados", () => {
    // Set 1: A titulares 1-6, entra el 7 por el 3 y el líbero 11 por el 6 (zaguero). Set 2: titulares sin el 6, entra el 6.
    const sim = new Sim()
      .toss("A")
      .lineups()
      .add({ type: "substitution", team: "A", out: 3, in: 7 })
      .points("B")
      .add({ type: "libero_in", team: "A", libero: 11, replaced: 6 })
      .setTo("A", 25, 10)
      .lineups([1, 2, 3, 4, 5, 8], [1, 2, 3, 4, 5, 6])
      .add({ type: "substitution", team: "A", out: 8, in: 6 });
    const st = sim.state;
    expect(addAppearances(emptyAppearances(), st, "A", 3)).toEqual({ matches: 1, sets: 2, starts: 2, subIns: 0 });
    expect(addAppearances(emptyAppearances(), st, "A", 7)).toEqual({ matches: 1, sets: 1, starts: 0, subIns: 1 });
    expect(addAppearances(emptyAppearances(), st, "A", 6)).toEqual({ matches: 1, sets: 2, starts: 1, subIns: 1 });
    expect(addAppearances(emptyAppearances(), st, "A", 11)).toEqual({ matches: 1, sets: 1, starts: 0, subIns: 1 });
    expect(addAppearances(emptyAppearances(), st, "A", 10)).toEqual({ matches: 0, sets: 0, starts: 0, subIns: 0 });
  });

  it("respeta deshacer y acumula varios partidos", () => {
    const sim = new Sim().toss("A").lineups().add({ type: "substitution", team: "A", out: 3, in: 7 }, { type: "undo" });
    const total = emptyAppearances();
    addAppearances(total, sim.state, "A", 7);
    expect(total.subIns).toBe(0);
    addAppearances(total, sim.state, "A", 1);
    addAppearances(total, sim.state, "A", 1);
    expect(total).toMatchObject({ matches: 2, sets: 2, starts: 2 });
  });
});
