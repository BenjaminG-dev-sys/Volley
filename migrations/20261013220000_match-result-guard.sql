-- Integridad del resultado: el marcador lo publica la mesa (cliente), así que el servidor
-- valida que sea un resultado de vóley posible, deriva el ganador en lugar de aceptarlo
-- y solo deja cerrar el partido si la planilla tiene el evento `close` (firmas).

-- Devuelve el motivo por el que `p_result` no es válido, o NULL si lo es.
-- Sets a 25 (el decisivo a 15) con diferencia de 2; pasado el objetivo, la diferencia es exactamente 2.
CREATE OR REPLACE FUNCTION public.match_result_error(p_result jsonb, p_best_of int, p_final boolean)
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
    target := CASE WHEN i = p_best_of THEN 15 ELSE 25 END;
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
  v_best_of int;
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

  SELECT t.best_of INTO v_best_of FROM public.tournaments t WHERE t.id = NEW.tournament_id;
  v_error := public.match_result_error(NEW.result, v_best_of, NEW.status = 'finished');
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

CREATE TRIGGER matches_result_guard
BEFORE UPDATE ON public.matches
FOR EACH ROW EXECUTE FUNCTION public.guard_match_result();
