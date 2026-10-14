import { describe, expect, it } from "vitest";
import { Sim } from "@/lib/scoresheet/__tests__/helpers";
import { replayDetailed } from "@/lib/scoresheet";
import { makeCedula } from "@/lib/tournament/cedula";
import { semifinalPairs } from "@/lib/tournament/knockout";
import { computeStandings, standingsConfig, STANDINGS_PRESETS, type StandingRow } from "@/lib/tournament/standings";
import { conflictedIds, detectConflicts } from "../conflicts";
import { parseCsv, parseDate, parseRoster, toCsv } from "../csv";

describe("sistema de puntos configurable", () => {
  const ms = [
    { home: "a", away: "b", bestOf: 5 as const, sets: [25, 25, 25].map((h) => ({ home: h, away: 20 })) },
    { home: "b", away: "c", bestOf: 5 as const, sets: [{ home: 25, away: 20 }, { home: 20, away: 25 }, { home: 25, away: 20 }, { home: 20, away: 25 }, { home: 15, away: 10 }] },
  ];
  it("FIVB por defecto y presets alternativos", () => {
    const pts = (cfg?: Parameters<typeof computeStandings>[2]) => Object.fromEntries(computeStandings(["a", "b", "c"], ms, cfg).map((r) => [r.teamId, r.points]));
    expect(pts()).toEqual({ a: 3, b: 2, c: 1 });
    expect(pts(STANDINGS_PRESETS.dos_uno.config)).toEqual({ a: 2, b: 3, c: 1 });
    expect(pts(STANDINGS_PRESETS.tres_cero.config)).toEqual({ a: 3, b: 3, c: 0 });
  });
  it("lee la configuración guardada y descarta valores inválidos", () => {
    expect(standingsConfig(null)).toEqual(STANDINGS_PRESETS.fivb.config);
    expect(standingsConfig({ win: 2, loss: 1, winTiebreak: "x", lossTiebreak: -1 })).toEqual({ win: 2, loss: 1, winTiebreak: 2, lossTiebreak: 1 });
  });
});

describe("semifinales con N grupos", () => {
  const row = (teamId: string, points: number): StandingRow => ({ teamId, points, played: 3, won: points / 3, lost: 0, setsWon: 0, setsLost: 0, pointsWon: 0, pointsLost: 0, setRatio: 1, pointRatio: 1 });
  const g = (group: string, ...ids: [string, number][]) => ({ group, rows: ids.map(([t, p]) => row(t, p)) });
  it("1 grupo: 1–4 y 2–3", () => {
    expect(semifinalPairs([g("A", ["a", 9], ["b", 6], ["c", 3], ["d", 0])])).toEqual([["a", "d"], ["b", "c"]]);
  });
  it("2 grupos: cruzadas", () => {
    expect(semifinalPairs([g("B", ["b1", 6], ["b2", 3]), g("A", ["a1", 6], ["a2", 3])])).toEqual([["a1", "b2"], ["b1", "a2"]]);
  });
  it("3 grupos: primeros + mejor segundo", () => {
    const pairs = semifinalPairs([g("A", ["a1", 9], ["a2", 3]), g("B", ["b1", 6], ["b2", 6]), g("C", ["c1", 3], ["c2", 0])]);
    expect(pairs).toEqual([["a1", "b2"], ["b1", "c1"]]);
  });
  it("4 grupos: 1A–1D y 1B–1C", () => {
    expect(semifinalPairs(["A", "B", "C", "D"].map((x) => g(x, [`${x}1`, 6], [`${x}2`, 3])))).toEqual([["A1", "D1"], ["B1", "C1"]]);
  });
  it("valida mínimos", () => {
    expect(() => semifinalPairs([g("A", ["a", 3], ["b", 0])])).toThrow(/4 equipos/);
  });
});

