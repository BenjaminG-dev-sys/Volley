import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { listMatches, listTeams, listTournaments, listVenues } from "@/lib/data";
import { ScheduleBoard } from "../schedule-board";

export const metadata: Metadata = { title: "Calendario" };
export const dynamic = "force-dynamic";

/** Calendario de todos los torneos: detecta choques de sede o de equipo entre torneos. */
export default async function AdminCalendar({ searchParams }: { searchParams: Promise<{ torneo?: string }> }) {
  const { torneo } = await searchParams;
  const [tournaments, teams, venues, scheduled, live] = await Promise.all([
    listTournaments(),
    listTeams(),
    listVenues(),
    listMatches({ status: "scheduled", limit: 500 }),
    listMatches({ status: "live", limit: 50 }),
  ]);
  const matches = [...live, ...scheduled].filter((m) => !torneo || m.tournament_id === torneo);
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Calendario" title="Partidos por jugar" sub="Todos los torneos; los conflictos de sede o de equipo se marcan en rojo." />
      <nav aria-label="Torneo" className="flex flex-wrap gap-2">
        {[{ id: "", name: "Todos" }, ...tournaments.filter((t) => t.status !== "finished")].map((t) => {
          const active = (torneo ?? "") === t.id;
          return (
            <Link
              key={t.id || "todos"}
              href={t.id ? `/admin/partidos?torneo=${t.id}` : "/admin/partidos"}
              aria-current={active ? "page" : undefined}
              className={`rounded-full border-[1.5px] px-4 py-1.5 text-sm font-semibold ${active ? "border-ink bg-ink text-bg" : "border-line hover:border-ink"}`}
            >
              {t.name}
            </Link>
          );
        })}
      </nav>
      <ScheduleBoard matches={matches} teams={teams} venues={venues} />
    </div>
  );
}
