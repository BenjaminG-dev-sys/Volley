"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Button, Card, Empty, TeamCrest, cx, inputCls } from "@/components/ui";
import { type Conflict, detectConflicts } from "@/lib/admin/conflicts";
import type { Match, Team, Venue } from "@/lib/types";
import { STAGE_LABEL } from "@/lib/types";
import { rescheduleMatch } from "./actions";

const TZ_OFFSET = 5 * 3600_000; // Ecuador, UTC-5 sin horario de verano
const HOURS = Array.from({ length: 14 }, (_, i) => 8 + i); // 08:00–21:00

const ectParts = (iso: string) => {
  const d = new Date(Date.parse(iso) - TZ_OFFSET);
  return { day: d.toISOString().slice(0, 10), hour: d.getUTCHours(), minute: d.getUTCMinutes() };
};
const isoFromEct = (day: string, hour: number, minute = 0) =>
  new Date(`${day}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00-05:00`).toISOString();
const dayLabel = (day: string) =>
  new Intl.DateTimeFormat("es-EC", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" }).format(new Date(`${day}T12:00:00Z`));

/**
 * Calendario visual: una columna por día con partidos, franjas por hora. Se arrastra un partido
 * programado a otra franja para reprogramarlo; en teléfonos se toca y se edita fecha, hora y sede.
 */
export function ScheduleBoard({ matches, teams, venues }: { matches: Match[]; teams: Team[]; venues: Venue[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [editing, setEditing] = useState<Match | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const teamMap = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);
  const venueMap = useMemo(() => new Map(venues.map((v) => [v.id, v])), [venues]);
  const conflicts = useMemo(() => detectConflicts(matches), [matches]);
  const byMatch = useMemo(() => {
    const m = new Map<string, Conflict[]>();
    for (const c of conflicts) for (const id of [c.a, c.b]) m.set(id, [...(m.get(id) ?? []), c]);
    return m;
  }, [conflicts]);

  const scheduled = matches.filter((m) => m.scheduled_at);
  const days = [...new Set(scheduled.map((m) => ectParts(m.scheduled_at!).day))].sort();
  const unscheduled = matches.filter((m) => !m.scheduled_at);

  const move = (matchId: string, iso: string, venueId?: string | null) =>
    start(async () => {
      const r = await rescheduleMatch(matchId, iso, venueId);
      setMessage(r.error ?? r.ok ?? null);
      setEditing(null);
      router.refresh();
    });

  const conflictText = (id: string) =>
    (byMatch.get(id) ?? [])
      .map((c) => (c.reason === "team" ? `${teamMap.get(c.ref)?.short_name ?? "Equipo"} juega dos partidos a la vez` : `Sede ocupada: ${venueMap.get(c.ref)?.name ?? ""}`))
      .join(" · ");

  const MatchChip = ({ m }: { m: Match }) => {
    const h = teamMap.get(m.home_team_id);
    const a = teamMap.get(m.away_team_id);
    const bad = byMatch.has(m.id);
    const movable = m.status === "scheduled";
    const p = m.scheduled_at ? ectParts(m.scheduled_at) : null;
    return (
      <button
        type="button"
        draggable={movable}
        onDragStart={(e) => {
          e.dataTransfer.setData("text/plain", m.id);
          setDragging(m.id);
        }}
        onDragEnd={() => setDragging(null)}
        onClick={() => movable && setEditing(m)}
        title={bad ? conflictText(m.id) : movable ? "Arrastra para reprogramar o toca para editar" : "Ya empezó: no se reprograma"}
        className={cx(
          "w-full rounded-lg border-[1.5px] px-2 py-1.5 text-left text-xs transition",
          bad ? "border-live bg-live/10" : "border-line bg-surface hover:border-ink",
          movable ? "cursor-grab active:cursor-grabbing" : "cursor-default opacity-60",
          dragging === m.id && "opacity-40",
        )}
      >
        <span className="flex items-center justify-between gap-1">
          <span className="tabular font-semibold">{p ? `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}` : "—"}</span>
          <span className="truncate text-[10px] text-muted">{m.venue_id ? venueMap.get(m.venue_id)?.name : "Sin sede"}</span>
        </span>
        <span className="mt-1 flex items-center gap-1">
          <TeamCrest name={h?.name ?? ""} color={h?.color_primary ?? "#999"} size="xs" />
          <span className="truncate font-medium">{h?.short_name}</span>
          <span className="text-muted">vs</span>
          <TeamCrest name={a?.name ?? ""} color={a?.color_primary ?? "#999"} size="xs" />
          <span className="truncate font-medium">{a?.short_name}</span>
        </span>
        <span className="mt-0.5 block truncate text-[10px] text-muted">
          {STAGE_LABEL[m.stage]}
          {m.group_label ? ` ${m.group_label}` : ""}
          {m.round ? ` · J${m.round}` : ""}
        </span>
        {bad && <span className="mt-0.5 block text-[10px] font-semibold text-live">Conflicto: {conflictText(m.id)}</span>}
      </button>
    );
  };

  if (!matches.length) return <Card><Empty>No hay partidos para mostrar.</Empty></Card>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className={cx("rounded-full px-3 py-1 font-semibold", conflicts.length ? "bg-live text-white" : "bg-ok/15 text-ok")}>
          {conflicts.length ? `${new Set(conflicts.flatMap((c) => [c.a, c.b])).size} partidos con conflicto` : "Sin conflictos de horario"}
        </span>
        <span className="text-muted">Arrastra un partido a otra hora o tócalo para cambiar fecha y sede. Hora de Ecuador.</span>
        {pending && <span className="text-muted">Guardando…</span>}
        {message && <span className="font-medium">{message}</span>}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-line">
        <div className="grid min-w-max" style={{ gridTemplateColumns: `4rem repeat(${days.length}, 13rem)` }}>
          <div className="sticky left-0 z-10 border-b border-line bg-surface" />
          {days.map((d) => (
            <div key={d} className="border-b border-l border-line bg-surface px-2 py-2 text-xs font-bold uppercase">
              {dayLabel(d)}
            </div>
          ))}
          {HOURS.map((h) => (
            <div key={h} className="contents">
              <div className="tabular sticky left-0 z-10 border-b border-line bg-surface px-2 py-2 text-xs text-muted">{String(h).padStart(2, "0")}:00</div>
              {days.map((d) => {
                const here = scheduled.filter((m) => {
                  const p = ectParts(m.scheduled_at!);
                  return p.day === d && (p.hour === h || (h === HOURS[0] && p.hour < h) || (h === HOURS.at(-1) && p.hour > h));
                });
                return (
                  <div
                    key={d + h}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const id = e.dataTransfer.getData("text/plain");
                      const m = matches.find((x) => x.id === id);
                      if (!m) return;
                      const old = m.scheduled_at ? ectParts(m.scheduled_at) : null;
                      if (old?.day === d && old.hour === h) return;
                      move(id, isoFromEct(d, h, 0));
                    }}
                    className={cx("min-h-14 space-y-1 border-b border-l border-line p-1", dragging && "bg-surface-2/60")}
                  >
                    {here.map((m) => (
                      <MatchChip key={m.id} m={m} />
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {unscheduled.length > 0 && (
        <Card className="space-y-2 p-4">
          <p className="text-sm font-semibold">Sin fecha ({unscheduled.length})</p>
          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {unscheduled.map((m) => (
              <MatchChip key={m.id} m={m} />
            ))}
          </div>
        </Card>
      )}

      {editing && <EditDialog match={editing} venues={venues} teams={teamMap} onClose={() => setEditing(null)} onSave={move} pending={pending} />}
    </div>
  );
}

function EditDialog({
  match,
  venues,
  teams,
  onClose,
  onSave,
  pending,
}: {
  match: Match;
  venues: Venue[];
  teams: Map<string, Team>;
  onClose: () => void;
  onSave: (id: string, iso: string, venueId: string | null) => void;
  pending: boolean;
}) {
  const p = match.scheduled_at ? ectParts(match.scheduled_at) : null;
  const [day, setDay] = useState(p?.day ?? "");
  const [time, setTime] = useState(p ? `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}` : "09:00");
  const [venue, setVenue] = useState(match.venue_id ?? "");
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center" onClick={onClose}>
      <div role="dialog" aria-label="Reprogramar partido" className="w-full max-w-md space-y-4 rounded-2xl bg-surface p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-display text-xl font-extrabold uppercase">
          {teams.get(match.home_team_id)?.short_name} vs {teams.get(match.away_team_id)?.short_name}
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm">
            <span className="mb-1 block font-medium">Fecha</span>
            <input type="date" className={inputCls} value={day} onChange={(e) => setDay(e.target.value)} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium">Hora</span>
            <input type="time" className={inputCls} value={time} onChange={(e) => setTime(e.target.value)} />
          </label>
        </div>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Sede</span>
          <select className={inputCls} value={venue} onChange={(e) => setVenue(e.target.value)}>
            <option value="">Por definir</option>
            {venues.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} ({v.city})
              </option>
            ))}
          </select>
        </label>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={!day || pending}
            onClick={() => {
              const [hh, mm] = time.split(":").map(Number);
              onSave(match.id, isoFromEct(day, hh, mm), venue || null);
            }}
          >
            Guardar
          </Button>
        </div>
      </div>
    </div>
  );
}
