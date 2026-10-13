import Link from "next/link";
import { LiveRefresher } from "@/components/live-refresher";
import { MatchRow } from "@/components/match-row";
import { ArrowRightIcon } from "@/components/icons";
import { Badge, Card, CardHeader, Empty, Hero, LinkButton } from "@/components/ui";
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
    <div className="space-y-12">
      <LiveRefresher />
      <Hero
        eyebrow="Voleibol en Ecuador"
        title={
          <>
            Cada punto
            <br />
            en vivo
          </>
        }
        sub="Torneos, posiciones y planilla electrónica FIVB: lo que anota la mesa de control aparece aquí al instante."
        actions={
          <>
            {live[0] && (
              <LinkButton size="lg" href={`/partidos/${live[0].id}/en-vivo`}>
                Ver partido en vivo <ArrowRightIcon size={18} />
              </LinkButton>
            )}
            <LinkButton size="lg" variant={live[0] ? "inverse" : "primary"} href="#torneos">
              Ver torneos
            </LinkButton>
          </>
        }
      />

      <section id="en-vivo" className="scroll-mt-20">
        <h2 className="display-m mb-4">En vivo ahora</h2>
        <Card className="divide-y divide-line">
          {live.length ? live.map((m) => <MatchRow key={m.id} match={m} teams={teamMap} showStage />) : <Empty>No hay partidos en juego en este momento.</Empty>}
        </Card>
      </section>

      <section id="torneos" className="scroll-mt-20">
        <h2 className="display-m mb-4">Torneos</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {active.map((t) => (
            <Link key={t.id} href={`/torneos/${t.id}`}>
              <Card className="h-full p-5 transition hover:border-ink">
                <div className="flex flex-wrap gap-2">
                  <Badge tone="primary">{t.category}</Badge>
                  <Badge>{BRANCH_LABEL[t.branch]}</Badge>
                  <Badge tone={t.status === "active" ? "ok" : "neutral"}>{t.status === "active" ? "En curso" : "Finalizado"}</Badge>
                </div>
                <h3 className="mt-3 font-display text-2xl font-extrabold uppercase">{t.name}</h3>
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
