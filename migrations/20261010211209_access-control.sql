-- Control de acceso: lectura pública de la información deportiva, escritura solo para
-- staff (admin/organizer) y planilla solo para el planillero asignado.
-- Los datos personales (cédula, fecha de nacimiento) solo los ve el staff;
-- el público lee la vista players_public.

-- ---------- Helpers (SECURITY DEFINER para evitar recursión de RLS) ----------
CREATE OR REPLACE FUNCTION public.app_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT role FROM public.profiles WHERE user_id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT coalesce(public.app_role() = 'admin', false)
$$;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT coalesce(public.app_role() IN ('admin', 'organizer'), false)
$$;

CREATE OR REPLACE FUNCTION public.can_score(p_match uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.id = p_match
      AND m.status IN ('scheduled', 'live')
      AND (m.scorer_id = auth.uid() OR public.is_staff())
  )
$$;

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_role(), public.is_admin(), public.is_staff(), public.can_score(uuid)
  TO anon, authenticated;

-- ---------- Catálogos con lectura pública y escritura del staff ----------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['organizations', 'venues', 'tournaments', 'teams', 'tournament_teams'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO anon, authenticated USING (true)', t || '_read', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.is_staff())', t || '_insert', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff())', t || '_update', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (public.is_staff())', t || '_delete', t);
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE ON public.%I FROM anon', t);
    EXECUTE format('GRANT SELECT ON public.%I TO anon, authenticated', t);
    EXECUTE format('GRANT INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
  END LOOP;
END $$;

-- ---------- Jugadores: base privada + proyección pública ----------
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.players FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.players TO authenticated;
CREATE POLICY players_staff_read ON public.players FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY players_staff_insert ON public.players FOR INSERT TO authenticated WITH CHECK (public.is_staff());
CREATE POLICY players_staff_update ON public.players FOR UPDATE TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY players_staff_delete ON public.players FOR DELETE TO authenticated USING (public.is_staff());

-- Vista con permisos del dueño: expone solo campos deportivos (sin cédula ni fecha completa).
CREATE VIEW public.players_public AS
SELECT id, team_id, first_name, last_name, number, position, is_libero, is_captain,
       extract(year FROM birth_date)::int AS birth_year
FROM public.players;
GRANT SELECT ON public.players_public TO anon, authenticated;

-- ---------- Perfiles ----------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.profiles FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.profiles FROM authenticated;
GRANT SELECT ON public.profiles TO authenticated;
GRANT UPDATE (display_name, role) ON public.profiles TO authenticated;
CREATE POLICY profiles_read ON public.profiles FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR public.is_staff());
CREATE POLICY profiles_update ON public.profiles FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()) OR public.is_admin())
  WITH CHECK (user_id = (SELECT auth.uid()) OR public.is_admin());

-- Solo un admin cambia roles (las tareas de migración/seed corren como project_admin).
CREATE OR REPLACE FUNCTION public.guard_profile_role()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role
     AND current_user IN ('anon', 'authenticated')
     AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Solo un administrador puede cambiar roles';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER profiles_role_guard
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_profile_role();

-- ---------- Partidos ----------
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
REVOKE INSERT, UPDATE, DELETE ON public.matches FROM anon;
GRANT SELECT ON public.matches TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.matches TO authenticated;
CREATE POLICY matches_read ON public.matches FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY matches_insert ON public.matches FOR INSERT TO authenticated WITH CHECK (public.is_staff());
CREATE POLICY matches_delete ON public.matches FOR DELETE TO authenticated USING (public.is_staff());
CREATE POLICY matches_update ON public.matches FOR UPDATE TO authenticated
  USING (scorer_id = (SELECT auth.uid()) OR public.is_staff())
  WITH CHECK (scorer_id = (SELECT auth.uid()) OR public.is_staff());

-- El planillero solo puede tocar el marcador, el estado y el resultado.
CREATE OR REPLACE FUNCTION public.guard_match_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated') AND NOT public.is_staff() THEN
    IF (NEW.tournament_id, NEW.stage, NEW.group_label, NEW.round, NEW.home_team_id, NEW.away_team_id,
        NEW.venue_id, NEW.scheduled_at, NEW.scorer_id, NEW.referee_1, NEW.referee_2)
       IS DISTINCT FROM
       (OLD.tournament_id, OLD.stage, OLD.group_label, OLD.round, OLD.home_team_id, OLD.away_team_id,
        OLD.venue_id, OLD.scheduled_at, OLD.scorer_id, OLD.referee_1, OLD.referee_2) THEN
      RAISE EXCEPTION 'El planillero solo puede actualizar el marcador del partido';
    END IF;
    IF OLD.status = 'finished' THEN
      RAISE EXCEPTION 'El partido ya está cerrado';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER matches_update_guard
BEFORE UPDATE ON public.matches
FOR EACH ROW EXECUTE FUNCTION public.guard_match_update();

-- ---------- Eventos de planilla: solo inserción, append-only ----------
ALTER TABLE public.match_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.match_events FROM anon, authenticated;
GRANT SELECT ON public.match_events TO anon, authenticated;
GRANT INSERT (match_id, seq, type, payload, client_ts) ON public.match_events TO authenticated;
CREATE POLICY match_events_read ON public.match_events FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY match_events_insert ON public.match_events FOR INSERT TO authenticated
  WITH CHECK (public.can_score(match_id) AND created_by = (SELECT auth.uid()));
