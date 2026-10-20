"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Court } from "@/components/court";
import { Scoreboard } from "@/components/scoreboard";
import { CardIcon, TimeoutIcon, UndoIcon } from "@/components/icons";
import { readableOn } from "@/lib/color";
import { Badge, Button, Card, Field, LinkButton, cx, inputCls } from "@/components/ui";
import { MesaToolbar, useStopwatch } from "./mesa-toolbar";
import type { MatchBundle } from "@/lib/data";
import { insforge } from "@/lib/insforge/client";
import { buildSetup, eventToRow, matchPatch, rowToEvent } from "@/lib/match";
import { enqueue, pending as loadPending, remove, type PendingRow } from "@/lib/offline/queue";
import { fetchMatchEvents, subscribeMatch } from "@/lib/sync/match-channel";
import { maxSeq, mergeRows, renumber, sameEvent, skipsAhead, stableStringify } from "@/lib/sync/rows";
import {
  currentSet,
  legalSubstitutes,
  liberoTargets,
  otherSide,
  replay,
  replayDetailed,
  validateEvent,
  type MatchEventInput,
  type MatchSetup,
  type MatchState,
  type SanctionKind,
  type Side,
} from "@/lib/scoresheet";

type Row = { seq: number; type: string; payload: Record<string, unknown>; created_at?: string };

const toEvents = (rs: Row[]) => rs.map((r) => rowToEvent({ ...r, type: r.type as never, created_at: r.created_at ?? "" }));

const isNetworkError = (e: { code?: string; message: string }) => !e.code || /fetch|network|Failed/i.test(e.message);

