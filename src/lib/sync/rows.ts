// Utilidades puras para sincronizar filas de `match_events` entre la cola local,
// el servidor y Realtime. Sin dependencias del navegador para poder probarlas.

export interface EventRow {
  seq: number;
  type: string;
  payload: Record<string, unknown>;
  created_at?: string;
}

/** JSON con claves ordenadas: Postgres (jsonb) no conserva el orden de las claves. */
export function stableStringify(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v) ?? "null";
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(",")}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o)
    .filter((k) => o[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`)
    .join(",")}}`;
}

/** Mismo evento de planilla (tipo y contenido), sin importar metadatos como `created_at`. */
export const sameEvent = (a: Pick<EventRow, "type" | "payload">, b: Pick<EventRow, "type" | "payload">) =>
  a.type === b.type && stableStringify(a.payload ?? {}) === stableStringify(b.payload ?? {});

export const maxSeq = (rows: Pick<EventRow, "seq">[]) => rows.reduce((m, r) => Math.max(m, r.seq), 0);

/** Une filas por `seq` (las de `incoming` reemplazan a las de `prev`) y las ordena. */
export function mergeRows<T extends Pick<EventRow, "seq">>(prev: T[], incoming: T[]): T[] {
  const bySeq = new Map<number, T>();
  for (const r of prev) bySeq.set(r.seq, r);
  for (const r of incoming) bySeq.set(r.seq, r);
  return [...bySeq.values()].sort((a, b) => a.seq - b.seq);
}

/** Renumera filas a partir de `after + 1`, conservando su orden. */
export function renumber<T extends Pick<EventRow, "seq">>(rows: T[], after: number): T[] {
  return [...rows].sort((a, b) => a.seq - b.seq).map((r, i) => ({ ...r, seq: after + 1 + i }));
}

/** Indica si llegó un evento que salta secuencias respecto de lo conocido (se perdió algo en el camino). */
export const skipsAhead = (known: Pick<EventRow, "seq">[], incomingSeq: number) => incomingSeq > maxSeq(known) + 1;
