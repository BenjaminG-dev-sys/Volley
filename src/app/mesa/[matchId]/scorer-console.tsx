"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Court } from "@/components/court";
import { Scoreboard } from "@/components/scoreboard";
import { Badge, Button, Card, Field, LinkButton, cx, inputCls } from "@/components/ui";
import type { MatchBundle } from "@/lib/data";
import { insforge } from "@/lib/insforge/client";
import { buildSetup, eventToRow, matchPatch, rowToEvent } from "@/lib/match";
import { enqueue, pending as loadPending, remove, type PendingRow } from "@/lib/offline/queue";
import {
  MAX_SUBSTITUTIONS,
  MAX_TIMEOUTS,
  POSITION_LABELS,
  currentSet,
  legalSubstitutes,
  liberoTargets,
  otherSide,
  replayDetailed,
  validateEvent,
  type MatchEventInput,
  type MatchSetup,
  type MatchState,
  type SanctionKind,
  type Side,
} from "@/lib/scoresheet";

type Row = { seq: number; type: string; payload: Record<string, unknown>; created_at?: string };

export function ScorerConsole({ bundle }: { bundle: MatchBundle }) {
  const { match, tournament, home, away } = bundle;
  const setup = useMemo(
    () => buildSetup(tournament.best_of, home, away, bundle.homePlayers, bundle.awayPlayers),
    [tournament.best_of, home, away, bundle.homePlayers, bundle.awayPlayers],
  );
  const colors: Record<Side, string> = { A: home.color_primary, B: away.color_primary };

  const [synced, setSynced] = useState<Row[]>(bundle.events);
  const [queued, setQueued] = useState<PendingRow[]>([]);
  const [online, setOnline] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [selected, setSelected] = useState<{ side: Side; number: number } | null>(null);

  const rows = useMemo(() => {
    const bySeq = new Map<number, Row>();
    for (const r of synced) bySeq.set(r.seq, r);
    for (const r of queued) if (!bySeq.has(r.seq)) bySeq.set(r.seq, r);
    return [...bySeq.values()].sort((a, b) => a.seq - b.seq);
  }, [synced, queued]);
  const { state, undoDepth } = useMemo(
    () => replayDetailed(setup, rows.map((r) => rowToEvent({ ...r, type: r.type as never, created_at: r.created_at ?? "" }))),
    [setup, rows],
  );
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  // Secuencia reservada localmente: evita repetir `seq` con toques muy rápidos antes del re-render.
  const seqRef = useRef(0);
  seqRef.current = Math.max(seqRef.current, rows.reduce((m, r) => Math.max(m, r.seq), 0));

  const showError = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast((t) => (t === msg ? null : t)), 4000);
  }, []);

  // ---------- Sincronización ----------
  const flushing = useRef(false);
  const flush = useCallback(async () => {
    if (flushing.current) return;
    flushing.current = true;
    const db = insforge().database;
    let changed = false;
    try {
      for (const row of await loadPending(match.id)) {
        const { error } = await db.from("match_events").insert([
          { match_id: row.match_id, seq: row.seq, type: row.type, payload: row.payload, client_ts: row.client_ts },
        ]);
        // 23505 = ya existe esa secuencia (reintento de un envío que sí llegó).
        if (error && error.code !== "23505") {
          const isNetwork = !error.code || /fetch|network|Failed/i.test(error.message);
          setOnline(!isNetwork);
          if (!isNetwork) showError(`No se pudo guardar el evento: ${error.message}`);
          break;
        }
        await remove(row);
        setQueued((q) => q.filter((r) => r.seq !== row.seq));
        setSynced((s) => (s.some((r) => r.seq === row.seq) ? s : [...s, row]));
        setOnline(true);
        changed = true;
      }
      if (changed) {
        const { state: latest } = replayDetailed(
          setup,
          rowsRef.current.map((r) => rowToEvent({ ...r, type: r.type as never, created_at: r.created_at ?? "" })),
        );
        const { error } = await db.from("matches").update(matchPatch(latest, match.home_team_id, match.away_team_id)).eq("id", match.id);
        if (error) showError(`Marcador público sin actualizar: ${error.message}`);
      }
    } finally {
      flushing.current = false;
    }
  }, [match.id, match.home_team_id, match.away_team_id, setup, showError]);

  useEffect(() => {
    loadPending(match.id).then((p) => {
      setQueued(p);
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
  }, [match.id, flush]);

  const record = useCallback(
    async (ev: MatchEventInput) => {
      if (ev.type === "undo") {
        if (undoDepth === 0) return;
      } else {
        const err = validateEvent(state, ev, setup);
        if (err) return showError(err);
      }
      const seq = ++seqRef.current;
      const row = eventToRow(match.id, seq, ev) as PendingRow;
      await enqueue(row);
      setQueued((q) => [...q, row]);
      setSelected(null);
      if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(15);
      void flush();
    },
    [state, setup, undoDepth, match.id, flush, showError],
  );

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
            ↶ Deshacer
          </Button>
        </div>
      </div>

      <Scoreboard state={state} teams={{ A: { name: name("A"), color: colors.A }, B: { name: name("B"), color: colors.B } }} compact />

      {state.notice && <div className="rounded-xl bg-accent/20 px-4 py-2 text-center font-semibold">{state.notice}</div>}
      {toast && (
        <div role="alert" className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-lg rounded-xl bg-live px-4 py-3 text-center font-medium text-white shadow-lg">
          {toast}
        </div>
      )}

      {state.phase === "coin_toss" && <TossPanel setup={setup} deciding={state.currentSet === state.bestOf} onSubmit={record} />}
      {state.phase === "lineups" && <LineupsPanel state={state} setup={setup} onSubmit={record} />}
      {state.phase === "playing" && (
        <PlayingPanel
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
  const [positions, setPositions] = useState<number[]>(prev?.starters ?? field.slice(0, 6).map((p) => p.number));
  const [liberos, setLiberos] = useState<number[]>(roster.filter((p) => p.libero).slice(0, 2).map((p) => p.number));

  return (
    <Card className="space-y-4 p-5">
      <h3 className="font-display text-xl font-bold">
        Formación set {state.currentSet}: {setup.teams[side].name}
      </h3>
      <div className="grid grid-cols-3 gap-3">
        {POSITION_LABELS.map((label, i) => (
          <Field key={label} label={`Posición ${label}${i === 0 ? " (saque)" : ""}`}>
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
      <Button className="w-full py-3" onClick={() => onSubmit({ type: "lineup", team: side, positions, liberos })}>
        Confirmar formación
      </Button>
    </Card>
  );
}

// ---------- En juego ----------
function PlayingPanel({
  state,
  setup,
  colors,
  left,
  right,
  selected,
  setSelected,
  record,
}: {
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
  const pointBtn = (s: Side) => (
    <button
      onClick={() => record({ type: "point", team: s })}
      className="flex min-h-28 w-full flex-col items-center justify-center rounded-2xl px-3 py-5 font-display text-white shadow-lg transition active:scale-[0.98]"
      style={{ background: colors[s] }}
    >
      <span className="text-sm uppercase tracking-widest opacity-90">Punto</span>
      <span className="text-2xl font-extrabold sm:text-3xl">{setup.teams[s].name}</span>
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {pointBtn(left)}
        {pointBtn(right)}
      </div>

      <Court
        left={courtTeam(left)}
        right={courtTeam(right)}
        size="lg"
        selected={selected}
        onPlayerClick={(side, number) => setSelected(selected?.side === side && selected.number === number ? null : { side, number })}
      />
      <p className="text-center text-xs text-muted">Toca un jugador en la cancha para sustituirlo, cambiar el líbero o sancionarlo.</p>

      {selected && <PlayerActions state={state} setup={setup} sel={selected} record={record} onClose={() => setSelected(null)} />}

      <div className="grid gap-4 md:grid-cols-2">
        {[left, right].map((s) => (
          <TeamActions key={s} side={s} state={state} setup={setup} record={record} />
        ))}
      </div>
    </div>
  );
}

function TeamActions({ side, state, setup, record }: { side: Side; state: MatchState; setup: MatchSetup; record: (e: MatchEventInput) => void }) {
  const ts = currentSet(state)!.teams[side];
  const confirmPenalty = () => {
    if (confirm(`¿Castigo a ${setup.teams[side].name}? Otorga punto y saque al rival.`)) record({ type: "sanction", team: side, kind: "penalty" });
  };
  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{setup.teams[side].name}</h3>
        <span className="text-xs text-muted">
          Tiempos {MAX_TIMEOUTS - ts.timeouts} · Sust. {MAX_SUBSTITUTIONS - ts.substitutions}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" disabled={ts.timeouts >= MAX_TIMEOUTS} onClick={() => record({ type: "timeout", team: side })}>
          ⏱ Tiempo
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
          🟨 Amonestación
        </Button>
        <Button variant="secondary" onClick={confirmPenalty}>
          🟥 Castigo
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
            <p className="mb-2 text-sm font-medium">Sustitución ({MAX_SUBSTITUTIONS - ts.substitutions} restantes)</p>
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
          🟨 Amonestación
        </Button>
        <Button variant="secondary" onClick={() => sanction("penalty")}>
          🟥 Castigo
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
