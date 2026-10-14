import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardHeader, Empty, PageHeader, cx } from "@/components/ui";
import { serverClient } from "@/lib/insforge/server";
import type { AuditEntry } from "@/lib/types";

export const metadata: Metadata = { title: "Auditoría" };
export const dynamic = "force-dynamic";

const TABLES: Record<string, string> = {
  tournaments: "Torneos",
  teams: "Equipos",
  players: "Jugadores",
  matches: "Partidos",
  tournament_teams: "Inscripciones",
  venues: "Sedes",
  organizations: "Organizaciones",
  referees: "Árbitros",
  profiles: "Roles",
};
const OPS = { INSERT: "creó", UPDATE: "cambió", DELETE: "eliminó" } as const;

const fmt = (iso: string) =>
  new Intl.DateTimeFormat("es-EC", { timeZone: "America/Guayaquil", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

const isChange = (v: unknown): v is { de: unknown; a: unknown } => typeof v === "object" && v !== null && "a" in v && "de" in v;

const short = (v: unknown) => {
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return s === undefined || s === null ? "—" : s.length > 40 ? `${s.slice(0, 40)}…` : s;
};

/** Registro de cambios hechos desde la app (quién, cuándo y qué) y acciones sensibles de la planilla. */
export default async function AuditPage({ searchParams }: { searchParams: Promise<{ tabla?: string }> }) {
  const { tabla } = await searchParams;
  const db = (await serverClient()).database;
  let q = db.from("admin_audit").select("*").order("at", { ascending: false }).limit(200);
  if (tabla && tabla in TABLES) q = q.eq("table_name", tabla);
  const [{ data, error }, { data: sensitive }] = await Promise.all([
    q,
    db.from("match_events").select("match_id, seq, type, created_by, created_at").in("type", ["close", "reopen"]).order("created_at", { ascending: false }).limit(30),
  ]);
  const entries = (data ?? []) as AuditEntry[];

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Registro" title="Auditoría" sub="Cambios hechos por organizadores, administradores y planilleros. La carga inicial de datos no aparece." />
      <div className="flex flex-wrap gap-2">
        {[["", "Todo"], ...Object.entries(TABLES)].map(([k, v]) => (
          <Link
            key={k || "todo"}
            href={k ? `/admin/auditoria?tabla=${k}` : "/admin/auditoria"}
            className={cx("rounded-full border-[1.5px] px-3 py-1 text-sm font-semibold", (tabla ?? "") === k ? "border-ink bg-ink text-bg" : "border-line")}
          >
            {v}
          </Link>
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-[3fr_1fr]">
        <Card className="divide-y divide-line">
          {error && <p className="px-4 py-3 text-sm text-live">No se pudo leer la auditoría: {error.message}. ¿Se aplicó la migración?</p>}
          {entries.map((e) => (
            <details key={e.id} className="px-4 py-3 text-sm">
              <summary className="cursor-pointer">
                <span className="tabular text-muted">{fmt(e.at)}</span> · <strong>{e.actor_email ?? "sistema"}</strong> {OPS[e.op]}{" "}
                {TABLES[e.table_name] ?? e.table_name}
                {e.op === "UPDATE" && e.changes && <span className="text-muted"> · {Object.keys(e.changes).join(", ")}</span>}
              </summary>
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-lg bg-surface-2 p-3 text-xs">
                {Object.entries(e.changes ?? {}).map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="font-semibold">{k}</dt>
                    <dd className="break-all">
                      {e.op === "UPDATE" && isChange(v) ? `${short(v.de)} → ${short(v.a)}` : short(v)}
                    </dd>
                  </div>
                ))}
              </dl>
            </details>
          ))}
          {!entries.length && !error && <Empty>Sin cambios registrados.</Empty>}
        </Card>
        <Card className="h-fit divide-y divide-line">
          <CardHeader title="Cierres y reaperturas" sub="Eventos de la planilla" />
          {((sensitive ?? []) as { match_id: string; seq: number; type: string; created_at: string }[]).map((s) => (
            <Link key={`${s.match_id}-${s.seq}`} href={`/partidos/${s.match_id}/planilla`} className="block px-4 py-2 text-sm hover:bg-surface-2">
              <span className={cx("font-semibold", s.type === "reopen" && "text-live")}>{s.type === "reopen" ? "Reapertura" : "Cierre"}</span>
              <span className="block text-xs text-muted">{fmt(s.created_at)}</span>
            </Link>
          ))}
          {!(sensitive ?? []).length && <Empty>Sin eventos.</Empty>}
        </Card>
      </div>
    </div>
  );
}
