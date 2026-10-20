import "server-only";

import { serverClient } from "@/lib/insforge/server";
import { buildSetup, rowToEvent } from "@/lib/match";
import { replay } from "@/lib/scoresheet";
import { addAppearances, emptyAppearances } from "@/lib/stats/appearances";
import type { Match, MatchEventRow, PlayerPublic, Team, Tournament, TournamentTeam, Venue } from "@/lib/types";

async function run<T>(p: PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return data as T;
}

const MATCH_COLS =
  "id, tournament_id, stage, group_label, round, home_team_id, away_team_id, venue_id, scheduled_at, status, scorer_id, referee_1, referee_2, live_state, result, winner_team_id, updated_at";

export async function listTournaments() {
  const db = (await serverClient()).database;
  return run<Tournament[]>(db.from("tournaments").select("*").order("created_at", { ascending: false }).limit(50));
}

export async function listTeams() {
  const db = (await serverClient()).database;
  return run<Team[]>(db.from("teams").select("*").order("name").limit(200));
}

export async function listVenues() {
  const db = (await serverClient()).database;
  return run<Venue[]>(db.from("venues").select("*").order("name").limit(100));
}

export async function listMatches(filter: {
  status?: Match["status"];
  tournamentId?: string;
  /** Solo partidos de estos torneos (p. ej. los de un deporte). */
  tournamentIds?: string[];
  scorerId?: string;
  limit?: number;
}) {
  if (filter.tournamentIds && !filter.tournamentIds.length) return [];
  const db = (await serverClient()).database;
  let q = db.from("matches").select(MATCH_COLS);
  if (filter.status) q = q.eq("status", filter.status);
  if (filter.tournamentId) q = q.eq("tournament_id", filter.tournamentId);
  if (filter.tournamentIds) q = q.in("tournament_id", filter.tournamentIds);
  if (filter.scorerId) q = q.eq("scorer_id", filter.scorerId);
  return run<Match[]>(q.order("scheduled_at", { ascending: filter.status !== "finished" }).limit(filter.limit ?? 200));
}

export async function getTournament(id: string) {
  const db = (await serverClient()).database;
  const [tournament, entries, matches] = await Promise.all([
    run<Tournament | null>(db.from("tournaments").select("*").eq("id", id).maybeSingle()),
    run<TournamentTeam[]>(db.from("tournament_teams").select("*").eq("tournament_id", id).order("seed")),
    run<Match[]>(db.from("matches").select(MATCH_COLS).eq("tournament_id", id).order("scheduled_at").limit(500)),
  ]);
  return { tournament, entries, matches };
}

export async function getMatchBundle(id: string) {
  const db = (await serverClient()).database;
  const match = await run<Match | null>(db.from("matches").select(MATCH_COLS).eq("id", id).maybeSingle());
  if (!match) return null;
  const [tournament, teams, players, events, venue] = await Promise.all([
    run<Tournament>(db.from("tournaments").select("*").eq("id", match.tournament_id).single()),
    run<Team[]>(db.from("teams").select("*").in("id", [match.home_team_id, match.away_team_id])),
    run<PlayerPublic[]>(db.from("players_public").select("*").in("team_id", [match.home_team_id, match.away_team_id]).limit(40)),
    run<MatchEventRow[]>(db.from("match_events").select("seq, type, payload, created_at").eq("match_id", id).order("seq").limit(2000)),
    match.venue_id ? run<Venue | null>(db.from("venues").select("*").eq("id", match.venue_id).maybeSingle()) : Promise.resolve(null),
  ]);
  const home = teams.find((t) => t.id === match.home_team_id)!;
  const away = teams.find((t) => t.id === match.away_team_id)!;
  return {
    match,
    tournament,
    home,
    away,
    venue,
    homePlayers: players.filter((p) => p.team_id === home.id),
    awayPlayers: players.filter((p) => p.team_id === away.id),
    events,
  };
}

