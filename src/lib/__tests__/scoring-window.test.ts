import { describe, expect, it } from "vitest";
import { scoringAccess } from "../scoring-window";

const at = "2026-11-12T18:00:00.000Z";
const base = { scorer_id: "vocal", scheduled_at: at, status: "scheduled" };
const t = (iso: string) => new Date(iso);

describe("scoringAccess", () => {
  it("permite al vocal designado dentro del horario", () => {
    expect(scoringAccess(base, "vocal", t("2026-11-12T17:31:00Z")).ok).toBe(true);
    expect(scoringAccess(base, "vocal", t("2026-11-12T21:59:00Z")).ok).toBe(true);
  });
  it("rechaza a cualquier otro usuario, aunque sea organizador", () => {
    expect(scoringAccess(base, "admin", t("2026-11-12T18:10:00Z"))).toMatchObject({ ok: false, reason: "not_assigned" });
    expect(scoringAccess({ ...base, scorer_id: null }, "vocal", t("2026-11-12T18:10:00Z"))).toMatchObject({ ok: false, reason: "not_assigned" });
  });
  it("rechaza fuera del horario", () => {
    expect(scoringAccess(base, "vocal", t("2026-11-12T17:29:00Z"))).toMatchObject({ ok: false, reason: "too_early" });
    expect(scoringAccess(base, "vocal", t("2026-11-12T22:01:00Z"))).toMatchObject({ ok: false, reason: "too_late" });
  });
  it("rechaza sin horario o con partido cerrado", () => {
    expect(scoringAccess({ ...base, scheduled_at: null }, "vocal")).toMatchObject({ ok: false, reason: "no_schedule" });
    expect(scoringAccess({ ...base, status: "finished" }, "vocal", t("2026-11-12T18:10:00Z"))).toMatchObject({ ok: false, reason: "finished" });
  });
});
