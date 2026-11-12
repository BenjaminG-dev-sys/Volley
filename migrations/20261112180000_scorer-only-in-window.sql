CREATE OR REPLACE FUNCTION public.in_scoring_window(p_scheduled timestamptz)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT p_scheduled IS NOT NULL
     AND now() >= p_scheduled - interval '30 minutes'
     AND now() <= p_scheduled + interval '240 minutes'
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
      AND m.scorer_id IS NOT NULL
      AND m.scorer_id = auth.uid()
      AND public.in_scoring_window(m.scheduled_at)
  )
$$;

GRANT EXECUTE ON FUNCTION public.in_scoring_window(timestamptz), public.can_score(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.guard_match_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated') THEN
    IF (NEW.status, NEW.live_state, NEW.result, NEW.winner_team_id)
       IS DISTINCT FROM
       (OLD.status, OLD.live_state, OLD.result, OLD.winner_team_id) THEN
      IF OLD.scorer_id IS NULL OR OLD.scorer_id IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'Solo el vocal designado puede llenar la planilla de este partido';
      END IF;
      IF OLD.status = 'finished' THEN
        RAISE EXCEPTION 'El partido ya está cerrado';
      END IF;
      IF NOT public.in_scoring_window(OLD.scheduled_at) THEN
        RAISE EXCEPTION 'La planilla solo se puede llenar en el horario designado del partido';
      END IF;
    END IF;
    IF NOT public.is_staff() THEN
      IF (NEW.tournament_id, NEW.stage, NEW.group_label, NEW.round, NEW.home_team_id, NEW.away_team_id,
          NEW.venue_id, NEW.scheduled_at, NEW.scorer_id, NEW.referee_1, NEW.referee_2)
         IS DISTINCT FROM
         (OLD.tournament_id, OLD.stage, OLD.group_label, OLD.round, OLD.home_team_id, OLD.away_team_id,
          OLD.venue_id, OLD.scheduled_at, OLD.scorer_id, OLD.referee_1, OLD.referee_2) THEN
        RAISE EXCEPTION 'El vocal solo puede actualizar el marcador del partido';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
