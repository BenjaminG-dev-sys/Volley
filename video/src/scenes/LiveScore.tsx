import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { Ball, BigTitle, FadeUp, Kicker, useEnter } from "../components";
import { C, display, sans } from "../theme";

const EVENTS: { f: number; t: "H" | "A" }[] = [
  { f: 40, t: "H" },
  { f: 72, t: "A" },
  { f: 102, t: "H" },
];

const RESULTS = [
  "TIGRES 3–1 CÓNDORES · FINAL",
  "PUMAS 2–0 HALCONES · ECUAVÓLEY",
  "JAGUARES 1–1 OSOS · EN VIVO",
  "COLIBRÍES 3–2 JAGUARES · FINAL",
  "OSOS 0–1 LOBOS · SET 2",
];

const Score: React.FC<{ value: number; changedAt: number | null; align: "left" | "right" }> = ({ value, changedAt, align }) => {
  const frame = useCurrentFrame();
  const k = changedAt === null ? 0 : interpolate(frame - changedAt, [0, 14], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div
      style={{
        fontFamily: display,
        fontWeight: 800,
        fontSize: 380,
        lineHeight: 0.85,
        width: 420,
        textAlign: align,
        color: k > 0.05 ? C.volt : C.paper,
        scale: 1 + k * 0.12,
      }}
    >
      {value}
    </div>
  );
};

export const LiveScore: React.FC = () => {
  const frame = useCurrentFrame();
  const done = EVENTS.filter((e) => frame >= e.f);
  const home = 23 + done.filter((e) => e.t === "H").length;
  const away = 22 + done.filter((e) => e.t === "A").length;
  const lastH = [...done].reverse().find((e) => e.t === "H")?.f ?? null;
  const lastA = [...done].reverse().find((e) => e.t === "A")?.f ?? null;
  const serving = done.length ? done[done.length - 1].t : "H";
  const board = useEnter(14);
  const banner = useEnter(EVENTS[2].f + 6, 14);
  const pulse = 0.5 + 0.5 * Math.sin(frame / 4);

  return (
    <AbsoluteFill name="Marcador" style={{ backgroundColor: C.ink }}>
      <div style={{ position: "absolute", left: 120, top: 110, display: "flex", flexDirection: "column", gap: 24 }}>
        <Kicker delay={2} color={C.paper} bar={C.live}>
          <span style={{ display: "inline-block", width: 22, height: 22, borderRadius: 11, background: C.live, opacity: 0.4 + pulse * 0.6, marginRight: 4 }} />
          En vivo
        </Kicker>
        <BigTitle lines={["Marcador en vivo"]} delay={4} size={140} color={C.paper} />
      </div>
      <FadeUp
        delay={20}
        style={{ position: "absolute", right: 120, top: 150, width: 640, textAlign: "right", fontFamily: sans, fontWeight: 500, fontSize: 46, lineHeight: 1.2, color: "#d4d4d4" }}
      >
        Cualquiera lo sigue desde el celular, en tiempo real.
      </FadeUp>

      <div
        style={{
          position: "absolute",
          left: 120,
          right: 120,
          top: 380,
          height: 430,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 30,
          opacity: board,
          scale: 0.9 + board * 0.1,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 16, width: 300 }}>
          <div style={{ width: 120, height: 120, borderRadius: 60, background: C.orange }} />
          <div style={{ fontFamily: display, fontWeight: 800, fontSize: 64, color: C.paper }}>LEONES</div>
          <div style={{ opacity: serving === "H" ? 1 : 0.0 }}>
            <Ball size={54} color={C.volt} rotate={frame * 4} />
          </div>
        </div>
        <Score value={home} changedAt={lastH} align="right" />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18, width: 180 }}>
          <div style={{ fontFamily: sans, fontWeight: 700, fontSize: 30, letterSpacing: "0.2em", color: "#a1a1a3" }}>SET 3</div>
          <div style={{ fontFamily: display, fontWeight: 800, fontSize: 80, color: C.paper }}>{frame >= EVENTS[2].f ? "2 – 1" : "1 – 1"}</div>
          <div style={{ fontFamily: sans, fontWeight: 700, fontSize: 26, letterSpacing: "0.2em", color: "#a1a1a3" }}>SETS</div>
        </div>
        <Score value={away} changedAt={lastA} align="left" />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 16, width: 300 }}>
          <div style={{ width: 120, height: 120, borderRadius: 60, background: C.sky }} />
          <div style={{ fontFamily: display, fontWeight: 800, fontSize: 64, color: C.paper }}>ÁGUILAS</div>
          <div style={{ opacity: serving === "A" ? 1 : 0.0 }}>
            <Ball size={54} color={C.volt} rotate={frame * 4} />
          </div>
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: 660,
          top: 360,
          padding: "14px 34px",
          background: C.volt,
          color: C.ink,
          fontFamily: display,
          fontWeight: 800,
          fontSize: 54,
          textTransform: "uppercase",
          rotate: "-4deg",
          scale: banner,
          opacity: banner,
        }}
      >
        ¡Set para Leones!
      </div>

      {/* Ticker de resultados */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 90,
          height: 110,
          background: C.volt,
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          translate: interpolate(frame, [24, 44], ["0px 220px", "0px 0px"], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
        }}
      >
        <div style={{ display: "flex", gap: 80, whiteSpace: "nowrap", translate: `${200 - frame * 7}px 0px` }}>
          {[...RESULTS, ...RESULTS].map((r, i) => (
            <span key={i} style={{ fontFamily: display, fontWeight: 800, fontSize: 56, color: C.ink }}>
              {r}
            </span>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};
