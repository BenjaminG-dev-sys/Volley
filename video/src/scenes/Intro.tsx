import React from "react";
import { AbsoluteFill, Interactive, interpolate, useCurrentFrame, Easing } from "remotion";
import { Ball, Reveal, useEnter } from "../components";
import { C, display, sans } from "../theme";

const STRIPES = [C.volt, C.orange, C.sky, C.sun, C.rose];

export const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const ball = useEnter(22, 14);

  return (
    <AbsoluteFill name="Intro" style={{ backgroundColor: C.ink, overflow: "hidden" }}>
      {/* Barrido de colores de campaña */}
      {STRIPES.map((color, i) => (
        <div
          key={color}
          style={{
            position: "absolute",
            top: -300,
            left: 0,
            width: 380,
            height: 1700,
            background: color,
            rotate: "14deg",
            translate: `${interpolate(frame, [i * 4, i * 4 + 38], [-700, 2500], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.7, 0, 0.3, 1),
            })}px 0px`,
          }}
        />
      ))}

      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", flexDirection: "column" }}>
        <div style={{ scale: ball, rotate: `${(1 - ball) * -180 + frame * 1.2}deg`, marginBottom: 20 }}>
          <Ball size={150} color={C.volt} />
        </div>
        <div
          style={{
            display: "flex",
            gap: 40,
            fontFamily: display,
            fontWeight: 800,
            fontSize: 330,
            lineHeight: 0.88,
            textTransform: "uppercase",
          }}
        >
          <Reveal delay={28}>
            <span style={{ color: C.paper }}>Voley</span>
          </Reveal>
          <Reveal delay={34}>
            <span style={{ color: C.volt }}>EC</span>
          </Reveal>
        </div>
        <Interactive.Div
          name="Tagline"
          style={{
            marginTop: 40,
            fontFamily: sans,
            fontWeight: 600,
            fontSize: 64,
            color: C.paper,
            opacity: interpolate(frame, [50, 66], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
            translate: interpolate(frame, [50, 66], ["0px 30px", "0px 0px"], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            }),
          }}
        >
          Torneos de vóley y ecuavóley, en vivo.
        </Interactive.Div>
      </AbsoluteFill>

      <Interactive.Div
        name="Features strip"
        style={{
          position: "absolute",
          bottom: 110,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: sans,
          fontWeight: 700,
          fontSize: 34,
          letterSpacing: "0.22em",
          color: "#a1a1a3",
          opacity: interpolate(frame, [70, 86], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        }}
      >
        PLANILLA DIGITAL · MARCADOR EN VIVO · ADMIN COMPLETO
      </Interactive.Div>
    </AbsoluteFill>
  );
};
