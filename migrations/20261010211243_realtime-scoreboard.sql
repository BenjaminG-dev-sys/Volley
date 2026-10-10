-- Realtime: el marcador público escucha `match:{id}`; la portada escucha `live`.
INSERT INTO realtime.channels (pattern, description, enabled)
VALUES
  ('match:%', 'Marcador y jugadas en vivo de un partido', true),
  ('live', 'Resumen de partidos en vivo para la portada', true)
ON CONFLICT (pattern) DO UPDATE
SET description = EXCLUDED.description,
    enabled = EXCLUDED.enabled;

-- Cambio de marcador o estado del partido.
CREATE OR REPLACE FUNCTION public.publish_match_state()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  PERFORM realtime.publish(
    'match:' || NEW.id::text,
    'state',
    jsonb_build_object('id', NEW.id, 'status', NEW.status, 'live_state', NEW.live_state, 'result', NEW.result)
  );
  PERFORM realtime.publish(
    'live',
    'match_updated',
    jsonb_build_object('id', NEW.id, 'tournament_id', NEW.tournament_id, 'status', NEW.status, 'live_state', NEW.live_state)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER matches_publish_state
AFTER UPDATE ON public.matches
FOR EACH ROW
WHEN (OLD.live_state IS DISTINCT FROM NEW.live_state OR OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.publish_match_state();

-- Cada evento nuevo de la planilla (para el ticker de jugadas y el replay en el cliente).
CREATE OR REPLACE FUNCTION public.publish_match_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  PERFORM realtime.publish(
    'match:' || NEW.match_id::text,
    'event',
    jsonb_build_object('seq', NEW.seq, 'type', NEW.type, 'payload', NEW.payload, 'created_at', NEW.created_at)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER match_events_publish
AFTER INSERT ON public.match_events
FOR EACH ROW EXECUTE FUNCTION public.publish_match_event();

-- Los clientes no pueden publicar mensajes falsos en los canales: solo los triggers
-- (realtime.publish es SECURITY DEFINER) escriben en realtime.messages.
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;
