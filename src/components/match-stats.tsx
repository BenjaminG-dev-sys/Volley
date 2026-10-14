"use client";

import { useMemo, useState } from "react";
import { Card, CardHeader, cx } from "@/components/ui";
import { distinctPair } from "@/lib/color";
import type { MatchState, Side } from "@/lib/scoresheet";
import { type SetFlow, matchStats } from "@/lib/stats/match";

export interface StatsTeam {
  name: string;
  color: string;
}

/** Estadísticas del partido: comparación por equipo y evolución del marcador por set. */
export function MatchStats({ state, teams }: { state: MatchState; teams: Record<Side, StatsTeam> }) {
  const stats = useMemo(() => matchStats(state), [state]);
  const [colorA, colorB] = distinctPair(teams.A.color, teams.B.color);
  const colors: Record<Side, string> = { A: colorA, B: colorB };
  const sideout = state.rules.scoring === "sideout";
  if (!state.sets.length) return null;

  const { A, B } = stats.teams;
  const rows: { label: string; a: number; b: number; hint?: string }[] = [
    { label: "Puntos", a: A.points, b: B.points },
    { label: "Puntos en saque", a: A.serve, b: B.serve },
    sideout
      ? { label: "Cambios de saque", a: A.sideouts, b: B.sideouts, hint: "Jugadas ganadas sin saque: recuperan el saque, no suman" }
      : { label: "Puntos en recepción", a: A.receive, b: B.receive },
    { label: "Racha máxima", a: A.bestRun, b: B.bestRun, hint: "Puntos seguidos en un set" },
    { label: "Puntos por castigo del rival", a: A.bySanction, b: B.bySanction },
    { label: "Tiempos", a: A.timeouts, b: B.timeouts },
    { label: "Sustituciones", a: A.substitutions, b: B.substitutions },
  ];

  return (
    <Card className="overflow-hidden">
      <CardHeader title="Estadísticas del partido" sub="Calculadas con la planilla, jugada a jugada" />
      <div className="grid gap-8 p-4 sm:p-5 lg:grid-cols-[2fr_3fr]">
        <div>
          <div className="mb-4 flex items-center justify-between gap-3 text-sm font-semibold">
            <TeamKey name={teams.A.name} color={colors.A} />
            <TeamKey name={teams.B.name} color={colors.B} right />
          </div>
          <dl className="space-y-4">
            {rows.map((r) => (
              <CompareRow key={r.label} {...r} colors={colors} names={{ A: teams.A.name, B: teams.B.name }} />
            ))}
          </dl>
          {(A.topServer || B.topServer) && (
            <p className="mt-5 text-xs text-muted">
              Mejor sacador:{" "}
              {(["A", "B"] as Side[])
                .filter((s) => stats.teams[s].topServer)
                .map((s) => `${teams[s].name} N.º ${stats.teams[s].topServer!.number} (${stats.teams[s].topServer!.points} pts)`)
                .join(" · ")}
            </p>
          )}
        </div>
        <ScoreFlow flows={stats.flows} teams={teams} colors={colors} />
      </div>
    </Card>
  );
}

function TeamKey({ name, color, right }: { name: string; color: string; right?: boolean }) {
  return (
    <span className={cx("flex items-center gap-2", right && "flex-row-reverse")}>
      <span className="h-3 w-3 rounded-sm" style={{ background: color }} aria-hidden />
      {name}
    </span>
  );
}

function CompareRow({
  label,
  a,
  b,
  hint,
  colors,
  names,
}: {
  label: string;
  a: number;
  b: number;
  hint?: string;
  colors: Record<Side, string>;
  names: Record<Side, string>;
}) {
  const total = a + b;
  return (
    <div>
      <div className="mb-1.5 grid grid-cols-[3rem_1fr_3rem] items-baseline text-sm">
        <dd className="tabular font-display text-xl font-extrabold">{a}</dd>
        <dt className="text-center text-xs text-muted" title={hint}>
          {label}
        </dt>
        <dd className="tabular text-right font-display text-xl font-extrabold">{b}</dd>
      </div>
      <div className="flex h-2 gap-[2px]" role="img" aria-label={`${label}: ${names.A} ${a}, ${names.B} ${b}`}>
        {total === 0 ? (
          <span className="flex-1 rounded bg-surface-2" />
        ) : (
          <>
            {a > 0 && <span className="rounded" style={{ flexGrow: a, background: colors.A }} title={`${names.A}: ${a}`} />}
            {b > 0 && <span className="rounded" style={{ flexGrow: b, background: colors.B }} title={`${names.B}: ${b}`} />}
          </>
        )}
      </div>
    </div>
  );
}

const W = 600;
const H = 220;
const PAD = { top: 8, right: 8, bottom: 8, left: 8 };

