import { describe, expect, it } from "vitest";
import { resolveRules } from "@/lib/scoresheet";
import { Sim } from "@/lib/scoresheet/__tests__/helpers";
import type { MatchSetup } from "@/lib/scoresheet";
import { matchStats } from "../match";
import { tournamentHighlights } from "../tournament";

describe("estadísticas de partido (vóley)", () => {
  it("separa puntos en saque y en recepción, rachas, castigos y la evolución del marcador", () => {
    // Saca A. A anota 3 seguidos (en saque), B recupera (recepción) y anota 1 en su saque, castigo a B.
    const sim = new Sim().toss("A").lineups().points("AAABB").add({ type: "timeout", team: "A" }, { type: "sanction", team: "B", kind: "penalty" });
    const s = matchStats(sim.state);
    expect(s.teams.A).toMatchObject({ points: 4, serve: 3, receive: 1, bestRun: 3, bySanction: 1, timeouts: 1, sideouts: 0 });
    expect(s.teams.B).toMatchObject({ points: 2, serve: 1, receive: 1, bestRun: 2 });
    expect(s.teams.A.topServer).toEqual({ number: 1, points: 3 });
    expect(s.flows[0].points.map((p) => p.lead)).toEqual([0, 1, 2, 3, 2, 1, 2]);
    expect(s.flows[0].points.at(-1)).toEqual({ A: 4, B: 2, lead: 2 });
  });
});

describe("estadísticas de partido (ecuavóley)", () => {
  it("cuenta los cambios de saque aparte y no los pone en la evolución", () => {
    const rules = resolveRules("ecuavoley");
    const players = Array.from({ length: 7 }, (_, i) => ({ number: i + 1, name: `J${i + 1}` }));
    const setup: MatchSetup = { bestOf: 3, rules, teams: { A: { name: "A", players }, B: { name: "B", players } } };
    const sim = new Sim(setup).add(
      { type: "coin_toss", serving: "A", leftTeam: "A" },
      { type: "lineup", team: "A", positions: [1, 2, 3] },
      { type: "lineup", team: "B", positions: [1, 2, 3] },
    );
    sim.points("ABBBA"); // A punto, B cambio, B punto, B punto, A cambio
    const s = matchStats(sim.state);
    expect(s.teams.A).toMatchObject({ points: 1, sideouts: 1, serve: 1, receive: 0 });
    expect(s.teams.B).toMatchObject({ points: 2, sideouts: 1, serve: 2, bestRun: 2 });
    expect(s.flows[0].points).toHaveLength(4);
  });
});

describe("destacados del torneo", () => {
  it("resume sets, puntos, set más largo y mejores ataque y defensa", () => {
    const h = tournamentHighlights([
      { id: "m1", home: "a", away: "b", bestOf: 5, result: { sets: [{ home: 25, away: 20 }, { home: 30, away: 28 }, { home: 25, away: 10 }], home_sets: 3, away_sets: 0 } },
      { id: "m2", home: "b", away: "c", bestOf: 5, result: { sets: [{ home: 25, away: 23 }, { home: 20, away: 25 }, { home: 25, away: 22 }, { home: 23, away: 25 }, { home: 15, away: 13 }], home_sets: 3, away_sets: 2 } },
    ]);
    expect(h).toMatchObject({ matches: 2, sets: 8, decidingSets: 1 });
    expect(h.points).toBe(45 + 58 + 35 + 48 + 45 + 47 + 48 + 28);
    expect(h.longestSet).toMatchObject({ matchId: "m1", set: 2, score: { home: 30, away: 28 } });
    expect(h.bestAttack?.teamId).toBe("a");
    expect(h.bestDefense?.teamId).toBe("a");
  });
});
