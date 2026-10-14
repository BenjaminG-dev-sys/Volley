import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { Ball, BigTitle, DeviceFrame, FadeUp, Kicker, Pill, useEnter } from "../components";
import { C, display, sans } from "../theme";

// Jugadas que la mesa va anotando (frame en que se toca el botón).
const EVENTS: { f: number; t: "H" | "A" }[] = [
  { f: 40, t: "H" },
  { f: 62, t: "A" },
  { f: 84, t: "H" },
  { f: 104, t: "H" },
  { f: 124, t: "A" },
  { f: 142, t: "H" },
];
const OFFLINE_FROM = 75;
const SYNC_AT = 150;

const TeamPanel: React.FC<{
  name: string;
  color: string;
  score: number;
  serving: boolean;
  pressed: number;
}> = ({ name, color, score, serving, pressed }) => (
  <div
    style={{
      flex: 1,
      background: color,
      borderRadius: 24,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "26px 20px 22px",
      color: C.paper,
    }}
  >
    <div style={{ display: "flex", alignItems: "center", gap: 14, fontFamily: display, fontWeight: 800, fontSize: 44, textTransform: "uppercase" }}>
      {name}
      <div style={{ opacity: serving ? 1 : 0 }}>
        <Ball size={36} color={C.volt} />
      </div>
    </div>
    <div style={{ fontFamily: display, fontWeight: 800, fontSize: 210, lineHeight: 0.9, scale: 1 + pressed * 0.08 }}>{score}</div>
    <div
      style={{
        width: "100%",
        height: 86,
        borderRadius: 18,
        background: pressed > 0.05 ? C.volt : "rgba(0,0,0,0.25)",
        color: pressed > 0.05 ? C.ink : C.paper,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: sans,
        fontWeight: 800,
        fontSize: 34,
        scale: 1 - pressed * 0.05,
      }}
    >
      + PUNTO
    </div>
  </div>
);

const SmallBtn: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      flex: 1,
      height: 64,
      borderRadius: 16,
      border: `3px solid ${C.ink}`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: sans,
      fontWeight: 700,
      fontSize: 26,
      color: C.ink,
    }}
  >
    {children}
  </div>
);

export const Scorer: React.FC = () => {
  const frame = useCurrentFrame();
  const tablet = useEnter(10);
  const done = EVENTS.filter((e) => frame >= e.f);
  const home = 20 + done.filter((e) => e.t === "H").length;
  const away = 21 + done.filter((e) => e.t === "A").length;
  const last = done[done.length - 1];
  const press = last ? interpolate(frame - last.f, [0, 10], [1, 0], { extrapolateRight: "clamp" }) : 0;
  const serving = last ? last.t : "A";
  const queued = EVENTS.filter((e) => e.f >= OFFLINE_FROM && frame >= e.f).length;

  const status =
    frame < OFFLINE_FROM
      ? { bg: C.ok, text: "En línea" }
      : frame < SYNC_AT
        ? { bg: C.orange, text: `Sin conexión · ${queued} en cola` }
        : { bg: C.ok, text: "Sincronizado ✓" };

  return (
    <AbsoluteFill name="Mesa" style={{ backgroundColor: C.paper }}>
      <div style={{ position: "absolute", left: 120, top: 150, width: 720, display: "flex", flexDirection: "column", gap: 36 }}>
        <Kicker delay={4} bar={C.orange}>
          Planilla digital
        </Kicker>
        <BigTitle lines={["La mesa", "en tu", "tablet"]} delay={6} size={160} />
        <FadeUp delay={22} style={{ fontFamily: sans, fontWeight: 500, fontSize: 50, lineHeight: 1.2, color: C.ink }}>
          Puntos, tiempos, cambios y sanciones con un toque.
        </FadeUp>
        <FadeUp delay={34} style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
          <Pill size={36} bg={C.grey} color={C.ink}>
            ↺ Deshacer
          </Pill>
          <Pill size={36} bg={C.grey} color={C.ink}>
            Funciona sin internet
          </Pill>
          <Pill size={36} bg={C.grey} color={C.ink}>
            Varias mesas a la vez
          </Pill>
        </FadeUp>
      </div>

      <div
        style={{
          position: "absolute",
          right: 120,
          top: 150,
          opacity: tablet,
          translate: `${(1 - tablet) * 200}px 0px`,
          rotate: `${(1 - tablet) * 4}deg`,
        }}
      >
        <DeviceFrame width={920} height={780} radius={44} bezel={20}>
          <div style={{ position: "absolute", inset: 0, background: C.grey, display: "flex", flexDirection: "column", padding: 28, gap: 22 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontFamily: display, fontWeight: 800, fontSize: 40, textTransform: "uppercase", color: C.ink }}>Set 2 · Cancha 1</div>
              <Pill size={26} bg={status.bg} color={C.paper}>
                {status.text}
              </Pill>
            </div>
            <div style={{ flex: 1, display: "flex", gap: 22 }}>
              <TeamPanel name="Leones" color={C.orange} score={home} serving={serving === "H"} pressed={last?.t === "H" ? press : 0} />
              <TeamPanel name="Águilas" color={C.sky} score={away} serving={serving === "A"} pressed={last?.t === "A" ? press : 0} />
            </div>
            <div style={{ display: "flex", gap: 16 }}>
              <SmallBtn>Tiempo</SmallBtn>
              <SmallBtn>Cambio</SmallBtn>
              <SmallBtn>Sanción</SmallBtn>
              <SmallBtn>Deshacer</SmallBtn>
            </div>
          </div>
        </DeviceFrame>
      </div>
    </AbsoluteFill>
  );
};
