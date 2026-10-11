import "server-only";

import { serverClient } from "@/lib/insforge/server";
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

export async function listMatches(filter: { status?: Match["status"]; tournamentId?: string; scorerId?: string; limit?: number }) {
  const db = (await serverClient()).database;
  let q = db.from("matches").select(MATCH_COLS);
  if (filter.status) q = q.eq("status", filter.status);
  if (filter.tournamentId) q = q.eq("tournament_id", filter.tournamentId);
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
