import Link from "next/link";
import type { Match, Team } from "@/lib/types";

/** Franja negra con resultados y marcadores en vivo desplazándose. */
export function ResultsMarquee({ matches, teams }: { matches: Match[]; teams: Map<string, Team> }) {
  if (!matches.length) return null;
  const items = matches.map((m) => {
    const h = teams.get(m.home_team_id)?.short_name ?? "—";
    const a = teams.get(m.away_team_id)?.short_name ?? "—";
    const live = m.status === "live" && m.live_state;
    const score = live
      ? `${m.live_state!.setsWon.A}-${m.live_state!.setsWon.B} · ${m.live_state!.score.A}-${m.live_state!.score.B}`
      : `${m.result?.home_sets ?? 0}-${m.result?.away_sets ?? 0}`;
    return { id: m.id, h, a, score, live: Boolean(live), href: live ? `/partidos/${m.id}/en-vivo` : `/partidos/${m.id}/planilla` };
  });
  // Se repite la lista para que el desplazamiento sea continuo.
  const loop = [...items, ...items];
  return (
    <div className="relative left-1/2 w-screen -translate-x-1/2 overflow-hidden bg-black py-3 text-paper" aria-label="Resultados">
      <div className="marquee gap-10 pr-10">
        {loop.map((it, i) => (
          <Link
            key={`${it.id}-${i}`}
            href={it.href}
            aria-hidden={i >= items.length || undefined}
            tabIndex={i >= items.length ? -1 : undefined}
            className="flex items-center gap-3 whitespace-nowrap font-display text-lg font-bold uppercase tracking-wide"
          >
            {it.live && <span className="live-dot h-2 w-2 rounded-full bg-volt" />}
            <span>{it.h}</span>
            <span className={it.live ? "tabular text-volt" : "tabular text-white/60"}>{it.score}</span>
            <span>{it.a}</span>
            <span className="text-white/25">/</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
