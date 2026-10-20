import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { Ball, BigTitle, Crest, FadeUp, Kicker, useEnter } from "../components";
import { LIVE_PLAYS, LIVE_START, RESULTS, rallyAt, team } from "../data";
import { C, display, sans } from "../theme";

// Resultados reales de las jornadas 1 y 2 para el ticker.
const TICKER = RESULTS.map((m) => `${team(m.home).short} ${m.sets[0]}–${m.sets[1]} ${team(m.away).short}`.toUpperCase());

const Score: React.FC<{ value: number; changedAt: number | null; align: "left" | "right" }> = ({ value, changedAt, align }) => {
  const frame = useCurrentFrame();
  const k = changedAt === null ? 0 : interpolate(frame - changedAt, [0, 14], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ fontFamily: display, fontWeight: 800, fontSize: 380, lineHeight: 0.85, width: 420, textAlign: align, color: k > 0.05 ? C.gold : C.paper, scale: 1 + k * 0.12 }}>
      {value}
    </div>
  );
};

export const LiveScore: React.FC = () => {
  const frame = useCurrentFrame();
  const home = team("elQuinche");
  const away = team("amaguana");
  const { state, at } = rallyAt(frame, LIVE_START, LIVE_PLAYS);
  const scored = state.last?.scored ?? false;
  const lastH = scored && state.last?.winner === "H" ? at : null;
  const lastA = scored && state.last?.winner === "A" ? at : null;
  const setWon = state.h >= 15 && state.h - state.a >= 2;
  const board = useEnter(12);
  const banner = useEnter(LIVE_PLAYS[LIVE_PLAYS.length - 1].f + 6, 14);
  // Aviso de "cambio de saque" cuando gana la jugada quien recibe.
  const change = !scored && at !== null ? interpolate(frame - at, [0, 6, 18, 24], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 0;
  const pulse = 0.5 + 0.5 * Math.sin(frame / 4);

  const Side_ = ({ t, serving, align }: { t: typeof home; serving: boolean; align: "flex-start" | "flex-end" }) => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: align, gap: 16, width: 320 }}>
      <Crest name={t.short} color={t.color} size={120} />
      <div style={{ fontFamily: display, fontWeight: 800, fontSize: 62, color: C.paper, textTransform: "uppercase", whiteSpace: "nowrap" }}>{t.short}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, opacity: serving ? 1 : 0, fontFamily: sans, fontWeight: 700, fontSize: 24, color: C.gold }}>
        <Ball size={46} color={C.gold} rotate={frame * 4} /> SACA
      </div>
    </div>
  );

  return (
    <AbsoluteFill name="Marcador" style={{ backgroundColor: C.night }}>
      <div style={{ position: "absolute", left: 120, top: 110, display: "flex", flexDirection: "column", gap: 24 }}>
        <Kicker delay={2} color={C.paper} bar={C.red}>
          <span style={{ display: "inline-block", width: 22, height: 22, borderRadius: 11, background: C.red, opacity: 0.4 + pulse * 0.6, marginRight: 4 }} />
          En vivo · Grupo A
        </Kicker>
        <BigTitle lines={["Marcador en vivo"]} delay={4} size={140} color={C.paper} />
      </div>
      <FadeUp delay={18} style={{ position: "absolute", right: 120, top: 150, width: 640, textAlign: "right", fontFamily: sans, fontWeight: 500, fontSize: 44, lineHeight: 1.2, color: C.lavenderSoft }}>
        Lo que anota la mesa llega al instante a la cancha y al celular.
      </FadeUp>

      <div style={{ position: "absolute", left: 120, right: 120, top: 380, height: 430, display: "flex", alignItems: "center", justifyContent: "center", gap: 26, opacity: board, scale: 0.9 + board * 0.1 }}>
        <Side_ t={home} serving={state.serving === "H"} align="flex-end" />
        <Score value={state.h} changedAt={lastH} align="right" />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18, width: 180 }}>
          <div style={{ fontFamily: sans, fontWeight: 700, fontSize: 30, letterSpacing: "0.2em", color: C.lavender }}>SET 1</div>
          <div style={{ fontFamily: display, fontWeight: 800, fontSize: 80, color: C.paper }}>{setWon ? "1 – 0" : "0 – 0"}</div>
          <div style={{ fontFamily: sans, fontWeight: 700, fontSize: 26, letterSpacing: "0.2em", color: C.lavender }}>SETS</div>
        </div>
        <Score value={state.a} changedAt={lastA} align="left" />
        <Side_ t={away} serving={state.serving === "A"} align="flex-start" />
      </div>

      <div style={{ position: "absolute", left: 0, right: 0, top: 830, display: "flex", justifyContent: "center", opacity: change }}>
        <div style={{ padding: "10px 30px", borderRadius: 999, background: C.lavender, color: C.ink, fontFamily: display, fontWeight: 800, fontSize: 44, textTransform: "uppercase" }}>
          Cambio de saque · {state.serving === "H" ? home.short : away.short}
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: 640,
          top: 350,
          padding: "14px 34px",
          background: C.gold,
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
        ¡Set para {home.short}! 15-12
      </div>

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 60,
          height: 100,
          background: C.gold,
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          translate: interpolate(frame, [24, 44], ["0px 220px", "0px 0px"], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) }),
        }}
      >
        <div style={{ display: "flex", gap: 70, whiteSpace: "nowrap", translate: `${100 - frame * 8}px 0px` }}>
          {TICKER.map((r) => (
            <span key={r} style={{ fontFamily: display, fontWeight: 800, fontSize: 52, color: C.ink }}>
              {r}
            </span>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};
