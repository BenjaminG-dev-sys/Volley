import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { positionLabel } from "@/components/team-tile";
import { Card, CardHeader, Empty, Hero, StatNumber, TeamCrest, cx } from "@/components/ui";
import { getPlayerProfile } from "@/lib/data";
import { fmtDayShort } from "@/lib/format";
import { SPORT_LABEL } from "@/lib/scoresheet/rules";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const p = await getPlayerProfile((await params).id, 1);
  return { title: p ? `${p.player.first_name} ${p.player.last_name}` : "Jugador" };
}

export default async function PlayerProfile({ params }: { params: Promise<{ id: string }> }) {
  const profile = await getPlayerProfile((await params).id);
  if (!profile) notFound();
  const { player, team, teams, appearances, perMatch } = profile;
  const teamMap = new Map(teams.map((t) => [t.id, t]));
  const position = positionLabel(player.is_libero ? "libero" : player.position);
  const age = player.birth_year ? new Date().getFullYear() - player.birth_year : null;

  return (
    <div className="space-y-12">
      <Hero
        tone="team"
        color={team.color_primary}
        eyebrow={[team.short_name, position !== "—" && position, player.is_captain && "Capitán(a)"].filter(Boolean).join(" · ")}
        title={
          <>
            {player.first_name}
            <br />
            {player.last_name}
          </>
        }
        aside={
          <div className="flex items-end gap-3">
            <span className="eyebrow mb-4 opacity-70">N.º</span>
            <span className="tabular font-display text-[9rem] font-extrabold leading-[0.8] sm:text-[13rem]">{player.number}</span>
          </div>
        }
      />

      <section className="grid grid-cols-2 gap-6 sm:grid-cols-4">
        <StatNumber value={appearances.matches} label="Partidos" />
        <StatNumber value={appearances.sets} label="Sets jugados" />
        <StatNumber value={appearances.starts} label="Sets de titular" />
        <StatNumber value={appearances.subIns} label="Ingresos" />
      </section>
      <p className="-mt-8 text-xs text-muted">Según las planillas de los últimos {perMatch.length} partidos de su equipo.</p>

      <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
        <Card className="p-5">
          <h2 className="mb-4 font-display text-lg font-bold uppercase tracking-wide">Ficha</h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
            <dt className="text-muted">Equipo</dt>
            <dd>
              <Link href={`/equipos/${team.id}`} className="flex items-center gap-2 font-semibold hover:underline">
                <TeamCrest name={team.name} color={team.color_primary} logo={team.logo_url} size="sm" /> {team.name}
              </Link>
            </dd>
            <dt className="text-muted">Deporte</dt>
            <dd>{SPORT_LABEL[team.sport ?? "voley"]}</dd>
            <dt className="text-muted">Posición</dt>
            <dd>{position}</dd>
            <dt className="text-muted">Número</dt>
            <dd className="tabular">{player.number}</dd>
            <dt className="text-muted">Año de nacimiento</dt>
            <dd className="tabular">
              {player.birth_year}
              {age !== null ? ` (${age} años en ${new Date().getFullYear()})` : ""}
            </dd>
          </dl>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader title="Últimos partidos" sub="Sets en los que estuvo en cancha" />
          {perMatch.length ? (
            <ul className="divide-y divide-line">
              {perMatch.map(({ match: m, sets }) => {
                const rivalId = m.home_team_id === team.id ? m.away_team_id : m.home_team_id;
                const rival = teamMap.get(rivalId);
                const home = m.home_team_id === team.id;
                const mine = home ? (m.result?.home_sets ?? m.live_state?.setsWon.A) : (m.result?.away_sets ?? m.live_state?.setsWon.B);
                const theirs = home ? (m.result?.away_sets ?? m.live_state?.setsWon.B) : (m.result?.home_sets ?? m.live_state?.setsWon.A);
                const won = m.status === "finished" && m.winner_team_id === team.id;
                return (
                  <li key={m.id}>
                    <Link
                      href={m.status === "finished" ? `/partidos/${m.id}/planilla` : `/partidos/${m.id}/en-vivo`}
                      className="grid grid-cols-[4.5rem_1fr_auto_auto] items-center gap-4 px-4 py-3 text-sm hover:bg-surface-2 sm:px-5"
                    >
                      <span className="text-xs font-semibold uppercase">{fmtDayShort(m.scheduled_at)}</span>
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="text-muted">{home ? "vs" : "en"}</span>
                        <TeamCrest name={rival?.name ?? "—"} color={rival?.color_primary ?? "#999"} logo={rival?.logo_url} size="sm" />
                        <span className="truncate font-medium">{rival?.short_name ?? "—"}</span>
                      </span>
                      <span
                        className={cx(
                          "tabular rounded-sm px-2 py-0.5 font-display text-base font-bold",
                          m.status === "live" ? "bg-black text-volt" : won ? "bg-ink text-bg" : "bg-surface-2",
                        )}
                      >
                        {mine ?? 0}-{theirs ?? 0}
                      </span>
                      <span className={cx("w-16 text-right text-xs", sets ? "font-semibold" : "text-muted")}>
                        {sets ? `${sets} set${sets === 1 ? "" : "s"}` : "No jugó"}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <Empty>Su equipo aún no ha jugado.</Empty>
          )}
        </Card>
      </div>
    </div>
  );
}
