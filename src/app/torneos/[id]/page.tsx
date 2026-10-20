import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { LiveRefresher } from "@/components/live-refresher";
import { Carousel, MatchCard } from "@/components/match-card";
import { MatchRow } from "@/components/match-row";
import { StandingsTable } from "@/components/standings-table";
import { Card, Empty, Hero, LiveBadge, Section, StatNumber, TeamCrest } from "@/components/ui";
import { getTournament, listTeams } from "@/lib/data";
import { BRANCH_LABEL, BRANCH_TONE, fmtDateTime } from "@/lib/format";
import { SPORT_LABEL, describeRules, resolveRules } from "@/lib/scoresheet/rules";
import { tournamentHighlights } from "@/lib/stats/tournament";
import { recentForm } from "@/lib/tournament/form";
import { computeStandings, pointsLegend, standingsConfig } from "@/lib/tournament/standings";
import type { Match, Team } from "@/lib/types";
import { STAGE_LABEL } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { tournament } = await getTournament((await params).id);
  return { title: tournament?.name ?? "Torneo" };
}

export default async function TournamentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ tournament, entries, matches }, teams] = await Promise.all([getTournament(id), listTeams()]);
  if (!tournament) notFound();
  const teamMap = new Map(teams.map((t) => [t.id, t]));

  const groups = [...new Set(entries.map((e) => e.group_label ?? "Única"))].sort();
  const groupMatches = (g: string) =>
    matches.filter((m) => (m.stage === "group" || m.stage === "league") && (m.group_label ?? "Única") === g);
  const knockout = matches.filter((m) => ["semifinal", "third_place", "final"].includes(m.stage));

  const rounds = new Map<string, Match[]>();
  for (const m of matches) {
    const key = m.stage === "group" || m.stage === "league" ? `Jornada ${m.round ?? "-"}` : STAGE_LABEL[m.stage];
    rounds.set(key, [...(rounds.get(key) ?? []), m]);
  }

  const played = matches.filter((m) => m.status === "finished").length;
  const liveNow = matches.filter((m) => m.status === "live");
  const finished = matches.filter((m) => m.status === "finished" && m.result);
  const formInput = finished.map((m) => ({
    home: m.home_team_id,
    away: m.away_team_id,
    scheduledAt: m.scheduled_at,
    homeSets: m.result!.home_sets,
    awaySets: m.result!.away_sets,
  }));
  const form = new Map(entries.map((e) => [e.team_id, recentForm(e.team_id, formInput)]));
  const highlights = tournamentHighlights(
    finished.map((m) => ({ id: m.id, home: m.home_team_id, away: m.away_team_id, result: m.result!, bestOf: tournament.best_of })),
  );
  const tone = BRANCH_TONE[tournament.branch];
  const pointsConfig = standingsConfig(tournament.standings);
  const nav = [
    { href: "#posiciones", label: "Posiciones" },
    ...(finished.length ? [{ href: "#destacados", label: "Destacados" }] : []),
    ...(tournament.format === "groups_knockout" ? [{ href: "#fase-final", label: "Fase final" }] : []),
    { href: "#calendario", label: "Calendario" },
  ];

  return (
    <div className="space-y-14">
      <LiveRefresher tournamentId={id} />
      <Hero
        tone={tournament.color ? "team" : tone}
        color={tournament.color ?? undefined}
        image={tournament.cover_url}
        eyebrow={`${SPORT_LABEL[tournament.sport ?? "voley"]} · Temporada ${tournament.season} · ${tournament.category} · ${BRANCH_LABEL[tournament.branch]}`}
        title={tournament.name}
        sub={`${tournament.city ? `${tournament.city} · ` : ""}${tournament.format === "groups_knockout" ? "Fase de grupos y eliminatorias" : "Todos contra todos"} · ${describeRules(resolveRules(tournament.sport ?? "voley", tournament.rules, tournament.best_of)).split(" · ").slice(1).join(" · ")}`}
        aside={
          <div className="grid grid-cols-3 gap-6 lg:gap-10">
            <StatNumber value={entries.length} label="Equipos" />
            <StatNumber value={`${played}/${matches.length}`} label="Jugados" />
            <StatNumber value={liveNow.length} label="En vivo" />
          </div>
        }
      />

      <nav
        aria-label="Secciones del torneo"
        className="sticky top-[60px] z-30 -mx-4 -mt-14 flex gap-6 overflow-x-auto border-b border-line bg-bg/95 px-4 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-12 lg:px-12"
      >
        {nav.map((n) => (
          <a key={n.href} href={n.href} className="eyebrow whitespace-nowrap border-b-2 border-transparent py-4 text-ink hover:border-ink">
            {n.label}
          </a>
        ))}
      </nav>

      {liveNow.length > 0 && (
        <section>
          <p className="eyebrow mb-3 text-muted">Ahora mismo</p>
          <Carousel>
            {liveNow.map((m) => (
              <MatchCard key={m.id} match={m} teams={teamMap} />
            ))}
          </Carousel>
        </section>
      )}

      <section id="posiciones" className="scroll-mt-32">
        <SectionTitle
          eyebrow={pointsLegend(pointsConfig, tournament.best_of)}
          title="Posiciones"
        />
        <div className="grid gap-6 xl:grid-cols-2">
          {groups.map((g) => {
            const teamIds = entries.filter((e) => (e.group_label ?? "Única") === g).map((e) => e.team_id);
            const groupFinished = groupMatches(g).filter((m) => m.status === "finished" && m.result);
            const table = computeStandings(
              teamIds,
              groupFinished.map((m) => ({ home: m.home_team_id, away: m.away_team_id, sets: m.result!.sets, bestOf: tournament.best_of })),
              pointsConfig,
            );
            return (
              <Card key={g} className="overflow-hidden">
                {groups.length > 1 && (
                  <div className="flex items-baseline gap-3 px-4 pt-5">
                    <span className="eyebrow text-muted">Grupo</span>
                    <span className="font-display text-4xl font-extrabold leading-none">{g}</span>
                  </div>
                )}
                <StandingsTable rows={table} teams={teamMap} qualify={tournament.format === "groups_knockout" ? 2 : 0} form={form} />
              </Card>
            );
          })}
          {!groups.length && (
            <Card>
              <Empty>No hay equipos inscritos.</Empty>
            </Card>
          )}
        </div>
      </section>

      {highlights.matches > 0 && (
        <section id="destacados" className="scroll-mt-32">
          <SectionTitle eyebrow="Con los resultados cerrados" title="Destacados" />
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            <StatNumber value={highlights.matches} label="Partidos jugados" />
            <StatNumber value={highlights.sets} label="Sets" />
            <StatNumber value={highlights.points.toLocaleString("es-EC")} label="Puntos" />
            <StatNumber value={highlights.decidingSets} label="Al set decisivo" />
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {highlights.longestSet && (
              <HighlightCard
                label={`Set más largo · set ${highlights.longestSet.set}`}
                value={`${highlights.longestSet.score.home}-${highlights.longestSet.score.away}`}
                detail={`${teamMap.get(highlights.longestSet.home)?.short_name ?? "—"} vs ${teamMap.get(highlights.longestSet.away)?.short_name ?? "—"}`}
                href={`/partidos/${highlights.longestSet.matchId}/planilla`}
              />
            )}
            {highlights.bestAttack && (
              <HighlightCard
                label="Mejor ataque"
                value={highlights.bestAttack.perSet.toFixed(1)}
                detail={`${teamMap.get(highlights.bestAttack.teamId)?.short_name ?? "—"} · puntos anotados por set`}
                href={`/equipos/${highlights.bestAttack.teamId}`}
              />
            )}
            {highlights.bestDefense && (
              <HighlightCard
                label="Mejor defensa"
                value={highlights.bestDefense.perSet.toFixed(1)}
                detail={`${teamMap.get(highlights.bestDefense.teamId)?.short_name ?? "—"} · puntos recibidos por set`}
                href={`/equipos/${highlights.bestDefense.teamId}`}
              />
            )}
          </div>
        </section>
      )}

      {tournament.format === "groups_knockout" && (
        <Section tone="ink">
          <div id="fase-final" className="scroll-mt-32" />
          <p className="eyebrow mb-3 text-white/60">Eliminatorias</p>
          <h2 className="display-l mb-8">Fase final</h2>
          {knockout.length ? (
            <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
              <div className="space-y-3">
                <p className="eyebrow text-white/60">{STAGE_LABEL.semifinal}</p>
                {knockout
                  .filter((m) => m.stage === "semifinal")
                  .map((m) => (
                    <BracketMatch key={m.id} match={m} teams={teamMap} />
                  ))}
              </div>
              <div className="space-y-3">
                {(["final", "third_place"] as const).map((stage) => (
                  <div key={stage} className="space-y-3">
                    <p className={stage === "final" ? "eyebrow text-volt" : "eyebrow text-white/60"}>{STAGE_LABEL[stage]}</p>
                    {knockout.filter((m) => m.stage === stage).map((m) => (
                      <BracketMatch key={m.id} match={m} teams={teamMap} highlight={stage === "final"} />
                    ))}
                    {!knockout.some((m) => m.stage === stage) && <p className="rounded-xl border border-dashed border-white/20 p-4 text-sm text-white/60">Por definir</p>}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="max-w-xl text-white/70">Semifinales cruzadas (1.º A vs 2.º B y 1.º B vs 2.º A) al terminar la fase de grupos.</p>
          )}
        </Section>
      )}

      <section id="calendario" className="scroll-mt-32">
        <SectionTitle eyebrow={`${matches.length} partidos`} title="Calendario y resultados" />
        <div className="space-y-8">
          {[...rounds.entries()].map(([label, ms]) => (
            <div key={label}>
              <h3 className="mb-3 font-display text-2xl font-extrabold uppercase">{label}</h3>
              <Card className="divide-y divide-line overflow-hidden">
                {ms.map((m) => (
                  <MatchRow key={m.id} match={m} teams={teamMap} showStage />
                ))}
              </Card>
            </div>
          ))}
          {!rounds.size && (
            <Card>
              <Empty>El calendario aún no se ha generado.</Empty>
            </Card>
          )}
        </div>
      </section>
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

function HighlightCard({ label, value, detail, href }: { label: string; value: string; detail: string; href: string }) {
  return (
    <Link href={href} className="group rounded-2xl border border-line p-5 transition hover:border-ink">
      <p className="eyebrow text-muted">{label}</p>
      <p className="tabular mt-2 font-display text-5xl font-extrabold leading-none">{value}</p>
      <p className="mt-2 text-sm text-muted group-hover:text-ink">{detail} →</p>
    </Link>
  );
}

/** Cruce de la fase final sobre fondo negro. */
function BracketMatch({ match, teams, highlight }: { match: Match; teams: Map<string, Team>; highlight?: boolean }) {
  const href = match.status === "finished" ? `/partidos/${match.id}/planilla` : `/partidos/${match.id}/en-vivo`;
  const sets = (side: "A" | "B") =>
    match.status === "live" ? match.live_state?.setsWon[side] : side === "A" ? match.result?.home_sets : match.result?.away_sets;
  const line = (teamId: string, side: "A" | "B") => {
    const t = teams.get(teamId);
    const lost = match.status === "finished" && match.winner_team_id !== teamId;
    return (
      <div className={`flex items-center gap-3 ${lost ? "opacity-50" : ""}`}>
        <TeamCrest name={t?.name ?? "—"} color={t?.color_primary ?? "#999"} logo={t?.logo_url} size="sm" />
        <span className="flex-1 truncate font-display text-xl font-bold uppercase">{t?.short_name ?? "—"}</span>
        {match.status !== "scheduled" && <span className="tabular font-display text-3xl font-extrabold">{sets(side) ?? 0}</span>}
      </div>
    );
  };
  return (
    <Link
      href={href}
      className={`block space-y-3 rounded-2xl p-4 transition ${highlight ? "bg-volt text-black" : "bg-white/5 ring-1 ring-white/10 hover:ring-white/40"}`}
    >
      <div className="flex justify-between text-xs">
        {match.status === "live" ? <LiveBadge /> : <span className="eyebrow opacity-70">{fmtDateTime(match.scheduled_at)}</span>}
      </div>
      {line(match.home_team_id, "A")}
      {line(match.away_team_id, "B")}
    </Link>
  );
}
