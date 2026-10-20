import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { BigTitle, FadeUp, Kicker, useEnter } from "../components";
import { SHEET, team } from "../data";
import { C, display, sans } from "../theme";

const Bar: React.FC<{ label: string; h: number; a: number; delay: number; ch: string; ca: string }> = ({ label, h, a, delay, ch, ca }) => {
  const p = useEnter(delay);
  const max = Math.max(h, a, 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: sans, fontWeight: 700, fontSize: 28, color: C.ink }}>
        <span style={{ fontFamily: display, fontSize: 42, fontWeight: 800 }}>{Math.round(h * p)}</span>
        <span style={{ alignSelf: "center", color: C.muted }}>{label}</span>
        <span style={{ fontFamily: display, fontSize: 42, fontWeight: 800 }}>{Math.round(a * p)}</span>
      </div>
      <div style={{ display: "flex", gap: 8, height: 20 }}>
        <div style={{ flex: 1, display: "flex", justifyContent: "flex-end", background: C.surface, borderRadius: 10 }}>
          <div style={{ width: `${(h / max) * 100 * p}%`, background: ch, borderRadius: 10 }} />
        </div>
        <div style={{ flex: 1, display: "flex", background: C.surface, borderRadius: 10 }}>
          <div style={{ width: `${(a / max) * 100 * p}%`, background: ca, borderRadius: 10 }} />
        </div>
      </div>
    </div>
  );
};

export const Stats: React.FC = () => {
  const frame = useCurrentFrame();
  const card = useEnter(10);
  const home = team(SHEET.home);
  const away = team(SHEET.away);
  const won = SHEET.sets.filter(([h, a]) => h > a).length;
  const W = 780;
  const H = 150;
  const lead = [0, ...SHEET.set3.map(([h, a]) => h - a)];
  const step = W / (lead.length - 1);
  const y = (v: number) => H * 0.85 - v * 16;
  const path = lead.map((v, i) => `${i ? "L" : "M"}${i * step},${y(v)}`).join(" ");
  const draw = interpolate(frame, [60, 150], [0, W], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });

  return (
    <AbsoluteFill name="Estadisticas" style={{ backgroundColor: C.sky }}>
      <div style={{ position: "absolute", left: 120, top: 150, width: 760, display: "flex", flexDirection: "column", gap: 34 }}>
        <Kicker delay={4} color={C.paper} bar={C.gold}>
          Planilla y estadísticas
        </Kicker>
        <BigTitle lines={["Cada punto", "cuenta"]} delay={6} size={170} color={C.paper} />
        <FadeUp delay={22} style={{ fontFamily: sans, fontWeight: 500, fontSize: 46, lineHeight: 1.2, color: C.paper }}>
          Planilla oficial con firmas, lista para imprimir. Con cambio de saque, cada punto es de saque.
        </FadeUp>
        <FadeUp delay={34} style={{ fontFamily: sans, fontWeight: 600, fontSize: 30, color: C.lavenderSoft }}>
          Capitanes: {SHEET.captains[0]} · {SHEET.captains[1]} — Árbitro: {SHEET.referee}
        </FadeUp>
      </div>

      <div
        style={{
          position: "absolute",
          right: 120,
          top: 130,
          width: 860,
          background: C.paper,
          borderRadius: 32,
          padding: 38,
          display: "flex",
          flexDirection: "column",
          gap: 20,
          boxShadow: "0 40px 90px rgba(0,10,40,0.35)",
          opacity: card,
          translate: `0px ${(1 - card) * 120}px`,
        }}
      >
        <div style={{ fontFamily: sans, fontWeight: 700, fontSize: 22, letterSpacing: "0.16em", color: C.muted }}>GRUPO A · JORNADA 1 · 29 SEPT</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontFamily: display, fontWeight: 800, fontSize: 50, textTransform: "uppercase" }}>
          <span style={{ color: home.color }}>{home.short}</span>
          <span style={{ color: C.ink }}>
            {won} – {SHEET.sets.length - won}
          </span>
          <span style={{ color: away.color }}>{away.short}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: 14 }}>
          {SHEET.sets.map(([h, a], i) => (
            <span key={i} style={{ padding: "6px 16px", borderRadius: 10, background: C.surface, fontFamily: display, fontWeight: 800, fontSize: 32, color: C.ink }}>
              {h}-{a}
            </span>
          ))}
        </div>
        {SHEET.stats.map((b, i) => (
          <Bar key={b.label} {...b} delay={18 + i * 8} ch={home.color} ca={away.color} />
        ))}
        <div style={{ display: "flex", justifyContent: "space-between", fontFamily: sans, fontWeight: 700, fontSize: 22, letterSpacing: "0.12em", color: C.muted, marginTop: 4 }}>
          <span>EVOLUCIÓN · SET 3</span>
          <span style={{ letterSpacing: 0 }}>Mejor sacador: {SHEET.topServer}</span>
        </div>
        <svg width={W} height={H} style={{ overflow: "visible" }}>
          <defs>
            <clipPath id="draw">
              <rect x={-10} y={-30} width={draw + 10} height={H + 60} />
            </clipPath>
          </defs>
          <line x1={0} x2={W} y1={y(0)} y2={y(0)} stroke={C.line} strokeWidth={3} />
          <g clipPath="url(#draw)">
            <path d={`${path} L${W},${y(0)} L0,${y(0)} Z`} fill={home.color} opacity={0.15} />
            <path d={path} fill="none" stroke={home.color} strokeWidth={7} strokeLinejoin="round" strokeLinecap="round" />
          </g>
        </svg>
      </div>
    </AbsoluteFill>
  );
};