export function ScorerConsole({ bundle }: { bundle: MatchBundle }) {
  const { match, tournament, home, away } = bundle;
  const setup = useMemo(
    () => buildSetup(tournament, home, away, bundle.homePlayers, bundle.awayPlayers),
    [tournament, home, away, bundle.homePlayers, bundle.awayPlayers],
  );
  const colors: Record<Side, string> = { A: home.color_primary, B: away.color_primary };

  const stopwatch = useStopwatch(match.id);
  const clockStopped = !stopwatch.running;
  const [synced, setSyncedState] = useState<Row[]>(bundle.events);
  const [queued, setQueuedState] = useState<PendingRow[]>([]);
  const [online, setOnline] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [selected, setSelected] = useState<{ side: Side; number: number } | null>(null);
  /** Acciones locales que chocaron con otro dispositivo y quedaron fuera de la planilla. */
  const [conflict, setConflict] = useState<PendingRow[]>([]);
  /** Evento que el servidor rechazó (no por red): detiene la cola hasta que la mesa decida. */
  const [blocked, setBlockedState] = useState<{ seq: number; message: string } | null>(null);

  // Refs espejo: `flush` corre de forma asíncrona y necesita el valor más reciente, no el del último render.
  const syncedRef = useRef(synced);
  const queuedRef = useRef(queued);
  const blockedRef = useRef(blocked);
  const updateSynced = useCallback((fn: (prev: Row[]) => Row[]) => {
    syncedRef.current = fn(syncedRef.current);
    setSyncedState(syncedRef.current);
  }, []);
  const updateQueued = useCallback((fn: (prev: PendingRow[]) => PendingRow[]) => {
    queuedRef.current = fn(queuedRef.current);
    setQueuedState(queuedRef.current);
  }, []);
  const setBlocked = useCallback((b: { seq: number; message: string } | null) => {
    blockedRef.current = b;
    setBlockedState(b);
  }, []);

  const rows = useMemo(() => {
    const bySeq = new Map<number, Row>();
    for (const r of synced) bySeq.set(r.seq, r);
    for (const r of queued) if (!bySeq.has(r.seq)) bySeq.set(r.seq, r);
    return [...bySeq.values()].sort((a, b) => a.seq - b.seq);
  }, [synced, queued]);
  const { state, undoDepth } = useMemo(() => replayDetailed(setup, toEvents(rows)), [setup, rows]);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  // Secuencia reservada localmente: evita repetir `seq` con toques muy rápidos antes del re-render.
  const seqRef = useRef(0);
  seqRef.current = Math.max(seqRef.current, maxSeq(rows));

  const showError = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast((t) => (t === msg ? null : t)), 4000);
  }, []);

  // ---------- Sincronización ----------
  // Último marcador conocido en `matches`: se reintenta publicar mientras no coincida con la planilla.
  const published = useRef(
    stableStringify({ status: match.status, live_state: match.live_state, result: match.result, winner_team_id: match.winner_team_id }),
  );
  const publishError = useRef<string | null>(null);
  const publish = useCallback(async () => {
    if (!syncedRef.current.length) return;
    const patch = matchPatch(replay(setup, toEvents(syncedRef.current)), match.home_team_id, match.away_team_id);
    const key = stableStringify(patch);
    if (key === published.current) return;
    const { error } = await insforge().database.from("matches").update(patch).eq("id", match.id);
    if (error) {
      if (isNetworkError(error)) return setOnline(false);
      if (publishError.current !== error.message) showError(`Marcador público sin actualizar: ${error.message}`);
      publishError.current = error.message;
      return;
    }
    published.current = key;
    publishError.current = null;
  }, [match.id, match.home_team_id, match.away_team_id, setup, showError]);

  const flushing = useRef(false);
  const flush = useCallback(async () => {
    if (flushing.current) return;
    flushing.current = true;
    const db = insforge().database;
    try {
      for (const row of await loadPending(match.id)) {
        if (blockedRef.current) break;
        const { error } = await db.from("match_events").insert([
          { match_id: row.match_id, seq: row.seq, type: row.type, payload: row.payload, client_ts: row.client_ts },
        ]);
        if (error?.code === "23505") {
          // Ya existe esa secuencia: o es un reintento de un envío que sí llegó, o otro dispositivo la ocupó.
          const server = await fetchMatchEvents(match.id);
          updateSynced((prev) => mergeRows(prev, server));
          const existing = server.find((r) => r.seq === row.seq);
          if (existing && sameEvent(existing, row)) {
            await remove(row);
            updateQueued((q) => q.filter((r) => r.seq !== row.seq));
            continue;
          }
          const local = await loadPending(match.id);
          for (const r of local) await remove(r);
          updateQueued(() => []);
          seqRef.current = maxSeq(server);
          setConflict((c) => [...c, ...local]);
          break;
        }
        if (error) {
          const network = isNetworkError(error);
          setOnline(!network);
          if (!network) setBlocked({ seq: row.seq, message: error.message });
          break;
        }
        await remove(row);
        updateQueued((q) => q.filter((r) => r.seq !== row.seq));
        updateSynced((s) => mergeRows(s, [row]));
        setOnline(true);
      }
      await publish();
    } catch {
      setOnline(false);
    } finally {
      flushing.current = false;
    }
  }, [match.id, publish, setBlocked, updateQueued, updateSynced]);

  useEffect(() => {
    loadPending(match.id).then((p) => {
      updateQueued(() => p);
      if (p.length) flush();
    });
    const goOnline = () => {
      setOnline(true);
      flush();
    };
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    const retry = setInterval(() => flush(), 5000);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      clearInterval(retry);
    };
  }, [match.id, flush, updateQueued]);

  // Eventos de otros dispositivos (u otra pestaña) en el mismo partido.
  useEffect(() => {
    const resync = async () => {
      try {
        const server = await fetchMatchEvents(match.id);
        updateSynced((prev) => mergeRows(prev, server));
      } catch {
        // Sin red: el próximo `connect` vuelve a intentarlo.
      }
    };
    return subscribeMatch(match.id, {
      onEvent: (row) => {
        const gap = skipsAhead(syncedRef.current, row.seq);
        updateSynced((prev) => mergeRows(prev, [row]));
        if (gap) void resync();
      },
      onConnect: () => void resync(),
    });
  }, [match.id, updateSynced]);

  const record = useCallback(
    async (ev: MatchEventInput) => {
      if (ev.type === "undo") {
        if (undoDepth === 0) return;
      } else {
        if (clockStopped && (state.phase === "playing" || ev.type === "switch_sides"))
          return showError("El cronómetro está detenido: inícialo para registrar jugadas.");
        const err = validateEvent(state, ev, setup);
        if (err) return showError(err);
      }
      const seq = ++seqRef.current;
      const row = eventToRow(match.id, seq, ev) as PendingRow;
      await enqueue(row);
      updateQueued((q) => [...q, row]);
      setSelected(null);
      if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(15);
      void flush();
    },
    [state, setup, undoDepth, clockStopped, match.id, flush, showError, updateQueued],
  );

  /** Vuelve a encolar las acciones en conflicto al final de la planilla, omitiendo las que ya no son válidas. */
  const reapplyConflict = useCallback(async () => {
    const after = Math.max(seqRef.current, maxSeq(rowsRef.current));
    const candidates = renumber(conflict, after);
    const { rejected } = replayDetailed(setup, toEvents([...rowsRef.current, ...candidates]));
    const bad = new Set(rejected.map((r) => r.seq));
    const keep = renumber(
      candidates.filter((r) => !bad.has(r.seq)),
      after,
    ).map((r) => ({ ...r, client_ts: new Date().toISOString() }));
    for (const r of keep) await enqueue(r);
    seqRef.current = after + keep.length;
    updateQueued((q) => [...q, ...keep]);
    setConflict([]);
    if (keep.length < candidates.length)
      showError(`${candidates.length - keep.length} acción(es) ya no eran válidas y se omitieron.`);
    void flush();
  }, [conflict, setup, flush, showError, updateQueued]);

  const retryBlocked = useCallback(() => {
    setBlocked(null);
    void flush();
  }, [flush, setBlocked]);

  const discardBlocked = useCallback(async () => {
    const b = blockedRef.current;
    if (!b) return;
    await remove({ match_id: match.id, seq: b.seq });
    updateQueued((q) => q.filter((r) => r.seq !== b.seq));
    setBlocked(null);
    void flush();
  }, [match.id, flush, setBlocked, updateQueued]);

  // ---------- UI ----------
  const left = state.leftTeam;
  const right = otherSide(left);
  const name = (s: Side) => setup.teams[s].name;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <Link href="/mesa" className="text-muted hover:underline">
          ← Mesa de control
        </Link>
        <div className="flex items-center gap-2">
          <Badge tone={online ? "ok" : "live"}>{online ? "En línea" : "Sin conexión"}</Badge>
          {queued.length > 0 && <Badge tone="accent">{queued.length} por sincronizar</Badge>}
          <LinkButton variant="secondary" href={`/partidos/${match.id}/en-vivo`} target="_blank">
            Marcador público ↗
          </LinkButton>
          <Button variant="secondary" onClick={() => record({ type: "undo" })} disabled={undoDepth === 0}>
            <UndoIcon size={16} /> Deshacer
          </Button>
        </div>
      </div>

      {conflict.length > 0 && (
        <Card role="alert" className="space-y-3 border-live p-4">
          <p className="text-sm">
            <strong>Otro dispositivo registró acciones en este partido.</strong> {conflict.length} acción(es) de esta mesa
            quedaron fuera de la planilla. Revisa el marcador antes de decidir.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={reapplyConflict}>Reaplicar al final</Button>
            <Button variant="secondary" onClick={() => setConflict([])}>
              Descartar
            </Button>
          </div>
        </Card>
      )}
      {blocked && (
        <Card role="alert" className="space-y-3 border-live p-4">
          <p className="text-sm">
            <strong>El servidor rechazó una acción:</strong> {blocked.message}. Las siguientes quedan en espera.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={retryBlocked}>Reintentar</Button>
            <Button variant="secondary" onClick={discardBlocked}>
              Descartar esa acción
            </Button>
          </div>
        </Card>
      )}

      <Scoreboard state={state} teams={{ A: { name: name("A"), color: colors.A }, B: { name: name("B"), color: colors.B } }} compact />

      {state.notice && <div className="rounded-xl bg-sun px-4 py-2 text-center font-semibold text-black">{state.notice}</div>}
      {toast && (
        <div role="alert" className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-lg rounded-xl bg-live px-4 py-3 text-center font-medium text-white shadow-lg">
          {toast}
        </div>
      )}

      {(state.phase === "lineups" || state.phase === "playing") && (
        <MesaToolbar stopwatch={stopwatch} state={state} setup={setup} colors={colors} record={record} />
      )}

      {state.phase === "coin_toss" && <TossPanel setup={setup} deciding={state.currentSet === state.bestOf} onSubmit={record} />}
      {state.phase === "lineups" && <LineupsPanel state={state} setup={setup} onSubmit={record} />}
      {state.phase === "playing" && clockStopped && (
        <Card role="alert" className="flex flex-wrap items-center justify-between gap-3 border-live p-4">
          <p className="text-sm">
            <strong>Juego bloqueado.</strong> El cronómetro está detenido: no se registran puntos, tiempos, sustituciones ni sanciones.
          </p>
          <Button onClick={stopwatch.toggle}>{stopwatch.elapsed > 0 ? "Reanudar cronómetro" : "Iniciar cronómetro"}</Button>
        </Card>
      )}
      {state.phase === "playing" && (
        <PlayingPanel
          locked={clockStopped}
          state={state}
          setup={setup}
          colors={colors}
          left={left}
          right={right}
          selected={selected}
          setSelected={setSelected}
          record={record}
        />
      )}
      {state.phase === "finished" && <ClosePanel setup={setup} state={state} onSubmit={record} />}
      {state.phase === "closed" && (
        <Card className="p-6 text-center">
          <h2 className="font-display text-2xl font-bold">Planilla cerrada</h2>
          <p className="text-muted">El resultado ya cuenta en la tabla de posiciones.</p>
          <LinkButton className="mt-4" href={`/partidos/${match.id}/planilla`}>
            Ver planilla final
          </LinkButton>
        </Card>
      )}

      <Card className="p-4">
        <h3 className="mb-2 text-sm font-semibold">Últimas acciones</h3>
        <ol className="space-y-1 text-sm">
          {[...state.log].reverse().slice(0, 6).map((l, i) => (
            <li key={`${l.seq}-${i}`} className={cx("flex justify-between gap-3", i > 0 && "text-muted")}>
              <span>{l.text}</span>
              <span className="tabular text-xs">
                S{l.set} {l.score.A}-{l.score.B}
              </span>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}

// ---------- Sorteo ----------
function TossPanel({ setup, deciding, onSubmit }: { setup: MatchSetup; deciding: boolean; onSubmit: (e: MatchEventInput) => void }) {
  const [serving, setServing] = useState<Side>("A");
  const [leftTeam, setLeftTeam] = useState<Side>("A");
  const opt = (s: Side) => (
    <option key={s} value={s}>
      {setup.teams[s].name}
    </option>
  );
  return (
    <Card className="mx-auto max-w-xl space-y-4 p-6">
      <h2 className="font-display text-2xl font-bold">{deciding ? "Sorteo del set decisivo" : "Sorteo inicial"}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Saca primero">
          <select className={inputCls} value={serving} onChange={(e) => setServing(e.target.value as Side)}>
            {(["A", "B"] as Side[]).map(opt)}
          </select>
        </Field>
        <Field label="A la izquierda de la mesa">
          <select className={inputCls} value={leftTeam} onChange={(e) => setLeftTeam(e.target.value as Side)}>
            {(["A", "B"] as Side[]).map(opt)}
          </select>
        </Field>
      </div>
      <Button className="w-full py-3" onClick={() => onSubmit({ type: "coin_toss", serving, leftTeam })}>
        Registrar sorteo
      </Button>
    </Card>
  );
}

// ---------- Formación inicial ----------
function LineupsPanel({ state, setup, onSubmit }: { state: MatchState; setup: MatchSetup; onSubmit: (e: MatchEventInput) => void }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {(["A", "B"] as Side[]).map((s) =>
        state.pendingLineups[s] ? (
          <Card key={s} className="grid place-items-center p-6 text-center">
            <div>
              <Badge tone="ok">Formación registrada</Badge>
              <p className="mt-2 font-semibold">{setup.teams[s].name}</p>
              <p className="tabular text-sm text-muted">{state.pendingLineups[s]!.positions.join(" · ")}</p>
            </div>
          </Card>
        ) : (
          <LineupEditor key={s} side={s} state={state} setup={setup} onSubmit={onSubmit} />
        ),
      )}
    </div>
  );
}

function LineupEditor({ side, state, setup, onSubmit }: { side: Side; state: MatchState; setup: MatchSetup; onSubmit: (e: MatchEventInput) => void }) {
  const roster = setup.teams[side].players;
  const prev = state.sets[state.sets.length - 1]?.teams[side];
  const field = roster.filter((p) => !p.libero && !state.disqualified[side].includes(p.number));
  const { playersOnCourt, positionLabels, rotation, liberos: maxLiberos } = state.rules;
  const [positions, setPositions] = useState<number[]>(prev?.starters ?? field.slice(0, playersOnCourt).map((p) => p.number));
  const [liberos, setLiberos] = useState<number[]>(roster.filter((p) => p.libero).slice(0, maxLiberos).map((p) => p.number));

  return (
    <Card className="space-y-4 p-5">
      <h3 className="font-display text-xl font-bold">
        Formación set {state.currentSet}: {setup.teams[side].name}
      </h3>
      <div className="grid grid-cols-3 gap-3">
        {positionLabels.map((label, i) => (
          <Field key={label} label={rotation ? `Posición ${label}${i === 0 ? " (saque)" : ""}` : `${label}${i === 0 ? " (saca)" : ""}`}>
            <select
              className={inputCls}
              value={positions[i]}
              onChange={(e) => setPositions((p) => p.map((n, j) => (j === i ? Number(e.target.value) : n)))}
            >
              {field.map((p) => (
                <option key={p.number} value={p.number}>
                  {p.number} · {p.name}
                </option>
              ))}
            </select>
          </Field>
        ))}
      </div>
      {maxLiberos > 0 && (
      <div className="flex flex-wrap gap-3 text-sm">
        <span className="font-medium">Líberos:</span>
        {roster
          .filter((p) => p.libero)
          .map((p) => (
            <label key={p.number} className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={liberos.includes(p.number)}
                onChange={(e) => setLiberos((l) => (e.target.checked ? [...l, p.number] : l.filter((x) => x !== p.number)))}
              />
              {p.number} · {p.name}
            </label>
          ))}
      </div>
      )}
      <Button className="w-full py-3" onClick={() => onSubmit({ type: "lineup", team: side, positions, liberos: maxLiberos > 0 ? liberos : [] })}>
        Confirmar formación
      </Button>
    </Card>
  );
}

// ---------- En juego ----------
function PlayingPanel({
  locked,
  state,
  setup,
  colors,
  left,
  right,
  selected,
  setSelected,
  record,
}: {
  locked: boolean;
  state: MatchState;
  setup: MatchSetup;
  colors: Record<Side, string>;
  left: Side;
  right: Side;
  selected: { side: Side; number: number } | null;
  setSelected: (s: { side: Side; number: number } | null) => void;
  record: (e: MatchEventInput) => void;
}) {
  const set = currentSet(state)!;
  const courtTeam = (s: Side) => ({
    side: s,
    name: setup.teams[s].name,
    color: colors[s],
    positions: set.teams[s].positions,
    libero: set.teams[s].liberoOnCourt?.libero ?? null,
    serving: state.serving === s,
  });
  // Con cambio de saque, ganar la jugada sin tener el saque solo lo recupera.
  const winsServeOnly = (s: Side) => state.rules.scoring === "sideout" && state.serving !== s;
  const pointBtn = (s: Side) => (
    <button
      onClick={() => record({ type: "point", team: s })}
      className="flex min-h-28 w-full flex-col items-center justify-center rounded-2xl px-3 py-5 font-display shadow-lg transition active:scale-[0.98]"
      style={{ background: colors[s], color: readableOn(colors[s]) }}
    >
      <span className="text-sm uppercase tracking-widest opacity-90">{winsServeOnly(s) ? "Gana la jugada · cambio" : "Punto"}</span>
      <span className="text-2xl font-extrabold sm:text-3xl">{setup.teams[s].name}</span>
    </button>
  );

  return (
    <fieldset disabled={locked} aria-disabled={locked} className={cx("min-w-0 space-y-4", locked && "pointer-events-none select-none opacity-40 grayscale")}>
      <div className="grid grid-cols-2 gap-4">
        {pointBtn(left)}
        {pointBtn(right)}
      </div>

      <Court
        left={courtTeam(left)}
        right={courtTeam(right)}
        size="lg"
        labels={state.rules.positionLabels}
        selected={selected}
        onPlayerClick={(side, number) => setSelected(selected?.side === side && selected.number === number ? null : { side, number })}
      />
      <p className="text-center text-xs text-muted">
        Toca un jugador en la cancha para sustituirlo{state.rules.liberos > 0 ? ", cambiar el líbero" : ""} o sancionarlo.
      </p>

      {selected && <PlayerActions state={state} setup={setup} sel={selected} record={record} onClose={() => setSelected(null)} />}

      <div className="grid gap-4 md:grid-cols-2">
        {[left, right].map((s) => (
          <TeamActions key={s} side={s} state={state} setup={setup} record={record} />
        ))}
      </div>
    </fieldset>
  );
}

function TeamActions({ side, state, setup, record }: { side: Side; state: MatchState; setup: MatchSetup; record: (e: MatchEventInput) => void }) {
  const ts = currentSet(state)!.teams[side];
  const { timeoutsPerSet, maxSubstitutions, timeoutsOnlyServing, scoring } = state.rules;
  const timeoutBlocked = ts.timeouts >= timeoutsPerSet || (timeoutsOnlyServing && state.serving !== side);
  const confirmPenalty = () => {
    const effect = scoring === "sideout" ? "Otorga la jugada al rival." : "Otorga punto y saque al rival.";
    if (confirm(`¿Castigo a ${setup.teams[side].name}? ${effect}`)) record({ type: "sanction", team: side, kind: "penalty" });
  };
  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{setup.teams[side].name}</h3>
        <span className="text-xs text-muted">
          Tiempos {timeoutsPerSet - ts.timeouts} · Sust. {maxSubstitutions - ts.substitutions}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          disabled={timeoutBlocked}
          title={timeoutsOnlyServing && state.serving !== side ? "Solo pide tiempo el equipo que tiene el saque" : undefined}
          onClick={() => record({ type: "timeout", team: side })}
        >
          <TimeoutIcon size={16} /> Tiempo
        </Button>
        {ts.liberoOnCourt && (
          <Button variant="secondary" onClick={() => record({ type: "libero_out", team: side })}>
            Sale líbero {ts.liberoOnCourt.libero}
          </Button>
        )}
        <Button variant="secondary" onClick={() => record({ type: "sanction", team: side, kind: "delay" })}>
          Retraso
        </Button>
        <Button variant="secondary" onClick={() => record({ type: "sanction", team: side, kind: "warning" })}>
          <CardIcon color="#ffd100" /> Amonestación
        </Button>
        <Button variant="secondary" onClick={confirmPenalty}>
          <CardIcon color="#d0002a" /> Castigo
        </Button>
      </div>
    </Card>
  );
}

