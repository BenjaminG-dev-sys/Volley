import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { BigTitle, Crest, FadeUp, Kicker, useEnter } from "../components";
import { C, display, sans } from "../theme";

const STEPS = ["Datos", "Equipos", "Formato", "Calendario"];

const TABLE = [
  { name: "Leones", color: C.orange, pj: 6, g: 5, p: 1, pts: 15, form: "GGPGG" },
  { name: "Águilas", color: C.sky, pj: 6, g: 4, p: 2, pts: 12, form: "GPGGG" },
  { name: "Tigres", color: C.ink, pj: 6, g: 3, p: 3, pts: 9, form: "PGGPG" },
  { name: "Cóndores", color: C.rose, pj: 6, g: 2, p: 4, pts: 6, form: "GPPGP" },
  { name: "Pumas", color: "#00a36c", pj: 6, g: 1, p: 5, pts: 3, form: "PPGPP" },
];

const Row: React.FC<{ i: number; row: (typeof TABLE)[number]; delay: number }> = ({ i, row, delay }) => {
  const p = useEnter(delay);
  const first = i === 0;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "60px 1fr 80px 80px 80px 200px 100px",
        alignItems: "center",
        height: 96,
        padding: "0 26px",
        borderRadius: 18,
        background: first ? C.sun : C.paper,
        fontFamily: sans,
        fontWeight: 600,
        fontSize: 32,
        color: C.ink,
        opacity: p,
        translate: `${(1 - p) * 80}px 0px`,
      }}
    >
      <span style={{ fontFamily: display, fontWeight: 800, fontSize: 44 }}>{i + 1}</span>
      <span style={{ display: "flex", alignItems: "center", gap: 18, fontWeight: 700 }}>
        <Crest name={row.name} color={row.color} size={58} />
        {row.name}
      </span>
      <span style={{ textAlign: "center" }}>{row.pj}</span>
      <span style={{ textAlign: "center" }}>{row.g}</span>
      <span style={{ textAlign: "center" }}>{row.p}</span>
      <span style={{ display: "flex", gap: 6, justifyContent: "center" }}>
        {row.form.split("").map((r, k) => (
          <span
            key={k}
            style={{
              width: 30,
              height: 30,
              borderRadius: 6,
              background: r === "G" ? C.ok : "#c9c9cc",
              color: C.paper,
              fontSize: 18,
              fontWeight: 800,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {r}
          </span>
        ))}
      </span>
      <span style={{ textAlign: "right", fontFamily: display, fontWeight: 800, fontSize: 48 }}>{row.pts}</span>
    </div>
  );
};

export const Tournaments: React.FC = () => {
  const frame = useCurrentFrame();
  const active = Math.min(STEPS.length - 1, Math.floor(interpolate(frame, [20, 110], [0, STEPS.length], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })));

  return (
    <AbsoluteFill name="Torneos" style={{ backgroundColor: C.grey }}>
      <div style={{ position: "absolute", left: 120, top: 130, width: 640, display: "flex", flexDirection: "column", gap: 34 }}>
        <Kicker delay={4} bar={C.sky}>
          Torneos
        </Kicker>
        <BigTitle lines={["Arma tu", "torneo en", "4 pasos"]} delay={6} size={150} />
        <FadeUp delay={24} style={{ fontFamily: sans, fontWeight: 500, fontSize: 46, lineHeight: 1.2, color: C.ink }}>
          Grupos, eliminatorias y calendario automático. Puntos y desempates a tu medida.
        </FadeUp>
      </div>

      <div style={{ position: "absolute", right: 120, top: 140, width: 1000, display: "flex", flexDirection: "column", gap: 28 }}>
        <FadeUp delay={10} style={{ display: "flex", gap: 14 }}>
          {STEPS.map((s, i) => (
            <div
              key={s}
              style={{
                flex: 1,
                height: 92,
                borderRadius: 999,
                background: i <= active ? C.sky : C.paper,
                color: i <= active ? C.paper : C.muted,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 12,
                fontFamily: sans,
                fontWeight: 700,
                fontSize: 32,
                border: i === active ? `4px solid ${C.ink}` : "4px solid transparent",
              }}
            >
              <span style={{ fontFamily: display, fontWeight: 800, fontSize: 40 }}>{i + 1}</span>
              {s}
            </div>
          ))}
        </FadeUp>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
          <FadeUp
            delay={36}
            style={{
              display: "grid",
              gridTemplateColumns: "60px 1fr 80px 80px 80px 200px 100px",
              padding: "0 26px",
              fontFamily: sans,
              fontWeight: 700,
              fontSize: 24,
              letterSpacing: "0.12em",
              color: C.muted,
            }}
          >
            <span>#</span>
            <span>EQUIPO</span>
            <span style={{ textAlign: "center" }}>PJ</span>
            <span style={{ textAlign: "center" }}>G</span>
            <span style={{ textAlign: "center" }}>P</span>
            <span style={{ textAlign: "center" }}>FORMA</span>
            <span style={{ textAlign: "right" }}>PTS</span>
          </FadeUp>
          {TABLE.map((row, i) => (
            <Row key={row.name} i={i} row={row} delay={42 + i * 7} />
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};