/** Gráfico de ventaja: arriba lidera el equipo A, abajo el B. */
function ScoreFlow({ flows, teams, colors }: { flows: SetFlow[]; teams: Record<Side, StatsTeam>; colors: Record<Side, string> }) {
  // Sin selección sigue el último set (útil en vivo cuando empieza un set nuevo).
  const [picked, setPicked] = useState<number | null>(null);
  const setIdx = picked ?? flows.length - 1;
  const [hover, setHover] = useState<number | null>(null);
  const flow = flows[Math.min(setIdx, flows.length - 1)];
  const pts = flow.points;
  const maxLead = Math.max(3, ...pts.map((p) => Math.abs(p.lead)));
  const x = (i: number) => PAD.left + (i / Math.max(1, pts.length - 1)) * (W - PAD.left - PAD.right);
  const y = (lead: number) => PAD.top + ((maxLead - lead) / (2 * maxLead)) * (H - PAD.top - PAD.bottom);
  const zero = y(0);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.lead).toFixed(1)}`).join("");
  const area = `${line}L${x(pts.length - 1).toFixed(1)},${zero}L${x(0).toFixed(1)},${zero}Z`;
  const clipId = `flow-${flow.no}`;
  const h = hover !== null ? pts[hover] : null;

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const rel = ((e.clientX - box.left) / box.width) * W;
    const i = Math.round(((rel - PAD.left) / (W - PAD.left - PAD.right)) * (pts.length - 1));
    setHover(Math.max(0, Math.min(pts.length - 1, i)));
  };
  const leader = (p: { lead: number }) => (p.lead > 0 ? `${teams.A.name} +${p.lead}` : p.lead < 0 ? `${teams.B.name} +${-p.lead}` : "Empate");

  return (
    <div className="min-w-0">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-base font-bold uppercase tracking-wide">Evolución del marcador</h3>
        <div className="flex gap-1" role="tablist" aria-label="Set">
          {flows.map((f, i) => (
            <button
              key={f.no}
              role="tab"
              aria-selected={i === setIdx}
              onClick={() => {
                setPicked(i === flows.length - 1 ? null : i);
                setHover(null);
              }}
              className={cx(
                "rounded-full px-3 py-1 text-xs font-semibold transition",
                i === setIdx ? "bg-ink text-bg" : "border border-line hover:border-ink",
              )}
            >
              Set {f.no}
            </button>
          ))}
        </div>
      </div>
      <p className="mb-1 flex items-center gap-1.5 text-xs text-muted">
        <span className="h-2.5 w-2.5 rounded-sm" style={{ background: colors.A }} aria-hidden />▲ {teams.A.name} adelante (hasta +{maxLead})
      </p>
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="h-44 w-full sm:h-56"
          role="img"
          aria-label={`Ventaja en el set ${flow.no}`}
        >
          <defs>
            <clipPath id={`${clipId}-up`}>
              <rect x="0" y="0" width={W} height={zero} />
            </clipPath>
            <clipPath id={`${clipId}-down`}>
              <rect x="0" y={zero} width={W} height={H - zero} />
            </clipPath>
          </defs>
          {[maxLead, -maxLead].map((v) => (
            <line key={v} x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} stroke="currentColor" strokeOpacity={0.08} vectorEffect="non-scaling-stroke" />
          ))}
          <path d={area} fill={colors.A} fillOpacity={0.35} clipPath={`url(#${clipId}-up)`} />
          <path d={area} fill={colors.B} fillOpacity={0.35} clipPath={`url(#${clipId}-down)`} />
          <line x1={PAD.left} x2={W - PAD.right} y1={zero} y2={zero} stroke="currentColor" strokeOpacity={0.35} vectorEffect="non-scaling-stroke" />
          <path
            d={line}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          {h && hover !== null && (
            <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={H - PAD.bottom} stroke="currentColor" strokeOpacity={0.3} vectorEffect="non-scaling-stroke" />
          )}
          <rect
            x={0}
            y={0}
            width={W}
            height={H}
            fill="transparent"
            onPointerMove={onMove}
            onPointerDown={onMove}
            onPointerLeave={() => setHover(null)}
          />
        </svg>
        {h && hover !== null && (
          <span
            className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-ink"
            style={{ left: `${(x(hover) / W) * 100}%`, top: `${(y(h.lead) / H) * 100}%` }}
            aria-hidden
          />
        )}
        {h && hover !== null && (
          <div
            className="pointer-events-none absolute top-2 rounded-lg bg-ink px-3 py-2 text-xs text-bg shadow-lg"
            style={{ left: `${(x(hover) / W) * 100}%`, transform: `translateX(${hover > pts.length / 2 ? "-105%" : "5%"})` }}
          >
            <div className="font-semibold">{hover === 0 ? "Inicio del set" : `Punto ${hover}`}</div>
            <div className="tabular">
              {teams.A.name} {h.A} – {h.B} {teams.B.name}
            </div>
            <div className="opacity-70">{leader(h)}</div>
          </div>
        )}
      </div>
      <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
        <span className="h-2.5 w-2.5 rounded-sm" style={{ background: colors.B }} aria-hidden />▼ {teams.B.name} adelante
      </p>
      <details className="mt-3 text-xs text-muted">
        <summary className="cursor-pointer">Ver como tabla</summary>
        <div className="mt-2 max-h-48 overflow-y-auto">
          <table className="tabular w-full">
            <thead>
              <tr className="text-left">
                <th className="py-1">Punto</th>
                <th>{teams.A.name}</th>
                <th>{teams.B.name}</th>
                <th>Ventaja</th>
              </tr>
            </thead>
            <tbody>
              {pts.slice(1).map((p, i) => (
                <tr key={i} className="border-t border-line">
                  <td className="py-0.5">{i + 1}</td>
                  <td>{p.A}</td>
                  <td>{p.B}</td>
                  <td>{leader(p)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
