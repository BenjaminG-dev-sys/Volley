import Link from "next/link";
import { Badge, LiveBadge, TeamDot, cx } from "@/components/ui";
import { fmtDateTime } from "@/lib/format";
import type { Match, Team } from "@/lib/types";
import { STAGE_LABEL } from "@/lib/types";

export function MatchRow({ match, teams, showStage }: { match: Match; teams: Map<string, Team>; showStage?: boolean }) {
  const home = teams.get(match.home_team_id);
  const away = teams.get(match.away_team_id);
  const ls = match.live_state;
  const res = match.result;
  const homeSets = match.status === "live" ? ls?.setsWon.A : res?.home_sets;
  const awaySets = match.status === "live" ? ls?.setsWon.B : res?.away_sets;
  const href = match.status === "finished" ? `/partidos/${match.id}/planilla` : `/partidos/${match.id}/en-vivo`;

  const side = (t: Team | undefined, sets: number | undefined, won: boolean) => (
    <div className={cx("flex items-center justify-between gap-2", match.status === "finished" && !won && "text-muted")}>
      <span className="flex min-w-0 items-center gap-2">
        <TeamDot color={t?.color_primary ?? "#999"} />
        <span className={cx("truncate", won && "font-semibold")}>{t?.short_name ?? "—"}</span>
      </span>
      <span className="tabular font-display text-lg font-bold">{match.status === "scheduled" ? "" : sets ?? 0}</span>
    </div>
  );

  return (
    <Link href={href} className="flex items-center gap-4 px-4 py-3 transition hover:bg-surface-2">
      <div className="w-28 shrink-0 text-xs text-muted">
        {match.status === "live" ? <LiveBadge /> : fmtDateTime(match.scheduled_at)}
        {showStage && (
          <div className="mt-1">
            {STAGE_LABEL[match.stage]}
            {match.group_label ? ` ${match.group_label}` : ""}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1 space-y-1 text-sm">
        {side(home, homeSets, match.winner_team_id === match.home_team_id)}
        {side(away, awaySets, match.winner_team_id === match.away_team_id)}
      </div>
      <div className="hidden w-40 shrink-0 text-right text-xs text-muted sm:block">
        {match.status === "live" && ls && (
          <span className="tabular font-display text-base font-semibold text-live">
            Set {ls.currentSet}: {ls.score.A}-{ls.score.B}
          </span>
        )}
        {match.status === "finished" && res && (
          <span className="tabular">{res.sets.map((s) => `${s.home}-${s.away}`).join(", ")}</span>
        )}
        {match.status === "scheduled" && <Badge>Programado</Badge>}
      </div>
    </Link>
  );
}