function PlayerActions({
  state,
  setup,
  sel,
  record,
  onClose,
}: {
  state: MatchState;
  setup: MatchSetup;
  sel: { side: Side; number: number };
  record: (e: MatchEventInput) => void;
  onClose: () => void;
}) {
  const ts = currentSet(state)!.teams[sel.side];
  const player = setup.teams[sel.side].players.find((p) => p.number === sel.number);
  const isLiberoOnCourt = ts.liberoOnCourt?.libero === sel.number;
  const subs = isLiberoOnCourt ? [] : legalSubstitutes(state, setup, sel.side, sel.number);
  const liberoOptions = isLiberoOnCourt
    ? []
    : ts.liberos.filter((l) => liberoTargets(state, setup, sel.side, l).includes(sel.number));
  const sanction = (kind: SanctionKind) => {
    const label = { warning: "amonestación", penalty: "castigo", expulsion: "expulsión", disqualification: "descalificación", delay: "retraso" }[kind];
    if (kind !== "warning" && !confirm(`¿Confirmar ${label} al N.º ${sel.number}?`)) return;
    record({ type: "sanction", team: sel.side, kind, player: sel.number });
  };

  return (
    <Card className="space-y-4 border-primary p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">
          N.º {sel.number} · {player?.name} <span className="text-muted">({setup.teams[sel.side].name})</span>
        </h3>
        <Button variant="ghost" onClick={onClose} aria-label="Cerrar">
          ✕
        </Button>
      </div>

      {isLiberoOnCourt ? (
        <Button onClick={() => record({ type: "libero_out", team: sel.side })}>Sale el líbero (vuelve {ts.liberoOnCourt!.replaced})</Button>
      ) : (
        <>
          <div>
            <p className="mb-2 text-sm font-medium">Sustitución ({state.rules.maxSubstitutions - ts.substitutions} restantes)</p>
            <div className="flex flex-wrap gap-2">
              {subs.map((n) => (
                <Button key={n} variant="secondary" onClick={() => record({ type: "substitution", team: sel.side, out: sel.number, in: n })}>
                  Entra {n} · {setup.teams[sel.side].players.find((p) => p.number === n)?.name}
                </Button>
              ))}
              {!subs.length && <span className="text-sm text-muted">No hay sustituciones legales para este jugador.</span>}
            </div>
          </div>
          {liberoOptions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {liberoOptions.map((l) => (
                <Button key={l} variant="secondary" onClick={() => record({ type: "libero_in", team: sel.side, libero: l, replaced: sel.number })}>
                  Entra líbero {l}
                </Button>
              ))}
            </div>
          )}
        </>
      )}

      <div className="flex flex-wrap gap-2 border-t border-line pt-3">
        <Button variant="secondary" onClick={() => sanction("warning")}>
          <CardIcon color="#ffd100" /> Amonestación
        </Button>
        <Button variant="secondary" onClick={() => sanction("penalty")}>
          <CardIcon color="#d0002a" /> Castigo
        </Button>
        <Button variant="secondary" onClick={() => sanction("expulsion")}>
          Expulsión
        </Button>
        <Button variant="danger" onClick={() => sanction("disqualification")}>
          Descalificación
        </Button>
      </div>
    </Card>
  );
}

