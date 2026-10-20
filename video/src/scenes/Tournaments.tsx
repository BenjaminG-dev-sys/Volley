import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { BigTitle, Crest, FadeUp, Kicker, Pill, useEnter } from "../components";
import { GROUP_A, OTHER_LEADERS, RULES, standings, team } from "../data";
import { C, display, sans } from "../theme";

const STEPS = ["Datos", "Equipos", "Formato", "Calendario"];
const COLS = "60px 1fr 70px 70px 70px 110px 130px 90px";
const TABLE = standings(GROUP_A);

const Row: React.FC<{ i: number; row: (typeof TABLE)[number]; delay: number }> = ({ i, row, delay }) => {
  const p = useEnter(delay);
  const t = team(row.id);
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: COLS,
        alignItems: "center",
        height: 96,
        padding: "0 24px",
        borderRadius: 18,
        background: i === 0 ? C.gold : C.paper,
        fontFamily: sans,
        fontWeight: 600,
        fontSize: 32,
        color: C.ink,
        opacity: p,
        translate: `${(1 - p) * 80}px 0px`,
      }}
    >
      <span style={{ fontFamily: display, fontWeight: 800, fontSize: 44 }}>{i + 1}</span>
      <span style={{ display: "flex", alignItems: "center", gap: 16, fontWeight: 700 }}>
        <Crest name={t.short} color={t.color} size={56} />
        {t.short}
      </span>
      <span style={{ textAlign: "center" }}>{row.pj}</span>
      <span style={{ textAlign: "center" }}>{row.g}</span>
      <span style={{ textAlign: "center" }}>{row.p}</span>
      <span style={{ textAlign: "center" }}>
        {row.sf}:{row.sc}
      </span>
      <span style={{ display: "flex", gap: 6, justifyContent: "center" }}>
        {row.form.map((r, k) => (
          <span key={k} style={{ width: 32, height: 32, borderRadius: 6, background: r === "G" ? C.ok : C.lavender, color: C.paper, fontSize: 18, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>
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
  const active = Math.min(STEPS.length - 1, Math.floor(interpolate(frame, [20, 100], [0, STEPS.length], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })));

  return (
    <AbsoluteFill name="Torneo" style={{ backgroundColor: C.surface }}>
      <div style={{ position: "absolute", left: 120, top: 130, width: 640, display: "flex", flexDirection: "column", gap: 32 }}>
        <Kicker delay={4} bar={C.sky}>
          Interparroquial 2026
        </Kicker>
        <BigTitle lines={["16 ligas,", "4 grupos"]} delay={6} size={160} color={C.ink} />
        <FadeUp delay={24} style={{ fontFamily: sans, fontWeight: 500, fontSize: 44, lineHeight: 1.2, color: C.ink }}>
          Calendario automático y posiciones al instante, con el sistema de puntos del torneo.
        </FadeUp>
        <FadeUp delay={34}>
          <Pill size={32} bg={C.ink} color={C.paper}>
            Puntos: {RULES.pointsLegend}
          </Pill>
        </FadeUp>
      </div>

      <div style={{ position: "absolute", right: 120, top: 130, width: 1020, display: "flex", flexDirection: "column", gap: 22 }}>
        <FadeUp delay={10} style={{ display: "flex", gap: 14 }}>
          {STEPS.map((s, i) => (
            <div
              key={s}
              style={{
                flex: 1,
                height: 84,
                borderRadius: 999,
                background: i <= active ? C.sky : C.paper,
                color: i <= active ? C.paper : C.muted,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 12,
                fontFamily: sans,
                fontWeight: 700,
                fontSize: 30,
                border: i === active ? `4px solid ${C.gold}` : "4px solid transparent",
              }}
            >
              <span style={{ fontFamily: display, fontWeight: 800, fontSize: 38 }}>{i + 1}</span>
              {s}
            </div>
          ))}
        </FadeUp>

        <FadeUp delay={30} style={{ fontFamily: display, fontWeight: 800, fontSize: 40, textTransform: "uppercase", color: C.ink, marginTop: 8 }}>
          Grupo A · tras la jornada 2
        </FadeUp>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <FadeUp delay={36} style={{ display: "grid", gridTemplateColumns: COLS, padding: "0 24px", fontFamily: sans, fontWeight: 700, fontSize: 22, letterSpacing: "0.12em", color: C.muted }}>
            <span>#</span>
            <span>LIGA</span>
            <span style={{ textAlign: "center" }}>PJ</span>
            <span style={{ textAlign: "center" }}>G</span>
            <span style={{ textAlign: "center" }}>P</span>
            <span style={{ textAlign: "center" }}>SETS</span>
            <span style={{ textAlign: "center" }}>FORMA</span>
            <span style={{ textAlign: "right" }}>PTS</span>
          </FadeUp>
          {TABLE.map((row, i) => (
            <Row key={row.id} i={i} row={row} delay={42 + i * 7} />
          ))}
        </div>
        <FadeUp delay={80} style={{ display: "flex", gap: 14, marginTop: 6 }}>
          {OTHER_LEADERS.map((l) => (
            <Pill key={l.group} size={24} bg={C.paper} color={C.ink}>
              Grupo {l.group}: {team(l.id).short} · {l.pts} pts
            </Pill>
          ))}
        </FadeUp>
      </div>
    </AbsoluteFill>
  );
};
