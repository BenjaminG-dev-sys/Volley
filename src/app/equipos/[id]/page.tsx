import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { ArrowRightIcon } from "@/components/icons";
import { LiveRefresher } from "@/components/live-refresher";
import { Carousel, MatchCard } from "@/components/match-card";
import { MatchRow } from "@/components/match-row";
import { PlayerTile } from "@/components/team-tile";
import { Card, CardHeader, Empty, Hero, StatNumber, TeamCrest, cx } from "@/components/ui";
import { teamVars } from "@/lib/color";
import { getTeamBundle } from "@/lib/data";
import { BRANCH_LABEL } from "@/lib/format";
import { SPORT_LABEL } from "@/lib/scoresheet/rules";
import { recentForm } from "@/lib/tournament/form";
import { computeStandings, standingsConfig } from "@/lib/tournament/standings";
import { STAGE_LABEL } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const b = await getTeamBundle((await params).id);
  return { title: b?.team.name ?? "Equipo" };
}

export default async function TeamProfile({ params }: { params: Promise<{ id: string }> }) {
  const b = await getTeamBundle((await params).id);
  if (!b) notFound();
  const { team, players, matches, teams, tournaments, entries, tournamentEntries, tournamentMatches } = b;
  const teamMap = new Map(teams.concat(team).map((t) => [t.id, t]));
  const finished = matches.filter((m) => m.status === "finished" && m.result);
  const won = finished.filter((m) => m.winner_team_id === team.id).length;
  const live = matches.filter((m) => m.status === "live");
  const upcoming = matches.filter((m) => m.status === "scheduled");
  const results = [...finished].reverse();
  const form = recentForm(
    team.id,
    finished.map((m) => ({ home: m.home_team_id, away: m.away_team_id, scheduledAt: m.scheduled_at, homeSets: m.result!.home_sets, awaySets: m.result!.away_sets })),
  );

  // Posición del equipo en cada torneo (en su grupo, si hay grupos).
  const standings = entries.map((entry) => {
    const t = tournaments.find((x) => x.id === entry.tournament_id);
    if (!t) return null;
    const group = entry.group_label;
    const ids = tournamentEntries.filter((e) => e.tournament_id === t.id && e.group_label === group).map((e) => e.team_id);
    const table = computeStandings(
      ids,
      tournamentMatches
        .filter((m) => m.tournament_id === t.id && (m.stage === "group" || m.stage === "league") && m.result)
        .map((m) => ({ home: m.home_team_id, away: m.away_team_id, sets: m.result!.sets, bestOf: t.best_of })),
      standingsConfig(t.standings),
    );
    const pos = table.findIndex((r) => r.teamId === team.id);
    return { t, group, pos: pos + 1, size: table.length, row: table[pos] };
  });

  const nav = [
    { href: "#nomina", label: "Nómina" },
    { href: "#partidos", label: "Partidos" },
    { href: "#torneos", label: "Torneos" },
  ];

  return (
    <div className="space-y-14">
      {live.length > 0 && <LiveRefresher />}
      <Hero
        tone="team"
        color={team.color_primary}
        image={team.cover_url}
        eyebrow={`${SPORT_LABEL[team.sport ?? "voley"]}${team.city ? ` · ${team.city}` : ""}${team.province ? `, ${team.province}` : ""}`}
        title={team.short_name}
        sub={team.name}
        aside={
          <div className="flex flex-col items-start gap-6 lg:items-end">
            <TeamCrest name={team.name} color={team.color_secondary || "#ffffff"} logo={team.logo_url} size="lg" className="ring-4 ring-white/30" />
            <div className="grid grid-cols-3 gap-6 lg:gap-10">
              <StatNumber value={finished.length} label="Jugados" />
              <StatNumber value={won} label="Ganados" />
              <StatNumber value={players.length} label="Jugadores" />
            </div>
          </div>
        }
      />

      <nav
        aria-label="Secciones del equipo"
        className="sticky top-[60px] z-30 -mx-4 -mt-14 flex gap-6 overflow-x-auto border-b border-line bg-bg/95 px-4 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-12 lg:px-12"
      >
        {nav.map((n) => (
          <a key={n.href} href={n.href} className="eyebrow whitespace-nowrap border-b-2 border-transparent py-4 text-ink hover:border-ink">
            {n.label}
          </a>
        ))}
        {form.length > 0 && (
          <span className="ml-auto flex items-center gap-1 py-3" title="Últimos resultados">
            {form.map((f, i) => (
              <span key={i} className={cx("grid h-6 w-6 place-items-center rounded-sm text-[11px] font-bold", f === "G" ? "bg-ink text-bg" : "bg-surface-2 text-muted")}>
                {f}
              </span>
            ))}
          </span>
        )}
      </nav>

      {(live.length > 0 || upcoming.length > 0) && (
        <section>
          <p className="eyebrow mb-3 text-muted">{live.length ? "Ahora mismo" : "Próximo partido"}</p>
          <Carousel>
            {[...live, ...upcoming].slice(0, 6).map((m) => (
              <MatchCard key={m.id} match={m} teams={teamMap} />
            ))}
          </Carousel>
        </section>
      )}

      <section id="nomina" className="scroll-mt-32" style={teamVars(team.color_primary) as CSSProperties}>
        <div className="mb-6">
          <p className="eyebrow mb-2 text-muted">{players.length} jugadores</p>
          <h2 className="display-l">Nómina</h2>
        </div>
        {players.length ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {players.map((p) => (
              <PlayerTile key={p.id} player={p} />
            ))}
          </div>
        ) : (
          <Card>
            <Empty>La nómina aún no está registrada.</Empty>
          </Card>
        )}
      </section>

      <section id="partidos" className="scroll-mt-32">
        <div className="mb-6">
          <p className="eyebrow mb-2 text-muted">{matches.length} partidos</p>
          <h2 className="display-l">Partidos</h2>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="divide-y divide-line overflow-hidden">
            <CardHeader title="Calendario" />
            {upcoming.length ? upcoming.map((m) => <MatchRow key={m.id} match={m} teams={teamMap} showStage />) : <Empty>Sin partidos programados.</Empty>}
          </Card>
          <Card className="divide-y divide-line overflow-hidden">
            <CardHeader title="Resultados" />
            {results.length ? results.map((m) => <MatchRow key={m.id} match={m} teams={teamMap} showStage />) : <Empty>Sin resultados todavía.</Empty>}
          </Card>
        </div>
      </section>

      <section id="torneos" className="scroll-mt-32">
        <div className="mb-6">
          <p className="eyebrow mb-2 text-muted">Inscripciones</p>
          <h2 className="display-l">Torneos</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {standings.map(
            (s) =>
              s && (
                <Link key={s.t.id} href={`/torneos/${s.t.id}`} className="group flex min-w-0 items-center gap-4 rounded-2xl border border-line p-5 transition hover:border-ink sm:gap-6">
                  <div className="text-center">
                    <div className="font-display text-6xl font-extrabold leading-none">{s.pos > 0 ? s.pos : "–"}</div>
                    <div className="eyebrow mt-1 text-muted">de {s.size}</div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="eyebrow text-muted">
                      {SPORT_LABEL[s.t.sport ?? "voley"]} · {s.t.category} · {BRANCH_LABEL[s.t.branch]}
                    </p>
                    <p className="truncate font-display text-2xl font-extrabold uppercase">{s.t.name}</p>
                    <p className="text-sm text-muted">
                      {s.group ? `${STAGE_LABEL.group} ${s.group} · ` : ""}
                      {s.row ? `${s.row.points} pts · ${s.row.won}G ${s.row.lost}P` : "Sin partidos jugados"}
                    </p>
                  </div>
                  <ArrowRightIcon className="transition group-hover:translate-x-1" />
                </Link>
              ),
          )}
          {!standings.length && (
            <Card>
              <Empty>No está inscrito en torneos.</Empty>
            </Card>
          )}
        </div>
      </section>
    </div>
  );
}