// ---------- Cierre ----------
function ClosePanel({ setup, state, onSubmit }: { setup: MatchSetup; state: MatchState; onSubmit: (e: MatchEventInput) => void }) {
  const captain = (s: Side) => setup.teams[s].players.find((p) => p.captain)?.name ?? "";
  const [captainA, setA] = useState(captain("A"));
  const [captainB, setB] = useState(captain("B"));
  const [referee, setRef] = useState("");
  const [ok, setOk] = useState(false);
  const w = state.winner!;
  return (
    <Card className="mx-auto max-w-xl space-y-4 p-6">
      <h2 className="font-display text-2xl font-bold">
        Gana {setup.teams[w].name} {state.setsWon[w]}-{state.setsWon[otherSide(w)]}
      </h2>
      <p className="text-sm text-muted">Revisa la planilla con los capitanes y el 1.er árbitro antes de cerrarla.</p>
      <Field label={`Capitán(a) ${setup.teams.A.name}`}>
        <input className={inputCls} value={captainA} onChange={(e) => setA(e.target.value)} />
      </Field>
      <Field label={`Capitán(a) ${setup.teams.B.name}`}>
        <input className={inputCls} value={captainB} onChange={(e) => setB(e.target.value)} />
      </Field>
      <Field label="1.er árbitro">
        <input className={inputCls} value={referee} onChange={(e) => setRef(e.target.value)} />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} /> Los firmantes confirman el resultado.
      </label>
      <Button className="w-full py-3" disabled={!ok} onClick={() => onSubmit({ type: "close", captainA, captainB, referee })}>
        Cerrar y firmar planilla
      </Button>
    </Card>
  );
}
