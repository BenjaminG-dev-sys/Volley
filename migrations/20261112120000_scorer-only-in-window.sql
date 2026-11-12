-- La planilla de un partido la edita UNA sola persona: el vocal (planillero) asignado,
-- y solo dentro de su horario: desde 30 min antes de la hora programada hasta 4 h después.
-- Organizadores y administradores ya no pueden anotar; solo programan y reasignan al vocal.
-- Mantener en sincronía con SCORING_OPENS_BEFORE_MIN / SCORING_CLOSES_AFTER_MIN (src/lib/match.ts).

CREATE OR REPLACE FUNCTION public.scoring_window_open(p_scheduled_at timestamptz)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT p_scheduled_at IS NOT NULL
     AND now() >= p_scheduled_at - interval '30 minutes'
     AND now() <= p_scheduled_at + interval '4 hours'
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
      AND public.scoring_window_open(m.scheduled_at)
  )
$$;

GRANT EXECUTE ON FUNCTION public.scoring_window_open(timestamptz), public.can_score(uuid) TO anon, authenticated;

-- Marcador/estado/resultado: solo el vocal asignado y en horario, sea cual sea su rol.
-- Programación (equipos, sede, hora, vocal, árbitros): solo staff.
CREATE OR REPLACE FUNCTION public.guard_match_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW; -- migraciones y seed (project_admin)
  END IF;

  IF (NEW.tournament_id, NEW.stage, NEW.group_label, NEW.round, NEW.home_team_id, NEW.away_team_id,
      NEW.venue_id, NEW.scheduled_at, NEW.scorer_id, NEW.referee_1, NEW.referee_2)
     IS DISTINCT FROM
     (OLD.tournament_id, OLD.stage, OLD.group_label, OLD.round, OLD.home_team_id, OLD.away_team_id,
      OLD.venue_id, OLD.scheduled_at, OLD.scorer_id, OLD.referee_1, OLD.referee_2)
     AND NOT public.is_staff() THEN
    RAISE EXCEPTION 'El planillero solo puede actualizar el marcador del partido';
  END IF;

  IF (NEW.status, NEW.live_state, NEW.result, NEW.winner_team_id)
     IS DISTINCT FROM
     (OLD.status, OLD.live_state, OLD.result, OLD.winner_team_id) THEN
    IF OLD.status = 'finished' THEN
      RAISE EXCEPTION 'El partido ya está cerrado';
    END IF;
    IF OLD.scorer_id IS NULL OR OLD.scorer_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'Solo el vocal designado puede editar la planilla de este partido';
    END IF;
    IF NOT public.scoring_window_open(OLD.scheduled_at) THEN
      RAISE EXCEPTION 'La planilla está fuera del horario designado para este partido';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
