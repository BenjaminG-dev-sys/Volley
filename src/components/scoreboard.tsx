import { MAX_SUBSTITUTIONS, MAX_TIMEOUTS, currentSet, type MatchState, type Side } from "@/lib/scoresheet";
import { cx } from "@/components/ui";

export interface ScoreTeam {
  name: string;
  color: string;
}

/** Marcador grande: sets, puntos, saque y contadores. Ordena los equipos según el lado de la cancha. */
export function Scoreboard({ state, teams, compact }: { state: MatchState; teams: Record<Side, ScoreTeam>; compact?: boolean }) {
  const set = currentSet(state);
  const order: Side[] = state.leftTeam === "A" ? ["A", "B"] : ["B", "A"];
  const lastSet = state.sets[state.sets.length - 1];
  const score = set?.score ?? (state.phase === "finished" || state.phase === "closed" ? lastSet?.score : null) ?? { A: 0, B: 0 };

  return (
    <div className="overflow-hidden rounded-2xl bg-[#0b1020] text-white shadow-lg">
      <div className="grid grid-cols-[1fr_auto_1fr] items-stretch">
        {order.map((side, i) => {
          const t = teams[side];
          const ts = set?.teams[side];
          const block = (
            <div key={side} className={cx("flex flex-col gap-2 p-4 sm:p-6", i === 1 && "items-end text-right")}>
              <div className={cx("flex items-center gap-2", i === 1 && "flex-row-reverse")}>
                <span className="h-4 w-4 rounded-full ring-2 ring-white/30" style={{ background: t.color }} />
                <span className={cx("font-display font-bold uppercase tracking-wide", compact ? "text-lg" : "text-xl sm:text-3xl")}>{t.name}</span>
                {state.serving === side && <span title="Saque" className="text-lg">🏐</span>}
              </div>
              <div className={cx("flex items-end gap-4", i === 1 && "flex-row-reverse")}>
                <span className={cx("tabular font-display font-extrabold leading-none", compact ? "text-6xl" : "text-7xl sm:text-9xl")}>
                  {score[side]}
                </span>
                <span className="mb-2 rounded-md bg-white/10 px-2 py-1 text-center font-display">
                  <span className="block text-[10px] uppercase tracking-widest text-white/60">Sets</span>
                  <span className="tabular text-2xl font-bold sm:text-3xl">{state.setsWon[side]}</span>
                </span>
              </div>
              {ts && (
                <div className={cx("flex gap-3 text-xs text-white/70", i === 1 && "flex-row-reverse")}>
                  <span>Tiempos {MAX_TIMEOUTS - ts.timeouts}/{MAX_TIMEOUTS}</span>
                  <span>Sust. {MAX_SUBSTITUTIONS - ts.substitutions}/{MAX_SUBSTITUTIONS}</span>
                </div>
              )}
            </div>
          );
          return i === 0 ? [block, <Middle key="mid" state={state} order={order} />] : block;
        })}
      </div>
    </div>
  );
}

function Middle({ state, order }: { state: MatchState; order: Side[] }) {
  const finishedSets = state.sets.filter((s) => s.winner);
  const label =
    state.phase === "finished" || state.phase === "closed"
      ? "Final"
      : state.phase === "playing"
        ? `Set ${state.currentSet}`
        : state.phase === "coin_toss"
          ? "Sorteo"
          : `Antes del set ${state.currentSet}`;
  return (
    <div className="flex flex-col items-center justify-center gap-2 border-x border-white/10 px-2 py-4 sm:px-4">
      <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest">{label}</span>
      <div className="tabular space-y-0.5 text-center text-xs text-white/70">
        {finishedSets.map((s) => (
          <div key={s.no}>
            {s.no}: {s.score[order[0]]}-{s.score[order[1]]}
          </div>
        ))}
      </div>
    </div>
  );
}