export type MatchBundle = NonNullable<Awaited<ReturnType<typeof getMatchBundle>>>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Perfil público de un equipo: nómina, partidos y los torneos en los que está inscrito. */
export async function getTeamBundle(id: string) {
  if (!UUID.test(id)) return null;
  const db = (await serverClient()).database;
  const team = await run<Team | null>(db.from("teams").select("*").eq("id", id).maybeSingle());
  if (!team) return null;
  const [players, entries, matches] = await Promise.all([
    run<PlayerPublic[]>(db.from("players_public").select("*").eq("team_id", id).order("number")),
    run<TournamentTeam[]>(db.from("tournament_teams").select("*").eq("team_id", id)),
    run<Match[]>(db.from("matches").select(MATCH_COLS).or(`home_team_id.eq.${id},away_team_id.eq.${id}`).order("scheduled_at").limit(300)),
  ]);
  const tournamentIds = [...new Set(entries.map((e) => e.tournament_id))];
  const [tournaments, tournamentEntries, tournamentMatches] = tournamentIds.length
    ? await Promise.all([
        run<Tournament[]>(db.from("tournaments").select("*").in("id", tournamentIds)),
        run<TournamentTeam[]>(db.from("tournament_teams").select("*").in("tournament_id", tournamentIds)),
        run<Match[]>(db.from("matches").select(MATCH_COLS).in("tournament_id", tournamentIds).eq("status", "finished").limit(1000)),
      ])
    : [[], [], []];
  const opponentIds = [...new Set(matches.flatMap((m) => [m.home_team_id, m.away_team_id]))];
  const teams = await run<Team[]>(db.from("teams").select("*").in("id", opponentIds.length ? opponentIds : [id]));
  return { team, players, entries, matches, teams, tournaments, tournamentEntries, tournamentMatches };
}

export type TeamBundle = NonNullable<Awaited<ReturnType<typeof getTeamBundle>>>;

/**
 * Perfil público de un jugador (sin cédula ni fecha completa) y su participación en los
 * últimos partidos de su equipo, reconstruida con el motor de planilla.
 */
export async function getPlayerProfile(id: string, maxMatches = 20) {
  if (!UUID.test(id)) return null;
  const db = (await serverClient()).database;
  const player = await run<PlayerPublic | null>(db.from("players_public").select("*").eq("id", id).maybeSingle());
  if (!player) return null;
  const tid = player.team_id;
  const [team, matches] = await Promise.all([
    run<Team>(db.from("teams").select("*").eq("id", tid).single()),
    run<Match[]>(
      db
        .from("matches")
        .select(MATCH_COLS)
        .or(`home_team_id.eq.${tid},away_team_id.eq.${tid}`)
        .in("status", ["live", "finished"])
        .order("scheduled_at", { ascending: false })
        .limit(maxMatches),
    ),
  ]);
  const teamIds = [...new Set(matches.flatMap((m) => [m.home_team_id, m.away_team_id]).concat(tid))];
  const tournamentIds = [...new Set(matches.map((m) => m.tournament_id))];
  const [teams, rosters, tournaments, events] = await Promise.all([
    run<Team[]>(db.from("teams").select("*").in("id", teamIds)),
    run<PlayerPublic[]>(db.from("players_public").select("*").in("team_id", teamIds)),
    tournamentIds.length ? run<Tournament[]>(db.from("tournaments").select("*").in("id", tournamentIds)) : Promise.resolve([] as Tournament[]),
    Promise.all(
      matches.map((m) =>
        run<MatchEventRow[]>(db.from("match_events").select("seq, type, payload, created_at").eq("match_id", m.id).order("seq").limit(2000)),
      ),
    ),
  ]);

  const total = emptyAppearances();
  const perMatch = matches.map((m, i) => {
    const t = tournaments.find((x) => x.id === m.tournament_id);
    const home = teams.find((x) => x.id === m.home_team_id);
    const away = teams.find((x) => x.id === m.away_team_id);
    if (!t || !home || !away) return { match: m, sets: 0 };
    const setup = buildSetup(t, home, away, rosters.filter((p) => p.team_id === home.id), rosters.filter((p) => p.team_id === away.id));
    const state = replay(setup, events[i].map(rowToEvent));
    const one = addAppearances(emptyAppearances(), state, m.home_team_id === tid ? "A" : "B", player.number);
    addAppearances(total, state, m.home_team_id === tid ? "A" : "B", player.number);
    return { match: m, sets: one.sets };
  });
  return { player, team, teams, appearances: total, perMatch };
}
