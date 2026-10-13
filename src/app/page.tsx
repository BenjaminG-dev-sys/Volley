import Link from "next/link";
import { ArrowRightIcon } from "@/components/icons";
import { LiveRefresher } from "@/components/live-refresher";
import { Carousel, MatchCard } from "@/components/match-card";
import { MatchRow } from "@/components/match-row";
import { ResultsMarquee } from "@/components/results-marquee";
import { Badge, Card, CardHeader, Empty, Hero, LinkButton, LiveBadge, Section, TeamCrest } from "@/components/ui";
import { listMatches, listTeams, listTournaments } from "@/lib/data";
import { teamVars } from "@/lib/color";
import { BRANCH_LABEL, BRANCH_TONE } from "@/lib/format";
import type { Match, Team, Tournament } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [tournaments, teams, live, upcoming, recent] = await Promise.all([
    listTournaments(),
    listTeams(),
    listMatches({ status: "live", limit: 10 }),
    listMatches({ status: "scheduled", limit: 8 }),
    listMatches({ status: "finished", limit: 8 }),
  ]);
  const teamMap = new Map(teams.map((t) => [t.id, t]));
  const active = tournaments.filter((t) => t.status !== "draft");
  const featured = live[0] ?? upcoming[0] ?? null;

  return (
    <div className="space-y-14">
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
        aside={featured && <FeaturedMatch match={featured} teams={teamMap} />}
      />

      {(live.length > 0 || recent.length > 0) && (
        <div className="-mt-14">
          <ResultsMarquee matches={[...live, ...recent]} teams={teamMap} />
        </div>
      )}

      <section id="en-vivo" className="scroll-mt-20">
        <SectionTitle eyebrow="Ahora mismo" title={live.length ? "En vivo" : "Próximos partidos"} />
        {live.length || upcoming.length ? (
          <Carousel>
            {(live.length ? [...live, ...upcoming] : upcoming).map((m) => (
              <MatchCard key={m.id} match={m} teams={teamMap} />
            ))}
          </Carousel>
        ) : (
          <Card>
            <Empty>No hay partidos en juego ni programados.</Empty>
          </Card>
        )}
      </section>

      <Section tone="sky" className="scroll-mt-20">
        <div id="torneos" className="scroll-mt-24" />
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow mb-3 opacity-80">Temporada en curso</p>
            <h2 className="display-l">Torneos</h2>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {active.map((t) => (
            <TournamentTile key={t.id} t={t} />
          ))}
          {!active.length && <p className="opacity-80">Aún no hay torneos publicados.</p>}
        </div>
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="divide-y divide-line overflow-hidden">
          <CardHeader title="Calendario" sub="Próximos partidos" />
          {upcoming.length ? upcoming.slice(0, 6).map((m) => <MatchRow key={m.id} match={m} teams={teamMap} showStage />) : <Empty>Sin partidos programados.</Empty>}
        </Card>
        <Card className="divide-y divide-line overflow-hidden">
          <CardHeader title="Resultados" sub="Últimos partidos cerrados" />
          {recent.length ? recent.slice(0, 6).map((m) => <MatchRow key={m.id} match={m} teams={teamMap} showStage />) : <Empty>Sin resultados todavía.</Empty>}
        </Card>
      </div>

      {teams.length > 0 && (
        <section>
          <SectionTitle eyebrow={`${teams.length} clubes`} title="Equipos" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {teams.slice(0, 8).map((t) => (
              <TeamTile key={t.id} team={t} />
            ))}
          </div>
        </section>
      )}

      <Section tone="sun">
        <div className="grid items-end gap-8 lg:grid-cols-[1fr_auto]">
          <div>
            <p className="eyebrow mb-3">Para ligas y asociaciones</p>
            <h2 className="display-l max-w-3xl">Lleva la planilla de tu liga al celular</h2>
            <p className="mt-4 max-w-xl text-lg">
              Reglas FIVB, funciona sin conexión y el marcador llega en vivo a la pantalla grande y a los teléfonos del público.
            </p>
          </div>
          <LinkButton size="lg" href="/ingresar">
            Ingresar a la mesa <ArrowRightIcon size={18} />
          </LinkButton>
        </div>
      </Section>
    </div>
  );
}

