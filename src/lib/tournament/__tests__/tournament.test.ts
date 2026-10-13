import { describe, expect, it } from "vitest";
import { validateCategoryAge } from "../categories";
import { cedulaCheckDigit, makeCedula, validateCedula } from "../cedula";
import { crossSemis, roundRobin, snakeGroups } from "../scheduler";
import { recentForm } from "../form";
import { computeStandings, matchPoints } from "../standings";

describe("cédula ecuatoriana", () => {
  it("acepta cédulas válidas", () => {
    expect(validateCedula("1710034065")).toBeNull();
    expect(validateCedula("0926687856")).toBeNull();
  });
  it("rechaza formatos y dígitos inválidos", () => {
    expect(validateCedula("17100340")).toMatch(/10 dígitos/);
    expect(validateCedula("9910034065")).toMatch(/provincia/);
    expect(validateCedula("1770034065")).toMatch(/tercer dígito/);
    expect(validateCedula("1710034066")).toMatch(/verificador/);
  });
  it("calcula el verificador y genera cédulas válidas", () => {
    expect(cedulaCheckDigit("171003406")).toBe(5);
    for (let i = 0; i < 200; i++) expect(validateCedula(makeCedula((i % 24) + 1, i * 7919))).toBeNull();
  });
});

describe("categorías por edad", () => {
  it("Sub-19 en 2026 admite nacidos desde 2008", () => {
    expect(validateCategoryAge("Sub-19", "2008-01-01", 2026)).toBeNull();
    expect(validateCategoryAge("Sub-19", "2007-12-31", 2026)).toMatch(/Supera/);
    expect(validateCategoryAge("Mayores", "1980-05-05", 2026)).toBeNull();
    expect(validateCategoryAge("Master", "2000-05-05", 2026)).toMatch(/35/);
  });
});

describe("calendario", () => {
  it("todos contra todos: cada par una vez, sin repetir equipo por jornada", () => {
    const teams = ["a", "b", "c", "d", "e", "f"];
    const fx = roundRobin(teams);
    expect(fx).toHaveLength(15);
    const pairs = new Set(fx.map((f) => [f.home, f.away].sort().join("-")));
    expect(pairs.size).toBe(15);
    for (let r = 1; r <= 5; r++) {
      const inRound = fx.filter((f) => f.round === r).flatMap((f) => [f.home, f.away]);
      expect(new Set(inRound).size).toBe(6);
    }
  });
  it("número impar de equipos: uno descansa por jornada", () => {
    const fx = roundRobin(["a", "b", "c", "d", "e"]);
    expect(fx).toHaveLength(10);
    expect(new Set(fx.map((f) => f.round)).size).toBe(5);
  });
  it("grupos en serpentina y semifinales cruzadas", () => {
    expect(snakeGroups(["1", "2", "3", "4", "5", "6", "7", "8"], 2)).toEqual([
      ["1", "4", "5", "8"],
      ["2", "3", "6", "7"],
    ]);
    expect(crossSemis(["A1", "A2"], ["B1", "B2"]).map((f) => `${f.home}-${f.away}`)).toEqual(["A1-B2", "B1-A2"]);
  });
});

describe("tabla de posiciones FIVB", () => {
  it("3-0/3-1 = 3 pts; 3-2 = 2/1", () => {
    expect(matchPoints(3, 0, 5)).toEqual([3, 0]);
    expect(matchPoints(3, 1, 5)).toEqual([3, 0]);
    expect(matchPoints(3, 2, 5)).toEqual([2, 1]);
    expect(matchPoints(2, 1, 3)).toEqual([2, 1]);
  });

  it("ordena por puntos, victorias, cociente de sets y de puntos", () => {
    const s = (h: number, a: number) => ({ home: h, away: a });
    const table = computeStandings(
      ["x", "y", "z"],
      [
        { home: "x", away: "y", bestOf: 5, sets: [s(25, 20), s(25, 20), s(25, 20)] }, // x 3-0
        { home: "y", away: "z", bestOf: 5, sets: [s(25, 20), s(20, 25), s(25, 20), s(20, 25), s(15, 10)] }, // y 3-2
        { home: "z", away: "x", bestOf: 5, sets: [s(25, 23), s(25, 23), s(25, 23)] }, // z 3-0
      ],
    );
    const byId = Object.fromEntries(table.map((r) => [r.teamId, r]));
    expect(byId.x.points).toBe(3);
    expect(byId.y.points).toBe(2);
    expect(byId.z.points).toBe(4);
    expect(table.map((r) => r.teamId)).toEqual(["z", "x", "y"]);
    expect(byId.y).toMatchObject({ played: 2, won: 1, lost: 1, setsWon: 3, setsLost: 5 });
  });
});

describe("forma reciente", () => {
  const m = (home: string, away: string, day: number, hs: number, as: number) => ({
    home,
    away,
    scheduledAt: `2026-10-${String(day).padStart(2, "0")}T15:00:00Z`,
    homeSets: hs,
    awaySets: as,
  });
  it("devuelve los últimos resultados en orden cronológico", () => {
    const ms = [m("a", "b", 5, 3, 1), m("c", "a", 1, 3, 0), m("a", "d", 9, 2, 3), m("b", "c", 3, 3, 0)];
    expect(recentForm("a", ms)).toEqual(["P", "G", "P"]);
    expect(recentForm("a", ms, 2)).toEqual(["G", "P"]);
    expect(recentForm("z", ms)).toEqual([]);
  });
});
