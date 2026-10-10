-- Esquema base: organizaciones, torneos, equipos, jugadores, partidos y eventos de planilla.

-- Cédula ecuatoriana (persona natural): provincia 01-24 o 30, tercer dígito < 6, verificador módulo 10.
CREATE OR REPLACE FUNCTION public.is_valid_cedula(c text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  coef int[] := ARRAY[2,1,2,1,2,1,2,1,2];
  total int := 0;
  p int;
  prov int;
BEGIN
  IF c IS NULL OR c !~ '^\d{10}$' THEN
    RETURN false;
  END IF;
  prov := substr(c, 1, 2)::int;
  IF NOT ((prov BETWEEN 1 AND 24) OR prov = 30) OR substr(c, 3, 1)::int >= 6 THEN
    RETURN false;
  END IF;
  FOR i IN 1..9 LOOP
    p := substr(c, i, 1)::int * coef[i];
    IF p > 9 THEN p := p - 9; END IF;
    total := total + p;
  END LOOP;
  RETURN (10 - total % 10) % 10 = substr(c, 10, 1)::int;
END;
$$;

CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  short_name text,
  kind text NOT NULL DEFAULT 'association' CHECK (kind IN ('federation', 'association', 'league')),
  province text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  email text,
  role text NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'organizer', 'scorer', 'referee', 'viewer')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.venues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  city text NOT NULL,
  province text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.tournaments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  name text NOT NULL,
  season int NOT NULL CHECK (season BETWEEN 2000 AND 2100),
  category text NOT NULL CHECK (category IN ('Sub-15', 'Sub-17', 'Sub-19', 'Sub-21', 'Mayores', 'Master')),
  branch text NOT NULL CHECK (branch IN ('femenino', 'masculino', 'mixto')),
  city text,
  format text NOT NULL DEFAULT 'round_robin' CHECK (format IN ('round_robin', 'groups_knockout')),
  best_of smallint NOT NULL DEFAULT 5 CHECK (best_of IN (3, 5)),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'finished')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  name text NOT NULL,
  short_name text NOT NULL,
  city text,
  province text,
  color_primary text NOT NULL DEFAULT '#1d4ed8',
  color_secondary text NOT NULL DEFAULT '#ffffff',
  logo_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  first_name text NOT NULL,
  last_name text NOT NULL,
  cedula text NOT NULL UNIQUE CHECK (public.is_valid_cedula(cedula)),
  birth_date date NOT NULL,
  number smallint NOT NULL CHECK (number BETWEEN 1 AND 99),
  position text CHECK (position IN ('armador', 'opuesto', 'central', 'punta', 'libero')),
  is_libero boolean NOT NULL DEFAULT false,
  is_captain boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, number)
);
CREATE INDEX players_team_idx ON public.players(team_id);

-- Nómina FIVB: máximo 14 jugadores y 2 líberos por equipo.
CREATE OR REPLACE FUNCTION public.enforce_roster_limits()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF (SELECT count(*) FROM public.players WHERE team_id = NEW.team_id AND id <> NEW.id) >= 14 THEN
    RAISE EXCEPTION 'La nómina no puede superar 14 jugadores';
  END IF;
  IF NEW.is_libero AND (
    SELECT count(*) FROM public.players WHERE team_id = NEW.team_id AND is_libero AND id <> NEW.id
  ) >= 2 THEN
    RAISE EXCEPTION 'Máximo 2 líberos por equipo';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER players_roster_limits
BEFORE INSERT OR UPDATE OF team_id, is_libero ON public.players
FOR EACH ROW EXECUTE FUNCTION public.enforce_roster_limits();

CREATE TABLE public.tournament_teams (
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  group_label text,
  seed int,
  PRIMARY KEY (tournament_id, team_id)
);

CREATE TABLE public.matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  stage text NOT NULL DEFAULT 'league' CHECK (stage IN ('league', 'group', 'semifinal', 'third_place', 'final')),
  group_label text,
  round int,
  home_team_id uuid NOT NULL REFERENCES public.teams(id),
  away_team_id uuid NOT NULL REFERENCES public.teams(id),
  venue_id uuid REFERENCES public.venues(id) ON DELETE SET NULL,
  scheduled_at timestamptz,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'finished')),
  scorer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  referee_1 text,
  referee_2 text,
  -- Snapshot pequeño del marcador (derivado de match_events) para lecturas rápidas.
  live_state jsonb,
  -- Resultado final: {"sets":[{"home":25,"away":20},...],"home_sets":3,"away_sets":1}
  result jsonb,
  winner_team_id uuid REFERENCES public.teams(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (home_team_id <> away_team_id)
);
CREATE INDEX matches_tournament_idx ON public.matches(tournament_id, scheduled_at);
CREATE INDEX matches_status_idx ON public.matches(status);
CREATE INDEX matches_scorer_idx ON public.matches(scorer_id);

CREATE TRIGGER matches_updated_at
BEFORE UPDATE ON public.matches
FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();

-- Planilla basada en eventos: filas inmutables, una secuencia por partido.
CREATE TABLE public.match_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  seq int NOT NULL CHECK (seq > 0),
  type text NOT NULL CHECK (type IN (
    'coin_toss', 'lineup', 'point', 'timeout', 'substitution',
    'libero_in', 'libero_out', 'sanction', 'undo', 'close'
  )),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  client_ts timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (match_id, seq)
);

-- Perfil automático al registrarse un usuario.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, email)
  VALUES (NEW.id, NEW.profile->>'name', NEW.email)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
