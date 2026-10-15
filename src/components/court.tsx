import { POSITION_LABELS, type Side } from "@/lib/scoresheet";
import { cx } from "@/components/ui";
import { ServeIcon } from "@/components/icons";
import { readableOn } from "@/lib/color";

// Media cancha vista desde la mesa. Índices 0..5 = posiciones I..VI.
// Equipo a la izquierda (mira a la derecha): columna delantera junto a la red IV/III/II (arriba→abajo),
// columna zaguera V/VI/I. A la derecha es el espejo.
const LEFT_LAYOUT = [
  [4, 3], // V, IV
  [5, 2], // VI, III
  [0, 1], // I, II
];
const RIGHT_LAYOUT = [
  [1, 0], // II, I
  [2, 5], // III, VI
  [3, 4], // IV, V
];
// Ecuavóley (índices 0..2 = servidor, colocador, volador; -1 = celda vacía):
// el colocador junto a la red, servidor y volador atrás.
const ECUA_LEFT = [
  [2, -1],
  [-1, 1],
  [0, -1],
];
const ECUA_RIGHT = [
  [-1, 0],
  [1, -1],
  [-1, 2],
];

export interface CourtTeam {
  side: Side;
  name: string;
  color: string;
  positions: number[];
  libero?: number | null;
  serving: boolean;
}

export function Court({
  left,
  right,
  onPlayerClick,
  selected,
  size = "md",
  labels = POSITION_LABELS,
}: {
  left: CourtTeam;
  right: CourtTeam;
  onPlayerClick?: (side: Side, number: number, index: number) => void;
  selected?: { side: Side; number: number } | null;
  size?: "md" | "lg";
  /** Nombre de cada posición (I..VI en vóley; Servidor/Colocador/Volador en ecuavóley). */
  labels?: readonly string[];
}) {
  const ecua = left.positions.length === 3;
  return (
    <div className="relative mx-auto grid aspect-[2/1] max-w-3xl grid-cols-2 overflow-hidden rounded-xl border-4 border-court-line bg-court">
      <Half team={left} layout={ecua ? ECUA_LEFT : LEFT_LAYOUT} labels={labels} onPlayerClick={onPlayerClick} selected={selected} size={size} />
      <div className="absolute inset-y-0 left-1/2 w-1 -translate-x-1/2 bg-court-line shadow" aria-hidden />
      <Half team={right} layout={ecua ? ECUA_RIGHT : RIGHT_LAYOUT} labels={labels} onPlayerClick={onPlayerClick} selected={selected} size={size} />
    </div>
  );
}

function Half({
  team,
  layout,
  labels,
  onPlayerClick,
  selected,
  size,
}: {
  team: CourtTeam;
  layout: number[][];
  labels: readonly string[];
  onPlayerClick?: (side: Side, number: number, index: number) => void;
  selected?: { side: Side; number: number } | null;
  size: "md" | "lg";
}) {
  return (
    <div className="grid grid-rows-3 place-items-center p-2 sm:p-3">
      {layout.map((row, r) => (
        <div key={r} className="grid w-full grid-cols-2 place-items-center">
          {row.map((idx, c) => {
            if (idx < 0) return <span key={`empty-${c}`} aria-hidden />;
            const n = team.positions[idx];
            const label = labels[idx] ?? "";
            const short = label.length > 3 ? label.slice(0, 3).toUpperCase() : label;
            const isServer = team.serving && idx === 0;
            const isLibero = team.libero === n;
            const isSel = selected?.side === team.side && selected.number === n;
            const El = onPlayerClick ? "button" : "div";
            return (
              <El
                key={idx}
                type={onPlayerClick ? "button" : undefined}
                onClick={onPlayerClick ? () => onPlayerClick(team.side, n, idx) : undefined}
                className={cx(
                  "relative flex aspect-square flex-col items-center justify-center rounded-full font-display font-bold shadow-md transition",
                  size === "lg" ? "w-14 text-2xl sm:w-20 sm:text-3xl" : "w-11 text-lg sm:w-16 sm:text-2xl",
                  isSel && "ring-4 ring-primary ring-offset-2",
                  onPlayerClick && "hover:scale-105",
                )}
                style={{
                  background: isLibero ? "var(--ink)" : team.color,
                  color: isLibero ? "var(--volt)" : readableOn(team.color),
                                  }}
                aria-label={`${label.length > 3 ? label : `Posición ${label}`}: N.º ${n}${isServer ? ", saca" : ""}${isLibero ? ", líbero" : ""}`}
              >
                {n}
                <span className="text-[10px] font-medium opacity-80">{short}</span>
                {isServer && (
                  <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-volt text-black shadow" title="Saca">
                    <ServeIcon size={13} strokeWidth={2.4} />
                  </span>
                )}
              </El>
            );
          })}
        </div>
      ))}
    </div>
  );
}
