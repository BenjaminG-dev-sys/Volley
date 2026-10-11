import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LiveRefresher } from "@/components/live-refresher";
import { MatchRow } from "@/components/match-row";
import { Badge, Card, CardHeader, Empty, PageHeader, TeamDot } from "@/components/ui";
import { getTournament, listTeams } from "@/lib/data";
import { BRANCH_LABEL } from "@/lib/format";
import { computeStandings, formatRatio } from "@/lib/tournament/standings";
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

  return (
    <div className="space-y-8">
      <LiveRefresher tournamentId={id} />
      <PageHeader
        title={tournament.name}
        sub={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone="primary">{tournament.category}</Badge>
            <Badge>{BRANCH_LABEL[tournament.branch]}</Badge>
            <span>
              Temporada {tournament.season} · {entries.length} equipos · al mejor de {tournament.best_of}
            </span>
          </span>
        }
      />

      <section>
        <h2 className="mb-3 font-display text-xl font-bold">Tabla de posiciones</h2>
        <div className="grid gap-6 lg:grid-cols-2">
          {groups.map((g) => {
            const teamIds = entries.filter((e) => (e.group_label ?? "Única") === g).map((e) => e.team_id);
            const finished = groupMatches(g).filter((m) => m.status === "finished" && m.result);
            const table = computeStandings(
              teamIds,
              finished.map((m) => ({ home: m.home_team_id, away: m.away_team_id, sets: m.result!.sets, bestOf: tournament.best_of })),
            );
            return (
              <Card key={g} className="overflow-hidden">
                <CardHeader title={groups.length > 1 ? `Grupo ${g}` : "Clasificación"} sub="Puntos FIVB: 3-0/3-1 = 3 · 3-2 = 2/1" />
                <StandingsTable rows={table} teams={teamMap} qualify={tournament.format === "groups_knockout" ? 2 : 0} />
              </Card>
            );
          })}
          {!groups.length && <Empty>No hay equipos inscritos.</Empty>}
        </div>
      </section>

      {tournament.format === "groups_knockout" && (
        <section>
          <h2 className="mb-3 font-display text-xl font-bold">Fase final</h2>
          {knockout.length ? (
            <div className="grid gap-4 md:grid-cols-3">
              {(["semifinal", "third_place", "final"] as const).map((stage) => (
                <Card key={stage} className="divide-y divide-line">
                  <CardHeader title={STAGE_LABEL[stage]} />
                  {knockout.filter((m) => m.stage === stage).map((m) => (
                    <MatchRow key={m.id} match={m} teams={teamMap} />
                  ))}
                  {!knockout.some((m) => m.stage === stage) && <Empty>Por definir</Empty>}
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <Empty>Semifinales cruzadas (1.º A vs 2.º B y 1.º B vs 2.º A) al terminar la fase de grupos.</Empty>
            </Card>
          )}
        </section>
      )}

      <section>
        <h2 className="mb-3 font-display text-xl font-bold">Calendario y resultados</h2>
        <div className="space-y-4">
          {[...rounds.entries()].map(([label, ms]) => (
            <Card key={label} className="divide-y divide-line">
              <CardHeader title={label} />
              {ms.map((m) => (
                <MatchRow key={m.id} match={m} teams={teamMap} showStage />
              ))}
            </Card>
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

function StandingsTable({
  rows,
  teams,
  qualify,
}: {
  rows: ReturnType<typeof computeStandings>;
  teams: Map<string, Team>;
  qualify: number;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-surface-2 text-xs uppercase text-muted">
          <tr>
            <th className="px-3 py-2 text-left">#</th>
            <th className="px-3 py-2 text-left">Equipo</th>
            <th className="px-2 py-2" title="Partidos jugados">PJ</th>
            <th className="px-2 py-2" title="Ganados">PG</th>
            <th className="px-2 py-2" title="Perdidos">PP</th>
            <th className="px-2 py-2" title="Sets ganados:perdidos">Sets</th>
            <th className="px-2 py-2" title="Cociente de sets">C.S.</th>
            <th className="px-2 py-2" title="Cociente de puntos">C.P.</th>
            <th className="px-3 py-2">Pts</th>
          </tr>
        </thead>
        <tbody className="tabular divide-y divide-line">
          {rows.map((r, i) => {
            const t = teams.get(r.teamId);
            return (
              <tr key={r.teamId} className={i < qualify ? "bg-ok/5" : undefined}>
                <td className="px-3 py-2 text-muted">{i + 1}</td>
                <td className="px-3 py-2">
                  <span className="flex items-center gap-2">
                    <TeamDot color={t?.color_primary ?? "#999"} />
                    <span className="font-medium">{t?.short_name}</span>
                  </span>
                </td>
                <td className="px-2 py-2 text-center">{r.played}</td>
                <td className="px-2 py-2 text-center">{r.won}</td>
                <td className="px-2 py-2 text-center">{r.lost}</td>
                <td className="px-2 py-2 text-center">
                  {r.setsWon}:{r.setsLost}
                </td>
                <td className="px-2 py-2 text-center">{formatRatio(r.setRatio)}</td>
                <td className="px-2 py-2 text-center">{formatRatio(r.pointRatio)}</td>
                <td className="px-3 py-2 text-center font-display text-base font-bold">{r.points}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
