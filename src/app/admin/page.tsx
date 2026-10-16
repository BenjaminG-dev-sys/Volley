import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRightIcon } from "@/components/icons";
import { MatchRow } from "@/components/match-row";
import { Card, CardHeader, Empty, LinkButton, PageHeader, StatNumber, cx } from "@/components/ui";
import { conflictedIds, detectConflicts } from "@/lib/admin/conflicts";
import { listMatches, listTeams, listTournaments } from "@/lib/data";
import { serverClient } from "@/lib/insforge/server";
import { ROSTER_LIMITS, resolveRules } from "@/lib/scoresheet/rules";
import type { Match } from "@/lib/types";

export const metadata: Metadata = { title: "Panel" };
export const dynamic = "force-dynamic";

const ectDay = (d: Date) => new Date(d.getTime() - 5 * 3600_000).toISOString().slice(0, 10);

export default async function AdminDashboard() {
  const db = (await serverClient()).database;
  const [tournaments, teams, scheduled, live, playersRes] = await Promise.all([
    listTournaments(),
    listTeams(),
    listMatches({ status: "scheduled", limit: 500 }),
    listMatches({ status: "live", limit: 50 }),
    db.from("players").select("team_id").limit(10000),
  ]);
  const teamMap = new Map(teams.map((t) => [t.id, t]));
  const now = Date.now();
  const today = ectDay(new Date());
  const soon = scheduled.filter((m) => m.scheduled_at && Date.parse(m.scheduled_at) - now < 14 * 86400_000);
  const todays = [...live, ...scheduled.filter((m) => m.scheduled_at && ectDay(new Date(m.scheduled_at)) === today)];
  const noScorer = soon.filter((m) => !m.scorer_id);
  const noReferee = soon.filter((m) => !m.referee_1);
  const conflicts = detectConflicts(soon);
  const conflicted = conflictedIds(conflicts);

  // Nóminas que no alcanzan para jugar (menos titulares que jugadores en cancha).
  const counts = new Map<string, number>();
  for (const p of (playersRes.data ?? []) as { team_id: string }[]) counts.set(p.team_id, (counts.get(p.team_id) ?? 0) + 1);
  const shortRosters = teams.filter((t) => (counts.get(t.id) ?? 0) < resolveRules(t.sport ?? "voley").playersOnCourt);
  const drafts = tournaments.filter((t) => t.status === "draft");

  const alerts: { label: string; detail: string; href: string; tone: "live" | "accent" }[] = [
    ...(conflicts.length
      ? [{ label: `${conflicted.size} partidos con conflicto de horario`, detail: "Un equipo o una sede tiene dos partidos a la vez.", href: "/admin/partidos", tone: "live" as const }]
      : []),
    ...(noScorer.length
      ? [{ label: `${noScorer.length} partidos sin planillero`, detail: "En los próximos 14 días.", href: noScorer[0] ? `/admin/torneos/${noScorer[0].tournament_id}?tab=partidos` : "/admin/torneos", tone: "accent" as const }]
      : []),
    ...(noReferee.length
      ? [{ label: `${noReferee.length} partidos sin árbitro`, detail: "Asígnalos por jornada desde cada torneo.", href: noReferee[0] ? `/admin/torneos/${noReferee[0].tournament_id}?tab=partidos` : "/admin/arbitros", tone: "accent" as const }]
      : []),
    ...shortRosters.slice(0, 5).map((t) => ({
      label: `Nómina incompleta: ${t.short_name}`,
      detail: `${counts.get(t.id) ?? 0} de ${ROSTER_LIMITS[t.sport ?? "voley"].players} jugadores registrados.`,
      href: `/admin/equipos/${t.id}`,
      tone: "accent" as const,
    })),
    ...drafts.map((t) => ({ label: `Torneo en borrador: ${t.name}`, detail: "Publícalo cuando el calendario esté listo.", href: `/admin/torneos/${t.id}`, tone: "accent" as const })),
  ];

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Panel"
        title="Hoy en la liga"
        action={
          <div className="flex flex-wrap gap-2">
            <LinkButton href="/admin/torneos/nuevo">Nuevo torneo</LinkButton>
            <LinkButton variant="secondary" href="/admin/equipos">
              Nuevo equipo
            </LinkButton>
          </div>
        }
      />
      <section className="grid grid-cols-2 gap-6 sm:grid-cols-4">
        <StatNumber value={todays.length} label="Partidos hoy" />
        <StatNumber value={live.length} label="En vivo" />
        <StatNumber value={noScorer.length} label="Sin planillero (14 días)" />
        <StatNumber value={shortRosters.length} label="Nóminas incompletas" />
      </section>

      <div className="grid gap-6 xl:grid-cols-[3fr_2fr]">
        <Card className="divide-y divide-line overflow-hidden">
          <CardHeader title="Partidos de hoy" action={<Link href="/admin/partidos" className="text-sm font-medium hover:underline">Calendario →</Link>} />
          {todays.length ? todays.map((m: Match) => <MatchRow key={m.id} match={m} teams={teamMap} showStage />) : <Empty>No hay partidos hoy.</Empty>}
        </Card>
        <Card className="overflow-hidden">
          <CardHeader title="Pendientes" sub={alerts.length ? `${alerts.length} por revisar` : "Todo en orden"} />
          <ul className="divide-y divide-line">
            {alerts.map((a, i) => (
              <li key={i}>
                <Link href={a.href} className="flex items-start gap-3 px-4 py-3 hover:bg-surface-2">
                  <span className={cx("mt-1.5 h-2 w-2 shrink-0 rounded-full", a.tone === "live" ? "bg-live" : "bg-sun")} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{a.label}</span>
                    <span className="block text-xs text-muted">{a.detail}</span>
                  </span>
                  <ArrowRightIcon size={16} className="mt-1 text-muted" />
                </Link>
              </li>
            ))}
            {!alerts.length && <Empty>No hay pendientes.</Empty>}
          </ul>
        </Card>
      </div>
    </div>
  );
}
