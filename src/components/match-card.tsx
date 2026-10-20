import Link from "next/link";
import { SetScores, matchView } from "@/components/match-row";
import { LiveBadge, TeamCrest, cx } from "@/components/ui";
import { fmtDayShort, fmtTime } from "@/lib/format";
import type { Match, Team } from "@/lib/types";

/** Tarjeta vertical de partido para carruseles. Los partidos en vivo van en negro. */
export function MatchCard({ match, teams }: { match: Match; teams: Map<string, Team> }) {
  const v = matchView(match, teams);
  const side = (team: Team | undefined, sets: number | undefined, won: boolean, dim: boolean) => (
    <div className={cx("flex items-center justify-between gap-3", dim && "opacity-55")}>
      <span className="flex min-w-0 items-center gap-3">
        <TeamCrest name={team?.name ?? "—"} color={team?.color_primary ?? "#999"} logo={team?.logo_url} size="md" />
        <span className={cx("truncate font-display text-xl uppercase", won ? "font-extrabold" : "font-bold")}>{team?.short_name ?? "—"}</span>
      </span>
      {match.status !== "scheduled" && <span className="tabular font-display text-4xl font-extrabold leading-none">{sets ?? 0}</span>}
    </div>
  );
  return (
    <Link
      href={v.href}
      className={cx(
        "group flex w-[300px] shrink-0 snap-start flex-col gap-5 rounded-2xl p-5 transition sm:w-[340px]",
        v.live ? "bg-black text-paper ring-1 ring-white/10 hover:ring-volt" : "border border-line bg-surface hover:border-ink",
      )}
    >
      <div className="flex items-center justify-between text-xs">
        {v.live ? <LiveBadge /> : <span className="font-semibold uppercase">{fmtDayShort(match.scheduled_at)} · {fmtTime(match.scheduled_at)}</span>}
        <span className={v.live ? "text-white/60" : "text-muted"}>{v.stage}</span>
      </div>
      <div className="space-y-3">
        {side(v.home, v.homeSets, v.homeWon, v.finished && !v.homeWon)}
        {side(v.away, v.awaySets, v.awayWon, v.finished && !v.awayWon)}
      </div>
      <div className={cx("mt-auto border-t pt-3 text-xs", v.live ? "border-white/15" : "border-line")}>
        {v.liveScore && <span className="tabular font-display text-lg font-bold uppercase text-volt">{v.liveScore}</span>}
        {v.setScores && <SetScores sets={v.setScores} />}
        {match.status === "scheduled" && <span className="eyebrow text-muted group-hover:text-ink">Ver previa →</span>}
      </div>
    </Link>
  );
}

/** Fila horizontal con scroll-snap para tarjetas. */
export function Carousel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cx("-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:scroll-px-6 sm:px-6 lg:-mx-12 lg:scroll-px-12 lg:px-12", className)}>
      {children}
    </div>
  );
}
