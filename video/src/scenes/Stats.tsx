import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { BigTitle, FadeUp, Kicker, Pill, useEnter } from "../components";
import { C, display, sans } from "../theme";

const BARS = [
  { label: "Puntos en saque", h: 31, a: 24 },
  { label: "Puntos en recepción", h: 44, a: 38 },
  { label: "Mayor racha", h: 7, a: 4 },
  { label: "Tiempos usados", h: 2, a: 4 },
];

// Diferencia de puntos (Leones − Águilas) jugada a jugada.
const LEAD = [0, 1, 0, -1, -2, -1, 0, 1, 2, 3, 2, 1, 2, 3, 4, 3, 2, 3, 4, 5, 4, 3, 4, 5, 6, 5, 4, 3, 4, 5];

const Bar: React.FC<{ label: string; h: number; a: number; delay: number }> = ({ label, h, a, delay }) => {
  const p = useEnter(delay);
  const max = Math.max(h, a);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: sans, fontWeight: 700, fontSize: 30, color: C.ink }}>
        <span style={{ fontFamily: display, fontSize: 44, fontWeight: 800 }}>{Math.round(h * p)}</span>
        <span style={{ alignSelf: "center", color: C.muted }}>{label}</span>
        <span style={{ fontFamily: display, fontSize: 44, fontWeight: 800 }}>{Math.round(a * p)}</span>
      </div>
      <div style={{ display: "flex", gap: 8, height: 22 }}>
        <div style={{ flex: 1, display: "flex", justifyContent: "flex-end", background: C.grey, borderRadius: 11 }}>
          <div style={{ width: `${(h / max) * 100 * p}%`, background: C.orange, borderRadius: 11 }} />
        </div>
        <div style={{ flex: 1, display: "flex", background: C.grey, borderRadius: 11 }}>
          <div style={{ width: `${(a / max) * 100 * p}%`, background: C.sky, borderRadius: 11 }} />
        </div>
      </div>
    </div>
  );
};

export const Stats: React.FC = () => {
  const frame = useCurrentFrame();
  const card = useEnter(10);
  const W = 780;
  const H = 170;
  const step = W / (LEAD.length - 1);
  const y = (v: number) => H * 0.75 - v * 14;
  const path = LEAD.map((v, i) => `${i ? "L" : "M"}${i * step},${y(v)}`).join(" ");
  const draw = interpolate(frame, [60, 150], [0, W], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });

  return (
    <AbsoluteFill name="Estadisticas" style={{ backgroundColor: C.sky }}>
      <div style={{ position: "absolute", left: 120, top: 150, width: 760, display: "flex", flexDirection: "column", gap: 36 }}>
        <Kicker delay={4} color={C.paper} bar={C.volt}>
          Planilla y estadísticas
        </Kicker>
        <BigTitle lines={["Cada punto", "cuenta"]} delay={6} size={170} color={C.paper} />
        <FadeUp delay={22} style={{ fontFamily: sans, fontWeight: 500, fontSize: 50, lineHeight: 1.2, color: C.paper }}>
          Planilla oficial lista para imprimir y estadísticas automáticas de cada partido.
        </FadeUp>
        <FadeUp delay={34} style={{ display: "flex", gap: 16 }}>
          <Pill size={36} bg={C.paper} color={C.ink}>
            Por equipo
          </Pill>
          <Pill size={36} bg={C.paper} color={C.ink}>
            Por torneo
          </Pill>
          <Pill size={36} bg={C.paper} color={C.ink}>
            Por jugador
          </Pill>
        </FadeUp>
      </div>

      <div
        style={{
          position: "absolute",
          right: 120,
          top: 140,
          width: 860,
          background: C.paper,
          borderRadius: 32,
          padding: 40,
          display: "flex",
          flexDirection: "column",
          gap: 22,
          boxShadow: "0 40px 90px rgba(0,0,0,0.3)",
          opacity: card,
          translate: `0px ${(1 - card) * 120}px`,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", fontFamily: display, fontWeight: 800, fontSize: 46, textTransform: "uppercase" }}>
          <span style={{ color: C.orange }}>Leones</span>
          <span style={{ color: C.ink }}>3 – 1</span>
          <span style={{ color: C.sky }}>Águilas</span>
        </div>
        {BARS.map((b, i) => (
          <Bar key={b.label} {...b} delay={18 + i * 8} />
        ))}
        <div style={{ fontFamily: sans, fontWeight: 700, fontSize: 26, letterSpacing: "0.16em", color: C.muted, marginTop: 6 }}>
          EVOLUCIÓN DEL MARCADOR
        </div>
        <svg width={W} height={H} style={{ overflow: "visible" }}>
          <defs>
            <clipPath id="draw">
              <rect x={-10} y={-20} width={draw + 10} height={H + 40} />
            </clipPath>
          </defs>
          <line x1={0} x2={W} y1={H * 0.75} y2={H * 0.75} stroke={C.line} strokeWidth={3} />
          <g clipPath="url(#draw)">
            <path d={`${path} L${W},${H * 0.75} L0,${H * 0.75} Z`} fill={C.orange} opacity={0.15} />
            <path d={path} fill="none" stroke={C.orange} strokeWidth={7} strokeLinejoin="round" strokeLinecap="round" />
          </g>
        </svg>
      </div>
    </AbsoluteFill>
  );
};
