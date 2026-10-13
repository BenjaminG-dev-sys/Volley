// Filas de la base de datos (InsForge / PostgREST).

import type { RuleOverrides, Sport } from "./scoresheet/rules";

export type Role = "admin" | "organizer" | "scorer" | "referee" | "viewer";
export type MatchStatus = "scheduled" | "live" | "finished";
export type Stage = "league" | "group" | "semifinal" | "third_place" | "final";

export interface Organization {
  id: string;
  name: string;
  short_name: string | null;
  kind: "federation" | "association" | "league";
  province: string | null;
}

export interface Venue {
  id: string;
  name: string;
  city: string;
  province: string;
}

export interface Tournament {
  id: string;
  organization_id: string | null;
  name: string;
  season: number;
  category: string;
  branch: "femenino" | "masculino" | "mixto";
  city: string | null;
  format: "round_robin" | "groups_knockout";
  best_of: 3 | 5;
  status: "draft" | "active" | "finished";
  sport: Sport;
  /** Ajustes del reglamento respecto del preset del deporte. */
  rules: RuleOverrides | null;
  created_at: string;
}

export interface Team {
  id: string;
  organization_id: string | null;
  name: string;
  short_name: string;
  city: string | null;
  province: string | null;
  color_primary: string;
  color_secondary: string;
  logo_url: string | null;
  sport: Sport;
}

export interface Player {
  id: string;
  team_id: string;
  first_name: string;
  last_name: string;
  cedula: string;
  birth_date: string;
  number: number;
  position: string | null;
  is_libero: boolean;
  is_captain: boolean;
}

export type PlayerPublic = Omit<Player, "cedula" | "birth_date"> & { birth_year: number };

export interface TournamentTeam {
  tournament_id: string;
  team_id: string;
  group_label: string | null;
  seed: number | null;
}

export interface MatchResult {
  sets: { home: number; away: number }[];
  home_sets: number;
  away_sets: number;
}

export interface Match {
  id: string;
  tournament_id: string;
  stage: Stage;
  group_label: string | null;
  round: number | null;
  home_team_id: string;
  away_team_id: string;
  venue_id: string | null;
  scheduled_at: string | null;
  status: MatchStatus;
  scorer_id: string | null;
  referee_1: string | null;
  referee_2: string | null;
  live_state: import("./match").LiveState | null;
  result: MatchResult | null;
  winner_team_id: string | null;
  updated_at: string;
}

export interface MatchEventRow {
  id: number;
  match_id: string;
  seq: number;
  type: import("./scoresheet").MatchEvent["type"];
  payload: Record<string, unknown>;
  created_by: string | null;
  client_ts: string | null;
  created_at: string;
}

export interface Profile {
  user_id: string;
  display_name: string | null;
  email: string | null;
  role: Role;
}

export const STAGE_LABEL: Record<Stage, string> = {
  league: "Liga",
  group: "Fase de grupos",
  semifinal: "Semifinal",
  third_place: "Tercer lugar",
  final: "Final",
};

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Administrador",
  organizer: "Organizador",
  scorer: "Planillero",
  referee: "Árbitro",
  viewer: "Público",
};
