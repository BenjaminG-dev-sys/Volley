// Cola local de eventos pendientes de sincronizar (IndexedDB).
// Si IndexedDB no está disponible (modo privado, SSR) usa memoria.

export interface PendingRow {
  match_id: string;
  seq: number;
  type: string;
  payload: Record<string, unknown>;
  client_ts: string;
}

const DB = "volley-mesa";
const STORE = "pending";
const memory = new Map<string, PendingRow>();
const key = (r: Pick<PendingRow, "match_id" | "seq">) => `${r.match_id}:${r.seq}`;

function open(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: ["match_id", "seq"] });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function tx<T>(db: IDBDatabase, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function enqueue(row: PendingRow) {
  const db = await open();
  if (!db) return void memory.set(key(row), row);
  await tx(db, "readwrite", (s) => s.put(row));
}

export async function pending(matchId: string): Promise<PendingRow[]> {
  const db = await open();
  const all = db ? await tx<PendingRow[]>(db, "readonly", (s) => s.getAll()) : [...memory.values()];
  return all.filter((r) => r.match_id === matchId).sort((a, b) => a.seq - b.seq);
}

export async function remove(row: Pick<PendingRow, "match_id" | "seq">) {
  const db = await open();
  if (!db) return void memory.delete(key(row));
  await tx(db, "readwrite", (s) => s.delete([row.match_id, row.seq]));
}
