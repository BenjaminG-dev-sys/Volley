import { describe, expect, it } from "vitest";
import { scoringAccess } from "../match";

const at = "2026-11-14T14:00:00.000Z"; // 09:00 ECT
const m = (over: Partial<{ status: string; scorer_id: string | null; scheduled_at: string | null }> = {}) => ({
  status: "scheduled",
  scorer_id: "vocal",
  scheduled_at: at,
  ...over,
});
const t = (iso: string) => new Date(iso);

describe("scoringAccess: solo el vocal designado, en su horario", () => {
  it("permite al vocal dentro de la ventana (30 min antes a 4 h después)", () => {
    expect(scoringAccess(m(), "vocal", t("2026-11-14T13:30:00Z")).ok).toBe(true);
    expect(scoringAccess(m({ status: "live" }), "vocal", t("2026-11-14T18:00:00Z")).ok).toBe(true);
  });
  it("rechaza a cualquier otro usuario, aunque sea organizador o admin", () => {
    expect(scoringAccess(m(), "admin", t("2026-11-14T14:10:00Z"))).toMatchObject({ ok: false, reason: "not_assigned" });
    expect(scoringAccess(m({ scorer_id: null }), "vocal", t("2026-11-14T14:10:00Z"))).toMatchObject({ ok: false, reason: "not_assigned" });
  });
  it("rechaza fuera del horario", () => {
    expect(scoringAccess(m(), "vocal", t("2026-11-14T13:29:00Z"))).toMatchObject({ ok: false, reason: "too_early" });
    expect(scoringAccess(m({ status: "live" }), "vocal", t("2026-11-14T18:01:00Z"))).toMatchObject({ ok: false, reason: "too_late" });
    expect(scoringAccess(m({ scheduled_at: null }), "vocal")).toMatchObject({ ok: false, reason: "unscheduled" });
  });
  it("un partido cerrado no se edita", () => {
    expect(scoringAccess(m({ status: "finished" }), "vocal", t("2026-11-14T14:10:00Z"))).toMatchObject({ ok: false, reason: "finished" });
  });
});
