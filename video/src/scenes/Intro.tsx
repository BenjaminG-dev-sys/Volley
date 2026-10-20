import React from "react";
import { AbsoluteFill, Easing, Interactive, interpolate, useCurrentFrame } from "remotion";
import { BrandBand, Logo, Reveal, useEnter } from "../components";
import { BRAND } from "../data";
import { INTRO } from "../timeline";
import { C, ESFERA, sans } from "../theme";

export const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const logo = useEnter(0, 14);

  return (
    <AbsoluteFill name="Intro" style={{ background: ESFERA, overflow: "hidden" }}>
      <BrandBand
        height={16}
        progress={interpolate(frame, [0, 24], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.7, 0, 0.3, 1) })}
      />

      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", flexDirection: "column", gap: 34 }}>
        <div style={{ scale: logo, rotate: `${(1 - logo) * -90}deg` }}>
          <Logo size={300} />
        </div>
        <div
          style={{
            display: "flex",
            gap: 34,
            fontFamily: "Barlow Condensed",
            fontWeight: 800,
            fontSize: 210,
            lineHeight: 0.88,
            textTransform: "uppercase",
          }}
        >
          <Reveal delay={INTRO.title}>
            <span style={{ color: C.paper }}>Ligas Rurales</span>
          </Reveal>
          <Reveal delay={INTRO.title + 6}>
            <span style={{ color: C.gold }}>Quito</span>
          </Reveal>
        </div>
        <Interactive.Div
          name="Tagline"
          style={{
            fontFamily: sans,
            fontWeight: 600,
            fontSize: 60,
            color: C.paper,
            opacity: interpolate(frame, [INTRO.tagline, INTRO.tagline + 15], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
            translate: interpolate(frame, [INTRO.tagline, INTRO.tagline + 15], ["0px 30px", "0px 0px"], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            }),
          }}
        >
          {BRAND.tournament}
        </Interactive.Div>
      </AbsoluteFill>

      <Interactive.Div
        name="Features strip"
        style={{
          position: "absolute",
          bottom: 100,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: sans,
          fontWeight: 700,
          fontSize: 34,
          letterSpacing: "0.22em",
          color: C.lavenderSoft,
          opacity: interpolate(frame, [INTRO.strip, INTRO.strip + 15], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        }}
      >
        16 LIGAS PARROQUIALES · 4 GRUPOS · ECUAVÓLEY EN VIVO
      </Interactive.Div>
    </AbsoluteFill>
  );
};
