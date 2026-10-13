import { MAX_SUBSTITUTIONS, MAX_TIMEOUTS, currentSet, type MatchState, type Side } from "@/lib/scoresheet";
import { ServeIcon } from "@/components/icons";
import { cx } from "@/components/ui";

export interface ScoreTeam {
  name: string;
  color: string;
}

type Size = "compact" | "default" | "big";

const SCORE: Record<Size, string> = {
  compact: "text-5xl sm:text-7xl",
  default: "text-6xl sm:text-9xl",
  big: "text-[clamp(3.25rem,16vw,17rem)]",
};
const NAME: Record<Size, string> = {
  compact: "text-lg sm:text-xl",
  default: "text-xl sm:text-3xl",
  big: "text-2xl sm:text-5xl",
};

/** Contadores como "pips": llenos = disponibles. */
function Pips({ left, total, label }: { left: number; total: number; label: string }) {
  return (
    <span className="flex items-center gap-1.5" title={`${label}: ${left} de ${total}`}>
      <span className="eyebrow text-[10px] text-white/50">{label}</span>
      <span className="flex gap-0.5" aria-hidden>
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={cx("h-1.5 w-3 rounded-full", i < left ? "bg-white" : "bg-white/20")} />
        ))}
      </span>
      <span className="sr-only">
        {label}: {left} de {total}
      </span>
    </span>
  );
}

/** Marcador: sets, puntos, saque y contadores. Ordena los equipos según el lado de la cancha. */
export function Scoreboard({
  state,
  teams,
  compact,
  size: sizeProp,
}: {
  state: MatchState;
  teams: Record<Side, ScoreTeam>;
  compact?: boolean;
  size?: Size;
}) {
  const size: Size = sizeProp ?? (compact ? "compact" : "default");
  const set = currentSet(state);
  const order: Side[] = state.leftTeam === "A" ? ["A", "B"] : ["B", "A"];
  const lastSet = state.sets[state.sets.length - 1];
  const score = set?.score ?? (state.phase === "finished" || state.phase === "closed" ? lastSet?.score : null) ?? { A: 0, B: 0 };

  return (
    <div className={cx("overflow-hidden bg-black text-white ring-1 ring-white/10", size === "big" ? "rounded-3xl" : "rounded-2xl")}>
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-stretch">
        {order.map((side, i) => {
          const t = teams[side];
          const ts = set?.teams[side];
          const right = i === 1;
          const serving = state.serving === side;
          const block = (
            <div key={side} className="relative flex min-w-0 flex-col">
              <span className="h-1.5 w-full" style={{ background: t.color }} aria-hidden />
              <div className={cx("flex flex-1 flex-col gap-3 p-3 sm:p-6", right && "items-end text-right", size === "big" && "sm:p-10")}>
                <div className={cx("flex min-w-0 items-center gap-2 sm:gap-3", right && "flex-row-reverse")}>
                  <span className={cx("truncate font-display font-extrabold uppercase leading-none tracking-wide", NAME[size])}>{t.name}</span>
                  {serving && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-volt px-1.5 py-0.5 text-black sm:px-2" title="Saque">
                      <ServeIcon size={size === "big" ? 18 : 14} strokeWidth={2.4} />
                      <span className="eyebrow hidden text-[10px] sm:inline">Saque</span>
                    </span>
                  )}
                </div>
                <div className={cx("flex items-end gap-2 sm:gap-4", right && "flex-row-reverse")}>
                  <span
                    key={score[side]}
                    className={cx("score-pop tabular font-display font-extrabold leading-[0.85]", SCORE[size])}
                    aria-label={`${t.name}: ${score[side]} puntos`}
                  >
                    {score[side]}
                  </span>
                  <span className="mb-1 shrink-0 rounded-lg bg-white/10 px-1.5 py-1 text-center font-display sm:mb-2 sm:px-2.5">
                    <span className="eyebrow block text-[10px] text-white/60">Sets</span>
                    <span className={cx("tabular font-extrabold", size === "big" ? "text-2xl sm:text-5xl" : "text-xl sm:text-3xl")}>{state.setsWon[side]}</span>
                  </span>
                </div>
                {ts && (
                  <div className={cx("flex flex-wrap gap-x-4 gap-y-1", right && "justify-end")}>
                    <Pips left={MAX_TIMEOUTS - ts.timeouts} total={MAX_TIMEOUTS} label="Tiempos" />
                    <Pips left={MAX_SUBSTITUTIONS - ts.substitutions} total={MAX_SUBSTITUTIONS} label="Sust." />
                  </div>
                )}
              </div>
            </div>
          );
          return i === 0 ? [block, <Middle key="mid" state={state} order={order} big={size === "big"} />] : block;
        })}
      </div>
    </div>
  );
}

function Middle({ state, order, big }: { state: MatchState; order: Side[]; big: boolean }) {
  const finishedSets = state.sets.filter((s) => s.winner);
  const label =
    state.phase === "finished" || state.phase === "closed"
      ? "Final"
      : state.phase === "playing"
        ? `Set ${state.currentSet}`
        : state.phase === "coin_toss"
          ? "Sorteo"
          : `Previo set ${state.currentSet}`;
  return (
    <div className={cx("flex flex-col items-center justify-center gap-3 border-x border-white/10 px-1.5 py-4 sm:px-5", big && "sm:px-8")}>
      <span className={cx("whitespace-nowrap rounded-full bg-volt px-2 py-1 font-bold uppercase tracking-wider text-black sm:px-3", big ? "text-[11px] sm:text-sm" : "text-[11px]")}>
        {label}
      </span>
      <div className="tabular space-y-1 text-center font-display text-xs text-white/70 sm:text-base">
        {finishedSets.map((s) => (
          <div key={s.no} className="whitespace-nowrap">
            <span className="mr-1 text-white/40 sm:mr-1.5">{s.no}</span>
            <span className={s.winner === order[0] ? "font-bold text-white" : undefined}>{s.score[order[0]]}</span>
            <span className="mx-0.5 text-white/40">-</span>
            <span className={s.winner === order[1] ? "font-bold text-white" : undefined}>{s.score[order[1]]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
