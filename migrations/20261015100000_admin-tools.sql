-- Herramientas de administración: árbitros, invitaciones de rol, auditoría, reapertura de
-- partidos, imágenes, sistema de puntos por torneo y operaciones atómicas de calendario.

-- ---------- Árbitros ----------
CREATE TABLE public.referees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  email text,
  city text,
  level text CHECK (level IN ('provincial', 'nacional', 'internacional', 'parroquial')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.referees ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.referees FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.referees TO authenticated;
CREATE POLICY referees_staff ON public.referees FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

-- ---------- Invitaciones de rol: el rol se aplica cuando la persona crea su cuenta ----------
CREATE TABLE public.role_invites (
  email text PRIMARY KEY CHECK (email = lower(email)),
  role text NOT NULL CHECK (role IN ('admin', 'organizer', 'scorer', 'referee', 'viewer')),
  invited_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.role_invites ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.role_invites FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.role_invites TO authenticated;
CREATE POLICY role_invites_admin ON public.role_invites FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_role text;
BEGIN
  SELECT role INTO v_role FROM public.role_invites WHERE email = lower(NEW.email);
  INSERT INTO public.profiles (user_id, display_name, email, role)
  VALUES (NEW.id, NEW.profile->>'name', NEW.email, coalesce(v_role, 'viewer'))
  ON CONFLICT (user_id) DO NOTHING;
  DELETE FROM public.role_invites WHERE email = lower(NEW.email);
  RETURN NEW;
END;
$$;

-- ---------- Auditoría de cambios hechos desde la app ----------
CREATE TABLE public.admin_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  actor uuid,
  actor_email text,
  table_name text NOT NULL,
  op text NOT NULL,
  row_id text,
  changes jsonb
);
CREATE INDEX admin_audit_at_idx ON public.admin_audit(at DESC);
ALTER TABLE public.admin_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_audit FROM anon, authenticated;
GRANT SELECT ON public.admin_audit TO authenticated;
CREATE POLICY admin_audit_read ON public.admin_audit FOR SELECT TO authenticated USING (public.is_staff());

CREATE OR REPLACE FUNCTION public.audit_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_old jsonb := CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) END;
  v_new jsonb := CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) END;
  v_row jsonb := coalesce(v_new, v_old);
  v_changes jsonb;
BEGIN
  -- Migraciones y seed (project_admin) no se auditan. Dentro de una función SECURITY DEFINER
  -- `current_user` es el dueño; el rol de la petición sigue en la variable `role` (SET ROLE).
  IF coalesce(current_setting('role', true), '') NOT IN ('anon', 'authenticated') THEN
    RETURN NULL;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    SELECT jsonb_object_agg(key, jsonb_build_object('de', v_old->key, 'a', value)) INTO v_changes
    FROM jsonb_each(v_new)
    WHERE v_old->key IS DISTINCT FROM value AND key NOT IN ('updated_at', 'live_state');
    -- El marcador que publica la mesa (resultado parcial) no es un cambio administrativo.
    IF v_changes IS NULL OR (v_changes - 'result' - 'winner_team_id') = '{}'::jsonb THEN
      RETURN NULL;
    END IF;
  ELSE
    v_changes := v_row;
  END IF;
  INSERT INTO public.admin_audit (actor, actor_email, table_name, op, row_id, changes)
  VALUES (
    auth.uid(),
    (SELECT email FROM public.profiles WHERE user_id = auth.uid()),
    TG_TABLE_NAME,
    TG_OP,
    coalesce(v_row->>'id', v_row->>'user_id', concat_ws(':', v_row->>'tournament_id', v_row->>'team_id')),
    v_changes
  );
  RETURN NULL;
END;
$$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['tournaments', 'teams', 'players', 'matches', 'venues', 'organizations', 'tournament_teams', 'referees', 'profiles'] LOOP
    EXECUTE format('CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.audit_row()', t || '_audit', t);
  END LOOP;
END $$;

