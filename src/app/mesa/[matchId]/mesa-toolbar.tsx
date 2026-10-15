"use client";

import { useEffect, useRef, useState } from "react";
import { PauseIcon, PlayIcon, ResetIcon, SwapIcon, TimeoutIcon } from "@/components/icons";
import { Button, Card, cx } from "@/components/ui";
import { readableOn } from "@/lib/color";
import { currentSet, type MatchEventInput, type MatchSetup, type MatchState, type Side } from "@/lib/scoresheet";

const TIMEOUT_SECONDS = 30;

type Clock = { running: boolean; since: number | null; acc: number };

const STOPPED: Clock = { running: false, since: null, acc: 0 };

const clockKey = (matchId: string) => `mesa-cronometro-${matchId}`;

function loadClock(matchId: string): Clock {
  try {
    const c = JSON.parse(localStorage.getItem(clockKey(matchId)) ?? "null") as Clock | null;
    return c && typeof c.acc === "number" ? c : STOPPED;
  } catch {
    return STOPPED;
  }
}

function storeClock(matchId: string, c: Clock) {
  try {
    localStorage.setItem(clockKey(matchId), JSON.stringify(c));
    return true;
  } catch {
    return false;
  }
}

function formatClock(ms: number) {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

function useNow(active: boolean, every: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), every);
    return () => clearInterval(id);
  }, [active, every]);
  return now;
}

export type Stopwatch = ReturnType<typeof useStopwatch>;

export function useStopwatch(matchId: string) {
  const [clock, setClock] = useState<Clock>(STOPPED);
  useEffect(() => setClock(loadClock(matchId)), [matchId]);
  const now = useNow(clock.running, 500);
  const elapsed = clock.acc + (clock.running && clock.since ? Math.max(0, now - clock.since) : 0);
  const save = (c: Clock) => {
    setClock(c);
    storeClock(matchId, c);
  };
  const toggle = () =>
    clock.running
      ? save({ running: false, since: null, acc: clock.acc + Math.max(0, Date.now() - (clock.since ?? Date.now())) })
      : save({ running: true, since: Date.now(), acc: clock.acc });
  const reset = () => save(STOPPED);
  return { running: clock.running, elapsed, toggle, reset };
}

