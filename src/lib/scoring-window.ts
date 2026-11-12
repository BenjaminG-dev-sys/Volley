export const SCORING_OPENS_BEFORE_MIN = 30;
export const SCORING_CLOSES_AFTER_MIN = 240;

export interface ScoringWindow {
  opensAt: Date;
  closesAt: Date;
}

export function scoringWindow(scheduledAt: string | null): ScoringWindow | null {
  if (!scheduledAt) return null;
  const t = new Date(scheduledAt).getTime();
  if (Number.isNaN(t)) return null;
  return {
    opensAt: new Date(t - SCORING_OPENS_BEFORE_MIN * 60_000),
    closesAt: new Date(t + SCORING_CLOSES_AFTER_MIN * 60_000),
  };
}

export type ScoringAccess =
  | { ok: true; window: ScoringWindow }
  | { ok: false; reason: "not_assigned" | "no_schedule" | "too_early" | "too_late" | "finished"; window: ScoringWindow | null };

export function scoringAccess(
  match: { scorer_id: string | null; scheduled_at: string | null; status: string },
  userId: string,
  now: Date = new Date(),
): ScoringAccess {
  const window = scoringWindow(match.scheduled_at);
  if (!match.scorer_id || match.scorer_id !== userId) return { ok: false, reason: "not_assigned", window };
  if (match.status === "finished") return { ok: false, reason: "finished", window };
  if (!window) return { ok: false, reason: "no_schedule", window };
  if (now < window.opensAt) return { ok: false, reason: "too_early", window };
  if (now > window.closesAt) return { ok: false, reason: "too_late", window };
  return { ok: true, window };
}