-- ---------- Reapertura de partidos (solo staff, queda en la planilla) ----------
ALTER TABLE public.match_events DROP CONSTRAINT match_events_type_check;
ALTER TABLE public.match_events ADD CONSTRAINT match_events_type_check CHECK (type IN (
  'coin_toss', 'lineup', 'point', 'timeout', 'substitution',
  'libero_in', 'libero_out', 'sanction', 'undo', 'close', 'reopen'
));
DROP POLICY match_events_insert ON public.match_events;
CREATE POLICY match_events_insert ON public.match_events FOR INSERT TO authenticated
  WITH CHECK (
    public.can_score(match_id)
    AND created_by = (SELECT auth.uid())
    AND (type <> 'reopen' OR public.is_staff())
  );

-- ---------- Imágenes (Storage: guardar url y key), color y sistema de puntos ----------
ALTER TABLE public.teams ADD COLUMN logo_key text, ADD COLUMN cover_url text, ADD COLUMN cover_key text;
ALTER TABLE public.tournaments
  ADD COLUMN cover_url text,
  ADD COLUMN cover_key text,
  ADD COLUMN color text CHECK (color ~ '^#[0-9a-fA-F]{6}$'),
  ADD COLUMN standings jsonb;
ALTER TABLE public.players ADD COLUMN photo_url text, ADD COLUMN photo_key text;

CREATE OR REPLACE VIEW public.players_public AS
SELECT id, team_id, first_name, last_name, number, position, is_libero, is_captain,
       extract(year FROM birth_date)::int AS birth_year,
       photo_url
FROM public.players;

-- ---------- Operaciones atómicas (una sola transacción) ----------
CREATE OR REPLACE FUNCTION public.set_entries(p_tournament uuid, p_team_ids uuid[])
RETURNS int
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'Solo organizadores y administradores';
  END IF;
  IF EXISTS (SELECT 1 FROM public.matches WHERE tournament_id = p_tournament AND status <> 'scheduled') THEN
    RAISE EXCEPTION 'Ya hay partidos jugados; la inscripción está cerrada.';
  END IF;
  DELETE FROM public.tournament_teams WHERE tournament_id = p_tournament AND NOT (team_id = ANY (p_team_ids));
  INSERT INTO public.tournament_teams (tournament_id, team_id, seed)
  SELECT p_tournament, t.id, t.ord FROM unnest(p_team_ids) WITH ORDINALITY AS t(id, ord)
  ON CONFLICT (tournament_id, team_id) DO UPDATE SET seed = EXCLUDED.seed;
  RETURN cardinality(p_team_ids);
END;
$$;

CREATE OR REPLACE FUNCTION public.replace_schedule(p_tournament uuid, p_groups jsonb, p_matches jsonb)
RETURNS int
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'Solo organizadores y administradores';
  END IF;
  IF EXISTS (SELECT 1 FROM public.matches WHERE tournament_id = p_tournament AND status <> 'scheduled') THEN
    RAISE EXCEPTION 'Ya hay partidos jugados; el calendario no se puede regenerar.';
  END IF;
  DELETE FROM public.matches WHERE tournament_id = p_tournament;
  UPDATE public.tournament_teams tt SET group_label = g.group_label
  FROM jsonb_to_recordset(p_groups) AS g(team_id uuid, group_label text)
  WHERE tt.tournament_id = p_tournament AND tt.team_id = g.team_id;
  INSERT INTO public.matches (tournament_id, stage, group_label, round, home_team_id, away_team_id, venue_id, scheduled_at)
  SELECT p_tournament, m.stage, m.group_label, m.round, m.home_team_id, m.away_team_id, m.venue_id, m.scheduled_at
  FROM jsonb_to_recordset(p_matches) AS m(stage text, group_label text, round int, home_team_id uuid, away_team_id uuid, venue_id uuid, scheduled_at timestamptz);
  RETURN (SELECT count(*) FROM public.matches WHERE tournament_id = p_tournament);
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_entries(uuid, uuid[]), public.replace_schedule(uuid, jsonb, jsonb) TO authenticated;