function useTimeoutCountdown(state: MatchState) {
  const set = currentSet(state);
  const setNo = state.currentSet;
  const a = set?.teams.A.timeouts ?? 0;
  const b = set?.teams.B.timeouts ?? 0;
  const prev = useRef({ setNo, a, b });
  const [active, setActive] = useState<{ team: Side; endsAt: number } | null>(null);

  useEffect(() => {
    const p = prev.current;
    prev.current = { setNo, a, b };
    const endsAt = Date.now() + TIMEOUT_SECONDS * 1000;
    if (p.setNo !== setNo) setActive(null);
    else if (a > p.a) setActive({ team: "A", endsAt });
    else if (b > p.b) setActive({ team: "B", endsAt });
    else if (a < p.a || b < p.b) setActive(null);
  }, [setNo, a, b]);

  const now = useNow(active !== null, 250);
  const remaining = active ? Math.max(0, active.endsAt - now) : 0;
  const done = active !== null && remaining === 0;

  useEffect(() => {
    if (done && typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.([200, 100, 200]);
  }, [done]);

  return { active, remaining, done, dismiss: () => setActive(null) };
}

const tile =
  "flex min-h-20 w-full flex-col items-center justify-center gap-1 rounded-xl border-[1.5px] border-line px-2 py-3 text-sm font-semibold transition hover:border-ink active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40";

export function MesaToolbar({
  stopwatch,
  state,
  setup,
  colors,
  record,
}: {
  stopwatch: Stopwatch;
  state: MatchState;
  setup: MatchSetup;
  colors: Record<Side, string>;
  record: (e: MatchEventInput) => void;
}) {
  const countdown = useTimeoutCountdown(state);
  const [picking, setPicking] = useState(false);

  const playing = state.phase === "playing";
  const set = currentSet(state);
  const { timeoutsPerSet, timeoutsOnlyServing } = state.rules;
  const left = state.leftTeam;
  const right: Side = left === "A" ? "B" : "A";
  const timeoutsLeft = (s: Side) => timeoutsPerSet - (set?.teams[s].timeouts ?? 0);
  const canTimeout = (s: Side) => playing && stopwatch.running && !!set && timeoutsLeft(s) > 0 && !(timeoutsOnlyServing && state.serving !== s);
  const anyTimeout = canTimeout("A") || canTimeout("B");

  useEffect(() => {
    if (!anyTimeout) setPicking(false);
  }, [anyTimeout]);

  const switchSides = () => {
    if (confirm("¿Registrar cambio de cancha? Los equipos intercambian sus lados.")) record({ type: "switch_sides" });
  };

  const resetStopwatch = () => {
    if (confirm("¿Reiniciar el cronómetro a 0:00? Se detiene y no se podrán registrar jugadas hasta iniciarlo de nuevo.")) stopwatch.reset();
  };

  const callTimeout = (s: Side) => {
    setPicking(false);
    record({ type: "timeout", team: s });
  };

  const pct = countdown.active ? (countdown.remaining / (TIMEOUT_SECONDS * 1000)) * 100 : 0;

  return (
    <div className="space-y-3">
      <Card className="space-y-3 p-3">
        <div className="grid grid-cols-3 gap-2">
          <div className="relative">
            <button
              type="button"
              onClick={stopwatch.toggle}
              aria-pressed={stopwatch.running}
              className={cx(
                tile,
                stopwatch.running ? "border-primary bg-primary text-primary-contrast hover:border-primary" : "border-live text-live hover:border-live",
              )}
            >
              <span className="flex items-center gap-1.5">
                {stopwatch.running ? <PauseIcon size={18} /> : <PlayIcon size={18} />}
                {stopwatch.running ? "Cronómetro" : stopwatch.elapsed > 0 ? "Reanudar" : "Iniciar"}
              </span>
              <span className="tabular font-display text-2xl font-extrabold leading-none">{formatClock(stopwatch.elapsed)}</span>
            </button>
            {(stopwatch.elapsed > 0 || stopwatch.running) && (
              <button
                type="button"
                onClick={resetStopwatch}
                aria-label="Reiniciar cronómetro"
                title="Reiniciar cronómetro"
                className="absolute right-1.5 top-1.5 rounded-full bg-surface p-1 text-ink shadow ring-1 ring-line hover:ring-ink"
              >
                <ResetIcon size={14} />
              </button>
            )}
          </div>

          <button type="button" onClick={switchSides} disabled={!stopwatch.running || (!playing && state.phase !== "lineups")} className={tile}>
            <SwapIcon size={22} />
            Cambio de cancha
          </button>

          <button
            type="button"
            onClick={() => setPicking((p) => !p)}
            disabled={!anyTimeout}
            aria-expanded={picking}
            className={cx(tile, picking && "border-ink bg-surface-2")}
          >
            <TimeoutIcon size={22} />
            Tiempo muerto
          </button>
        </div>

        {picking && (
          <div className="grid grid-cols-2 gap-2">
            {[left, right].map((s) => (
              <button
                key={s}
                type="button"
                disabled={!canTimeout(s)}
                onClick={() => callTimeout(s)}
                className="flex flex-col items-center justify-center rounded-xl px-3 py-3 font-semibold shadow transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
                style={{ background: colors[s], color: readableOn(colors[s]) }}
              >
                <span>{setup.teams[s].name}</span>
                <span className="text-xs font-medium opacity-90">
                  {timeoutsOnlyServing && state.serving !== s ? "Sin saque" : `Quedan ${timeoutsLeft(s)}`}
                </span>
              </button>
            ))}
          </div>
        )}
      </Card>

      {countdown.active && (
        <Card role="status" aria-live="polite" className={cx("space-y-3 p-4", countdown.done ? "border-live" : "border-sun")}>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted">Tiempo muerto</p>
              <p className="truncate font-display text-lg font-bold">{setup.teams[countdown.active.team].name}</p>
            </div>
            <span className={cx("tabular font-display text-4xl font-extrabold", countdown.done && "text-live")}>
              {formatClock(countdown.remaining + 999)}
            </span>
            <Button variant={countdown.done ? "primary" : "secondary"} onClick={countdown.dismiss}>
              Reanudar
            </Button>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full bg-sun transition-[width] duration-200" style={{ width: `${pct}%` }} />
          </div>
          {countdown.done && <p className="text-sm font-semibold text-live">Se acabó el tiempo: reanudar el juego.</p>}
        </Card>
      )}
    </div>
  );
}
