import Link from "next/link";
import { LiveRefresher } from "@/components/live-refresher";
import { MatchRow } from "@/components/match-row";
import { Badge, Card, CardHeader, Empty } from "@/components/ui";
import { listMatches, listTeams, listTournaments } from "@/lib/data";
import { BRANCH_LABEL } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [tournaments, teams, live, upcoming, recent] = await Promise.all([
    listTournaments(),
    listTeams(),
    listMatches({ status: "live", limit: 10 }),
    listMatches({ status: "scheduled", limit: 6 }),
    listMatches({ status: "finished", limit: 6 }),
  ]);
  const teamMap = new Map(teams.map((t) => [t.id, t]));
  const active = tournaments.filter((t) => t.status !== "draft");

  return (
    <div className="space-y-8">
      <LiveRefresher />
      <section className="overflow-hidden rounded-2xl bg-primary px-6 py-8 text-primary-contrast sm:px-10 sm:py-10">
        <p className="text-sm font-medium uppercase tracking-widest opacity-80">Voleibol en Ecuador</p>
        <h1 className="mt-2 max-w-2xl font-display text-3xl font-bold leading-tight sm:text-5xl">
          Torneos, posiciones y marcador en vivo desde la mesa de control
        </h1>
        <p className="mt-3 max-w-xl opacity-85">
          Planilla electrónica con reglas FIVB: cada punto que anota el planillero aparece aquí al instante.
        </p>
      </section>

      <section>
        <h2 className="mb-3 font-display text-xl font-bold">En vivo ahora</h2>
        <Card className="divide-y divide-line">
          {live.length ? live.map((m) => <MatchRow key={m.id} match={m} teams={teamMap} showStage />) : <Empty>No hay partidos en juego en este momento.</Empty>}
        </Card>
      </section>

      <section>
        <h2 className="mb-3 font-display text-xl font-bold">Torneos</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {active.map((t) => (
            <Link key={t.id} href={`/torneos/${t.id}`}>
              <Card className="h-full p-5 transition hover:border-primary">
                <div className="flex flex-wrap gap-2">
                  <Badge tone="primary">{t.category}</Badge>
                  <Badge>{BRANCH_LABEL[t.branch]}</Badge>
                  <Badge tone={t.status === "active" ? "ok" : "neutral"}>{t.status === "active" ? "En curso" : "Finalizado"}</Badge>
                </div>
                <h3 className="mt-3 font-display text-xl font-bold">{t.name}</h3>
                <p className="text-sm text-muted">
                  Temporada {t.season}
                  {t.city ? ` · ${t.city}` : ""} · al mejor de {t.best_of} sets
                </p>
              </Card>
            </Link>
          ))}
          {!active.length && <Empty>Aún no hay torneos publicados.</Empty>}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="divide-y divide-line">
          <CardHeader title="Próximos partidos" />
          {upcoming.length ? upcoming.map((m) => <MatchRow key={m.id} match={m} teams={teamMap} showStage />) : <Empty>Sin partidos programados.</Empty>}
        </Card>
        <Card className="divide-y divide-line">
          <CardHeader title="Resultados recientes" />
          {recent.length ? recent.map((m) => <MatchRow key={m.id} match={m} teams={teamMap} showStage />) : <Empty>Sin resultados todavía.</Empty>}
        </Card>
      </div>
    </div>
  );
}
