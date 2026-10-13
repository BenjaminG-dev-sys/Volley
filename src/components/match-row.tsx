import Link from "next/link";
import { LiveBadge, TeamCrest, cx } from "@/components/ui";
import { fmtDayShort, fmtTime } from "@/lib/format";
import type { Match, Team } from "@/lib/types";
import { STAGE_LABEL } from "@/lib/types";

/** Datos de presentación comunes a filas y tarjetas de partido. */
export function matchView(match: Match, teams: Map<string, Team>) {
  const home = teams.get(match.home_team_id);
  const away = teams.get(match.away_team_id);
  const ls = match.live_state;
  const res = match.result;
  const live = match.status === "live";
  const finished = match.status === "finished";
  return {
    home,
    away,
    live,
    finished,
    homeSets: live ? ls?.setsWon.A : res?.home_sets,
    awaySets: live ? ls?.setsWon.B : res?.away_sets,
    homeWon: finished && match.winner_team_id === match.home_team_id,
    awayWon: finished && match.winner_team_id === match.away_team_id,
    href: finished ? `/partidos/${match.id}/planilla` : `/partidos/${match.id}/en-vivo`,
    stage: `${home?.sport === "ecuavoley" ? "Ecuavóley · " : ""}${STAGE_LABEL[match.stage]}${match.group_label ? ` ${match.group_label}` : ""}`,
    liveScore: live && ls ? `Set ${ls.currentSet} · ${ls.score.A}-${ls.score.B}` : null,
    setScores: finished && res ? res.sets.map((s) => `${s.home}-${s.away}`) : null,
  };
}

function TeamLine({ team, sets, won, dim, showSets }: { team?: Team; sets?: number; won: boolean; dim: boolean; showSets: boolean }) {
  return (
    <div className={cx("flex items-center justify-between gap-3", dim && "text-muted")}>
      <span className="flex min-w-0 items-center gap-2.5">
        <TeamCrest name={team?.name ?? "—"} color={team?.color_primary ?? "#999"} logo={team?.logo_url} size="sm" />
        <span className={cx("truncate", won ? "font-bold" : "font-medium")}>
          <span className="sm:hidden">{team?.short_name ?? "—"}</span>
          <span className="hidden sm:inline">{team?.name ?? "—"}</span>
        </span>
      </span>
      {showSets && <span className="tabular font-display text-2xl font-extrabold leading-none">{sets ?? 0}</span>}
    </div>
  );
}

/** Parciales por set como fichas que pueden pasar a otra línea. */
export function SetScores({ sets, className }: { sets: string[]; className?: string }) {
  return (
    <span className={cx("tabular flex flex-wrap gap-1 text-muted @xl:justify-end", className)}>
      {sets.map((s, i) => (
        <span key={i} className="rounded-sm bg-surface-2 px-1.5 py-0.5">
          {s}
        </span>
      ))}
    </span>
  );
}

/** Partido en formato lista (calendario, resultados). */
export function MatchRow({ match, teams, showStage }: { match: Match; teams: Map<string, Team>; showStage?: boolean }) {
  const v = matchView(match, teams);
  return (
    <div className="@container">
    <Link href={v.href} className="group grid grid-cols-[4.5rem_1fr] items-center gap-x-4 gap-y-2 px-4 py-4 transition hover:bg-surface-2 @xl:grid-cols-[6rem_1fr_12rem] @xl:px-5">
      <div className="text-xs leading-tight">
        {v.live ? (
          <LiveBadge />
        ) : (
          <>
            <div className="font-semibold uppercase">{fmtDayShort(match.scheduled_at)}</div>
            <div className="tabular text-muted">{fmtTime(match.scheduled_at)}</div>
          </>
        )}
        {showStage && <div className="mt-1 text-muted">{v.stage}</div>}
      </div>
      <div className="min-w-0 space-y-2 text-sm">
        <TeamLine team={v.home} sets={v.homeSets} won={v.homeWon} dim={v.finished && !v.homeWon} showSets={match.status !== "scheduled"} />
        <TeamLine team={v.away} sets={v.awaySets} won={v.awayWon} dim={v.finished && !v.awayWon} showSets={match.status !== "scheduled"} />
      </div>
      <div className="col-start-2 text-xs @xl:col-start-auto @xl:text-right">
        {v.liveScore && <span className="tabular font-display text-base font-bold uppercase text-live">{v.liveScore}</span>}
        {v.setScores && <SetScores sets={v.setScores} />}
        {match.status === "scheduled" && <span className="eyebrow text-muted group-hover:text-ink">Previa →</span>}
      </div>
    </Link>
    </div>
  );
}
