import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { Ball, BigTitle, DeviceFrame, FadeUp, Kicker, Pill, useEnter } from "../components";
import { MESA_PLAYS, MESA_START, VENUES, rallyAt, team, type Side } from "../data";
import { C, display, sans } from "../theme";

const OFFLINE_FROM = 70;
const SYNC_AT = 150;

const TeamPanel: React.FC<{
  name: string;
  color: string;
  score: number;
  serving: boolean;
  pressed: number;
  bump: number;
}> = ({ name, color, score, serving, pressed, bump }) => (
  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 14 }}>
    <div
      style={{
        flex: 1,
        background: color,
        borderRadius: 24,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "24px 18px 20px",
        color: C.paper,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, fontFamily: display, fontWeight: 800, fontSize: 44, textTransform: "uppercase" }}>
        {name}
        <div style={{ opacity: serving ? 1 : 0 }}>
          <Ball size={36} color={C.gold} />
        </div>
      </div>
      <div style={{ fontFamily: display, fontWeight: 800, fontSize: 200, lineHeight: 0.9, scale: 1 + bump * 0.1, color: bump > 0.05 ? C.gold : C.paper }}>{score}</div>
      <div
        style={{
          width: "100%",
          height: 92,
          borderRadius: 18,
          background: pressed > 0.05 ? C.gold : "rgba(0,0,0,0.22)",
          color: pressed > 0.05 ? C.ink : C.paper,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: sans,
          fontWeight: 800,
          fontSize: serving ? 34 : 24,
          lineHeight: 1.15,
          scale: 1 - pressed * 0.05,
          textAlign: "center",
        }}
      >
        {serving ? "PUNTO" : "GANA LA JUGADA · CAMBIO"}
      </div>
    </div>
    <div
      style={{
        height: 58,
        borderRadius: 16,
        border: `3px solid ${C.ink}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: sans,
        fontWeight: 700,
        fontSize: 24,
        color: C.ink,
        opacity: serving ? 1 : 0.3,
      }}
    >
      Tiempo {serving ? "" : "· solo con saque"}
    </div>
  </div>
);

export const Scorer: React.FC = () => {
  const frame = useCurrentFrame();
  const tablet = useEnter(10);
  const home = team("elQuinche");
  const away = team("amaguana");
  const { state, at } = rallyAt(frame, MESA_START, MESA_PLAYS);
  const k = at === null ? 0 : interpolate(frame - at, [0, 12], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const winner: Side | null = state.last?.winner ?? null;
  const scored = state.last?.scored ?? false;
  const queued = MESA_PLAYS.filter((p) => p.f >= OFFLINE_FROM && frame >= p.f).length;
  const name = (s: Side) => (s === "H" ? home.short : away.short);
  const log = state.last
    ? scored
      ? `Punto para ${name(state.last.winner)} (${state.h}-${state.a})`
      : `Cambio de saque para ${name(state.last.winner)} (${state.h}-${state.a})`
    : `Saca ${name(state.serving)} · ${state.h}-${state.a}`;
  // Cronómetro del partido (corre desde 18:20).
  const secs = 18 * 60 + 20 + Math.floor(frame / 30);
  const clock = `${String(Math.floor(secs / 60)).padStart(2, "0")}:${String(secs % 60).padStart(2, "0")}`;

  const status =
    frame < OFFLINE_FROM
      ? { bg: C.ok, text: "En línea" }
      : frame < SYNC_AT
        ? { bg: C.orange, text: queued ? `Sin conexión · ${queued} en cola` : "Sin conexión" }
        : { bg: C.ok, text: "Sincronizado ✓" };

  return (
    <AbsoluteFill name="Mesa" style={{ backgroundColor: C.paper }}>
      <div style={{ position: "absolute", left: 120, top: 150, width: 700, display: "flex", flexDirection: "column", gap: 34 }}>
        <Kicker delay={4} bar={C.red}>
          Planilla electrónica
        </Kicker>
        <BigTitle lines={["La mesa", "en tu", "tablet"]} delay={6} size={160} color={C.ink} />
        <FadeUp delay={22} style={{ fontFamily: sans, fontWeight: 500, fontSize: 46, lineHeight: 1.2, color: C.ink }}>
          Si gana quien recibe, solo recupera el saque. La mesa lo aplica sola.
        </FadeUp>
        <FadeUp delay={34} style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
          <Pill size={32} bg={C.surface} color={C.ink}>
            ↺ Deshacer
          </Pill>
          <Pill size={32} bg={C.surface} color={C.ink}>
            Funciona sin internet
          </Pill>
          <Pill size={32} bg={C.surface} color={C.ink}>
            Cronómetro
          </Pill>
        </FadeUp>
      </div>

      <div style={{ position: "absolute", right: 120, top: 130, opacity: tablet, translate: `${(1 - tablet) * 200}px 0px`, rotate: `${(1 - tablet) * 4}deg` }}>
        <DeviceFrame width={940} height={820} radius={44} bezel={20}>
          <div style={{ position: "absolute", inset: 0, background: C.surface, display: "flex", flexDirection: "column", padding: 26, gap: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontFamily: display, fontWeight: 800, fontSize: 36, textTransform: "uppercase", color: C.ink }}>Set 1 · {VENUES[0]}</div>
              <Pill size={24} bg={status.bg} color={C.paper}>
                {status.text}
              </Pill>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 14, fontFamily: sans, fontWeight: 700, fontSize: 24, color: C.ink }}>
              <span style={{ padding: "6px 14px", borderRadius: 12, background: C.ink, color: C.gold, fontFamily: display, fontSize: 30 }}>⏱ {clock}</span>
              Grupo A · Jornada 3
            </div>
            <div style={{ flex: 1, display: "flex", gap: 20 }}>
              <TeamPanel name={home.short} color={home.color} score={state.h} serving={state.serving === "H"} pressed={winner === "H" ? k : 0} bump={winner === "H" && scored ? k : 0} />
              <TeamPanel name={away.short} color={away.color} score={state.a} serving={state.serving === "A"} pressed={winner === "A" ? k : 0} bump={winner === "A" && scored ? k : 0} />
            </div>
            <div
              style={{
                height: 64,
                borderRadius: 16,
                background: scored || !state.last ? C.paper : C.gold,
                display: "flex",
                alignItems: "center",
                padding: "0 22px",
                fontFamily: sans,
                fontWeight: 700,
                fontSize: 26,
                color: C.ink,
              }}
            >
              {log}
            </div>
          </div>
        </DeviceFrame>
      </div>
    </AbsoluteFill>
  );
};
