-- Dos modos de juego: vóley (FIVB) y ecuavóley. El deporte se elige por torneo; los equipos
-- declaran su deporte para validar nóminas e inscripciones. `tournaments.rules` guarda los
-- ajustes del reglamento respecto del preset del deporte (ver src/lib/scoresheet/rules.ts).

ALTER TABLE public.tournaments
  ADD COLUMN sport text NOT NULL DEFAULT 'voley' CHECK (sport IN ('voley', 'ecuavoley')),
  ADD COLUMN rules jsonb;

ALTER TABLE public.teams
  ADD COLUMN sport text NOT NULL DEFAULT 'voley' CHECK (sport IN ('voley', 'ecuavoley'));

-- Posiciones de ecuavóley: servidor, colocador y volador.
ALTER TABLE public.players DROP CONSTRAINT players_position_check;
ALTER TABLE public.players ADD CONSTRAINT players_position_check
  CHECK (position IN ('armador', 'opuesto', 'central', 'punta', 'libero', 'servidor', 'colocador', 'volador'));

-- Nómina por deporte: vóley 14 jugadores y 2 líberos; ecuavóley 3 titulares + 4 suplentes, sin líbero.
CREATE OR REPLACE FUNCTION public.enforce_roster_limits()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_sport text;
  v_max int;
BEGIN
  SELECT sport INTO v_sport FROM public.teams WHERE id = NEW.team_id;
  v_max := CASE WHEN v_sport = 'ecuavoley' THEN 7 ELSE 14 END;
  IF (SELECT count(*) FROM public.players WHERE team_id = NEW.team_id AND id <> NEW.id) >= v_max THEN
    RAISE EXCEPTION 'La nómina no puede superar % jugadores', v_max;
  END IF;
  IF NEW.is_libero AND v_sport = 'ecuavoley' THEN
    RAISE EXCEPTION 'El ecuavóley no usa líbero';
  END IF;
  IF NEW.is_libero AND (
    SELECT count(*) FROM public.players WHERE team_id = NEW.team_id AND is_libero AND id <> NEW.id
  ) >= 2 THEN
    RAISE EXCEPTION 'Máximo 2 líberos por equipo';
  END IF;
  RETURN NEW;
END;
$$;

-- Un equipo solo se inscribe en torneos de su deporte.
CREATE OR REPLACE FUNCTION public.enforce_entry_sport()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF (SELECT sport FROM public.teams WHERE id = NEW.team_id)
     IS DISTINCT FROM (SELECT sport FROM public.tournaments WHERE id = NEW.tournament_id) THEN
    RAISE EXCEPTION 'El equipo no es del mismo deporte que el torneo';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tournament_teams_sport
BEFORE INSERT OR UPDATE ON public.tournament_teams
FOR EACH ROW EXECUTE FUNCTION public.enforce_entry_sport();

-- El resultado se valida con los puntos del reglamento del torneo.
DROP FUNCTION public.match_result_error(jsonb, int, boolean);

CREATE OR REPLACE FUNCTION public.match_result_error(
  p_result jsonb,
  p_best_of int,
  p_final boolean,
  p_points int DEFAULT 25,
  p_deciding int DEFAULT 15
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  to_win int := (p_best_of + 1) / 2;
  s jsonb;
  i int := 0;
  h int;
  a int;
  target int;
  home_sets int := 0;
  away_sets int := 0;
BEGIN
  IF p_result IS NULL THEN
    RETURN CASE WHEN p_final THEN 'Falta el resultado del partido' END;
  END IF;
  IF jsonb_typeof(p_result->'sets') IS DISTINCT FROM 'array' THEN
    RETURN 'El resultado no tiene sets';
  END IF;
  FOR s IN SELECT value FROM jsonb_array_elements(p_result->'sets') LOOP
    i := i + 1;
    IF home_sets = to_win OR away_sets = to_win THEN
      RETURN 'Hay sets después de que el partido terminó';
    END IF;
    IF jsonb_typeof(s->'home') IS DISTINCT FROM 'number' OR jsonb_typeof(s->'away') IS DISTINCT FROM 'number' THEN
      RETURN format('Set %s inválido', i);
    END IF;
    h := (s->>'home')::int;
    a := (s->>'away')::int;
    target := CASE WHEN i = p_best_of THEN p_deciding ELSE p_points END;
    IF least(h, a) < 0
       OR greatest(h, a) < target
       OR abs(h - a) < 2
       OR (greatest(h, a) > target AND abs(h - a) <> 2) THEN
      RETURN format('Marcador imposible en el set %s (%s-%s)', i, h, a);
    END IF;
    IF h > a THEN home_sets := home_sets + 1; ELSE away_sets := away_sets + 1; END IF;
  END LOOP;
  IF jsonb_typeof(p_result->'home_sets') IS DISTINCT FROM 'number'
     OR jsonb_typeof(p_result->'away_sets') IS DISTINCT FROM 'number'
     OR (p_result->>'home_sets')::int <> home_sets
     OR (p_result->>'away_sets')::int <> away_sets THEN
    RETURN 'Los sets ganados no coinciden con los marcadores';
  END IF;
  IF p_final AND greatest(home_sets, away_sets) <> to_win THEN
    RETURN 'El partido no tiene ganador';
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_match_result()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  t record;
  v_points int;
  v_deciding int;
  v_error text;
BEGIN
  -- Migraciones y seed (project_admin) no pasan por aquí.
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;
  IF NEW.result IS NOT DISTINCT FROM OLD.result
     AND NEW.status IS NOT DISTINCT FROM OLD.status
     AND NEW.winner_team_id IS NOT DISTINCT FROM OLD.winner_team_id THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'finished' AND OLD.status IS DISTINCT FROM 'finished' AND NOT EXISTS (
    SELECT 1 FROM public.match_events e WHERE e.match_id = NEW.id AND e.type = 'close'
  ) THEN
    RAISE EXCEPTION 'El partido solo se cierra con la planilla firmada';
  END IF;

  SELECT best_of, sport, rules INTO t FROM public.tournaments WHERE id = NEW.tournament_id;
  -- Mismos valores por defecto que los presets de src/lib/scoresheet/rules.ts.
  v_points := coalesce((t.rules->>'pointsPerSet')::int, CASE WHEN t.sport = 'ecuavoley' THEN 15 ELSE 25 END);
  v_deciding := coalesce((t.rules->>'pointsDecidingSet')::int, 15);
  v_error := public.match_result_error(NEW.result, t.best_of, NEW.status = 'finished', v_points, v_deciding);
  IF v_error IS NOT NULL THEN
    RAISE EXCEPTION 'Resultado inválido: %', v_error;
  END IF;

  -- El ganador se deriva del resultado; no se acepta el que envíe el cliente.
  NEW.winner_team_id := CASE
    WHEN NEW.status <> 'finished' THEN NULL
    WHEN (NEW.result->>'home_sets')::int > (NEW.result->>'away_sets')::int THEN NEW.home_team_id
    ELSE NEW.away_team_id
  END;
  RETURN NEW;
END;
$$;
