import React from "react";
import { AbsoluteFill, Easing, Interactive, interpolate, useCurrentFrame } from "remotion";
import { BigTitle, Kicker, Pill, useEnter } from "../components";
import { C, sans } from "../theme";

const Half: React.FC<{
  side: "left" | "right";
  bg: string;
  kicker: string;
  title: string;
  chips: string[];
  delay: number;
}> = ({ side, bg, kicker, title, chips, delay }) => {
  const frame = useCurrentFrame();
  const open = interpolate(frame, [delay - 10, delay + 14], [0, 50], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.7, 0, 0.3, 1),
  });
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        bottom: 0,
        [side]: 0,
        width: `${open}%`,
        background: bg,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 150,
          [side]: 0,
          width: 960,
          padding: side === "left" ? "0 100px 0 120px" : "0 120px 0 100px",
          display: "flex",
          flexDirection: "column",
          gap: 36,
        }}
      >
        <Kicker delay={delay + 6}>{kicker}</Kicker>
        <BigTitle lines={[title]} delay={delay + 8} size={165} />
        <div style={{ display: "flex", flexDirection: "column", gap: 22, alignItems: "flex-start", marginTop: 10 }}>
          {chips.map((c, i) => (
            <Chip key={c} delay={delay + 22 + i * 8}>
              {c}
            </Chip>
          ))}
        </div>
      </div>
    </div>
  );
};

const Chip: React.FC<{ delay: number; children: React.ReactNode }> = ({ delay, children }) => {
  const p = useEnter(delay);
  return (
    <div style={{ opacity: p, translate: `${(1 - p) * -40}px 0px` }}>
      <Pill size={44} bg={C.ink} color={C.paper}>
        {children}
      </Pill>
    </div>
  );
};

export const Modes: React.FC = () => {
  const frame = useCurrentFrame();
  const vs = useEnter(30, 12);
  return (
    <AbsoluteFill name="Modos" style={{ backgroundColor: C.ink }}>
      <Half
        side="left"
        bg={C.orange}
        kicker="Modo 01"
        title="Vóley"
        delay={8}
        chips={["6 jugadores · rotación", "Punto por jugada", "Al mejor de 5 sets", "Líbero y reglas FIVB"]}
      />
      <Half
        side="right"
        bg={C.sun}
        kicker="Modo 02"
        title="Ecuavóley"
        delay={20}
        chips={["3 jugadores", "Servidor · Colocador · Volador", "Con cambio de saque", "Sets a 15, 12 o 10"]}
      />

      <div
        style={{
          position: "absolute",
          left: 960 - 80,
          top: 470,
          width: 160,
          height: 160,
          borderRadius: 80,
          background: C.ink,
          color: C.paper,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: sans,
          fontWeight: 800,
          fontSize: 56,
          scale: vs,
        }}
      >
        VS
      </div>

      <Interactive.Div
        name="Caption"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 150,
          background: C.ink,
          color: C.paper,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: sans,
          fontWeight: 600,
          fontSize: 54,
          translate: interpolate(frame, [70, 90], ["0px 150px", "0px 0px"], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
        }}
      >
        Un sistema, dos deportes. El reglamento se elige en cada torneo.
      </Interactive.Div>
    </AbsoluteFill>
  );
};