describe("conflictos de calendario", () => {
  const m = (id: string, home: string, away: string, at: string, venue: string | null = null) => ({ id, home_team_id: home, away_team_id: away, venue_id: venue, scheduled_at: at });
  it("detecta equipo o sede ocupados en partidos que se superponen", () => {
    const cs = detectConflicts([
      m("1", "a", "b", "2026-10-20T15:00:00Z", "v1"),
      m("2", "b", "c", "2026-10-20T16:00:00Z", "v2"),
      m("3", "d", "e", "2026-10-20T16:30:00Z", "v1"),
      m("4", "a", "c", "2026-10-20T17:30:00Z", "v1"),
    ]);
    expect(cs).toEqual([
      { a: "1", b: "2", reason: "team", ref: "b" },
      { a: "1", b: "3", reason: "venue", ref: "v1" },
      { a: "2", b: "4", reason: "team", ref: "c" },
      { a: "3", b: "4", reason: "venue", ref: "v1" },
    ]);
    expect([...conflictedIds(cs)].sort()).toEqual(["1", "2", "3", "4"]);
    expect(detectConflicts([m("1", "a", "b", "2026-10-20T15:00:00Z"), m("2", "a", "c", "2026-10-20T17:00:00Z")])).toEqual([]);
  });
});

describe("CSV", () => {
  it("separa con ; o , y respeta comillas", () => {
    expect(parseCsv('a;b;c\n"1;2";"di ""x""";3\r\n\n')).toEqual([["a", "b", "c"], ["1;2", 'di "x"', "3"]]);
    expect(parseCsv("a,b\n1,2")).toEqual([["a", "b"], ["1", "2"]]);
    expect(toCsv([["Equipo", "Nota"], ["LDU", 'dijo "hola"; ok']])).toBe('﻿Equipo;Nota\r\nLDU;"dijo ""hola""; ok"\r\n');
  });
  it("lee fechas en dos formatos", () => {
    expect(parseDate("2008-03-09")).toBe("2008-03-09");
    expect(parseDate("9/3/2008")).toBe("2008-03-09");
    expect(parseDate("31/02/2008")).toBeNull();
  });
  it("valida la nómina fila por fila", () => {
    const c1 = makeCedula(17, 1234);
    const c2 = makeCedula(9, 5678);
    const csv = [
      "Nombres;Apellidos;Cédula;Fecha de nacimiento;Número;Posición;Líbero;Capitán",
      `Ana;Pérez;${c1};2008-01-10;7;Armador;;sí`,
      `Eva;Mora;1710034066;2008-01-10;8;punta;;`,
      `Sol;Vera;${c2};2003-05-01;7;central;;`,
      `Luz;Toro;${makeCedula(1, 99)};2009-02-02;12;;x;`,
    ].join("\n");
    const { rows, errors } = parseRoster(csv, { positions: ["armador", "opuesto", "central", "punta"], allowLibero: true, existingNumbers: [1], category: "Sub-19", season: 2026 });
    expect(rows.map((r) => [r.first_name, r.number, r.position, r.is_libero, r.is_captain])).toEqual([
      ["Ana", 7, "armador", false, true],
      ["Luz", 12, "libero", true, false],
    ]);
    expect(errors.map((e) => e.line)).toEqual([2, 3]);
    expect(errors[0].message).toMatch(/verificador/);
    expect(errors[1].message).toMatch(/Supera la edad/);
    expect(errors[1].message).toMatch(/número 7 ya está usado/);
  });
  it("exige las columnas mínimas y respeta el deporte", () => {
    expect(parseRoster("Nombre;Apellido\nA;B", { positions: [], allowLibero: false }).errors[0].message).toMatch(/Cédula/);
    const r = parseRoster(`Nombres;Apellidos;Cédula;Nacimiento;Dorsal;Líbero\nA;B;${makeCedula(17, 7)};1990-01-01;3;sí`, { positions: ["servidor"], allowLibero: false });
    expect(r.errors[0].message).toMatch(/no usa líbero/);
  });
});

describe("reapertura de partidos", () => {
  it("solo deshace el cierre y queda en la planilla", () => {
    const sim = new Sim().toss("A").lineups().setTo("A", 25, 10).lineups().setTo("A", 25, 10).lineups().setTo("A", 25, 10);
    sim.add({ type: "reopen" });
    expect(replayDetailed(sim.s, sim.events).rejected[0].error).toMatch(/cerrado/);
    sim.add({ type: "close", captainA: "a", captainB: "b", referee: "r" }, { type: "reopen" });
    let st = replayDetailed(sim.s, sim.events);
    expect(st.state.phase).toBe("finished");
    expect(st.state.signatures).toBeNull();
    sim.add({ type: "undo" });
    st = replayDetailed(sim.s, sim.events);
    expect(st.state.phase).toBe("playing");
    expect(st.state.sets[2].score).toEqual({ A: 24, B: 10 });
  });
});