function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="mb-6">
      <p className="eyebrow mb-2 text-muted">{eyebrow}</p>
      <h2 className="display-l">{title}</h2>
    </div>
  );
}

/** Marcador destacado en el héroe: partido en vivo o el próximo. */
function FeaturedMatch({ match, teams }: { match: Match; teams: Map<string, Team> }) {
  const home = teams.get(match.home_team_id);
  const away = teams.get(match.away_team_id);
  const ls = match.status === "live" ? match.live_state : null;
  const row = (t: Team | undefined, sets?: number, points?: number) => (
    <div className="flex items-center gap-4">
      <TeamCrest name={t?.name ?? "—"} color={t?.color_primary ?? "#999"} logo={t?.logo_url} size="md" />
      <span className="flex-1 truncate font-display text-2xl font-extrabold uppercase">{t?.short_name ?? "—"}</span>
      {ls && (
        <>
          <span className="tabular font-display text-2xl font-bold text-white/50">{sets}</span>
          <span className="tabular w-14 text-right font-display text-5xl font-extrabold leading-none">{points}</span>
        </>
      )}
    </div>
  );
  return (
    <Link
      href={`/partidos/${match.id}/en-vivo`}
      className="reveal block w-full rounded-2xl bg-black p-6 text-paper ring-1 ring-white/10 transition hover:ring-volt lg:w-[400px]"
    >
      <div className="mb-5 flex items-center justify-between text-xs">
        {ls ? <LiveBadge /> : <span className="eyebrow text-white/60">Próximo partido</span>}
        {ls && <span className="eyebrow text-volt">Set {ls.currentSet}</span>}
      </div>
      <div className="space-y-4">
        {row(home, ls?.setsWon.A, ls?.score.A)}
        {row(away, ls?.setsWon.B, ls?.score.B)}
      </div>
      <p className="eyebrow mt-6 flex items-center gap-2 text-white/70">
        {ls ? "Abrir marcador" : "Ver previa"} <ArrowRightIcon size={14} />
      </p>
    </Link>
  );
}

function TournamentTile({ t }: { t: Tournament }) {
  const tone = BRANCH_TONE[t.branch];
  const bg = { rose: "bg-rose text-black", sky: "bg-paper text-black", sun: "bg-sun text-black" }[tone];
  return (
    <Link href={`/torneos/${t.id}`} className={`group flex min-h-56 flex-col justify-between rounded-2xl p-6 transition hover:-translate-y-0.5 ${bg}`}>
      <div className="flex flex-wrap gap-2">
        <Badge tone="primary">{t.category}</Badge>
        <span className="eyebrow">{BRANCH_LABEL[t.branch]}</span>
        <span className="eyebrow ml-auto">{t.status === "active" ? "En curso" : "Finalizado"}</span>
      </div>
      <div>
        <h3 className="display-m">{t.name}</h3>
        <p className="mt-2 flex items-center justify-between text-sm">
          <span>
            Temporada {t.season}
            {t.city ? ` · ${t.city}` : ""} · al mejor de {t.best_of}
          </span>
          <ArrowRightIcon className="transition group-hover:translate-x-1" />
        </p>
      </div>
    </Link>
  );
}

/** Tarjeta de equipo tipo "producto": bloque del color del club con su sigla gigante. */
function TeamTile({ team }: { team: Team }) {
  return (
    <div
      className="group relative flex aspect-[4/5] flex-col justify-between overflow-hidden rounded-2xl bg-team p-4 text-team-ink"
      style={teamVars(team.color_primary) as React.CSSProperties}
    >
      <TeamCrestInk team={team} />
      <span className="img-hover pointer-events-none absolute -right-3 top-6 font-display text-[7rem] font-extrabold uppercase leading-none opacity-15 sm:text-[9rem]" aria-hidden>
        {team.short_name.slice(0, 3)}
      </span>
      <div className="relative">
        <p className="font-display text-2xl font-extrabold uppercase leading-none">{team.short_name}</p>
        <p className="mt-1 truncate text-sm opacity-80">{team.name}</p>
        {team.city && <p className="eyebrow mt-2 opacity-70">{team.city}</p>}
      </div>
    </div>
  );
}

function TeamCrestInk({ team }: { team: Team }) {
  return <TeamCrest name={team.name} color={team.color_secondary || "#ffffff"} logo={team.logo_url} size="md" className="ring-2 ring-white/40" />;
}
