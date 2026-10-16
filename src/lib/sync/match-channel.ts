"use client";

import { insforge } from "@/lib/insforge/client";
import type { EventRow } from "./rows";

/** Lee todas las filas de la planilla de un partido. Lanza si falla. */
export async function fetchMatchEvents(matchId: string): Promise<EventRow[]> {
  const { data, error } = await insforge()
    .database.from("match_events")
    .select("seq, type, payload, created_at")
    .eq("match_id", matchId)
    .order("seq")
    .limit(2000);
  if (error) throw new Error(error.message);
  return (data ?? []) as EventRow[];
}

/**
 * Escucha `match:{id}`: eventos nuevos y (re)conexiones. Al reconectar, el llamador debe
 * releer la planilla porque los mensajes emitidos durante el corte no se reenvían.
 */
export function subscribeMatch(
  matchId: string,
  handlers: { onEvent: (row: EventRow) => void; onConnect?: () => void; onDisconnect?: () => void },
): () => void {
  const rt = insforge().realtime;
  const channel = `match:${matchId}`;
  const onEvent = (msg: EventRow & { meta?: { channel?: string } }) => {
    // InsForge antepone "realtime:" al nombre del canal en meta.channel.
    if (msg.meta?.channel && msg.meta.channel.replace(/^realtime:/, "") !== channel) return;
    handlers.onEvent({ seq: msg.seq, type: msg.type, payload: msg.payload, created_at: msg.created_at });
  };
  const onConnect = () => handlers.onConnect?.();
  const onDisconnect = () => handlers.onDisconnect?.();
  rt.on("event", onEvent);
  rt.on("connect", onConnect);
  rt.on("disconnect", onDisconnect);
  rt.subscribe(channel)
    .then((r) => (r.ok ? onConnect() : onDisconnect()))
    .catch(onDisconnect);
  return () => {
    rt.off("event", onEvent);
    rt.off("connect", onConnect);
    rt.off("disconnect", onDisconnect);
    rt.unsubscribe(channel);
  };
}
