import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { Ball, BigTitle, DeviceFrame, FadeUp, Kicker, Pill, useEnter } from "../components";
import { C, display, sans } from "../theme";

const CARDS = [
  { name: "Leones", player: "A. Mora", num: 7, bg: C.orange, ink: C.ink, rot: -8, x: 0, y: 70 },
  { name: "Águilas", player: "J. Cedeño", num: 12, bg: C.sky, ink: C.paper, rot: 4, x: 230, y: 30 },
];

const PlayerCard: React.FC<{ card: (typeof CARDS)[number]; delay: number }> = ({ card, delay }) => {
  const p = useEnter(delay, 16);
  return (
    <div
      style={{
        position: "absolute",
        left: card.x,
        top: card.y,
        width: 320,
        height: 440,
        borderRadius: 28,
        background: card.bg,
        color: card.ink,
        padding: 28,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        boxShadow: "0 30px 70px rgba(0,0,0,0.3)",
        rotate: `${card.rot * p}deg`,
        translate: `0px ${(1 - p) * 500}px`,
      }}
    >
      <div style={{ fontFamily: sans, fontWeight: 700, fontSize: 24, letterSpacing: "0.16em", textTransform: "uppercase" }}>{card.name}</div>
      <div style={{ fontFamily: display, fontWeight: 800, fontSize: 250, lineHeight: 0.8 }}>{card.num}</div>
      <div style={{ fontFamily: display, fontWeight: 800, fontSize: 46, textTransform: "uppercase" }}>{card.player}</div>
    </div>
  );
};

export const Profiles: React.FC = () => {
  const frame = useCurrentFrame();
  const phone = useEnter(40, 16);
  const sheet = useEnter(80, 18);
  const pulse = 0.5 + 0.5 * Math.sin(frame / 4);

  return (
    <AbsoluteFill name="Perfiles" style={{ backgroundColor: C.rose }}>
      <div style={{ position: "absolute", left: 120, top: 140, width: 700, display: "flex", flexDirection: "column", gap: 34 }}>
        <Kicker delay={4}>Perfiles y app</Kicker>
        <BigTitle lines={["Tu liga", "en el", "bolsillo"]} delay={6} size={160} />
        <FadeUp delay={22} style={{ fontFamily: sans, fontWeight: 500, fontSize: 48, lineHeight: 1.2, color: C.ink }}>
          Perfiles con los colores de cada equipo. Se instala como app y abre sin señal.
        </FadeUp>
      </div>

      <div style={{ position: "absolute", left: 900, top: 170, width: 880, height: 760 }}>
        {CARDS.map((c, i) => (
          <PlayerCard key={c.name} card={c} delay={10 + i * 7} />
        ))}

        <div
          style={{
            position: "absolute",
            right: 0,
            top: 0,
            translate: `${(1 - phone) * 600}px 0px`,
            rotate: `${(1 - phone) * 10}deg`,
          }}
        >
          <DeviceFrame width={380} height={760} radius={56} bezel={16}>
            <div style={{ position: "absolute", inset: 0, background: C.paper, display: "flex", flexDirection: "column" }}>
              <div style={{ height: 96, background: C.ink, display: "flex", alignItems: "flex-end", justifyContent: "space-between", padding: "0 22px 18px" }}>
                <div style={{ fontFamily: display, fontWeight: 800, fontSize: 34, color: C.paper }}>
                  VOLEY <span style={{ color: C.volt }}>EC</span>
                </div>
                <Ball size={30} color={C.volt} />
              </div>
              <div style={{ margin: 18, borderRadius: 20, background: C.ink, padding: 20, color: C.paper, display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: sans, fontWeight: 700, fontSize: 16, letterSpacing: "0.14em" }}>
                  <span style={{ width: 12, height: 12, borderRadius: 6, background: C.live, opacity: 0.4 + pulse * 0.6 }} />
                  EN VIVO · SET 3
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontFamily: display, fontWeight: 800, fontSize: 40 }}>
                  <span>LEO</span>
                  <span style={{ color: C.volt }}>25 – 23</span>
                  <span>ÁGU</span>
                </div>
              </div>
              {["Tigres vs Cóndores · 16:00", "Pumas vs Halcones · 17:30"].map((m) => (
                <div key={m} style={{ margin: "0 18px 12px", padding: 18, borderRadius: 16, background: C.grey, fontFamily: sans, fontWeight: 600, fontSize: 19, color: C.ink }}>
                  {m}
                </div>
              ))}
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: C.paper,
                  borderTopLeftRadius: 28,
                  borderTopRightRadius: 28,
                  boxShadow: "0 -20px 40px rgba(0,0,0,0.15)",
                  padding: 24,
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                  translate: `0px ${(1 - sheet) * 300}px`,
                }}
              >
                <div style={{ fontFamily: display, fontWeight: 800, fontSize: 36, textTransform: "uppercase", color: C.ink }}>Instalar Voley EC</div>
                <div style={{ fontFamily: sans, fontSize: 18, color: C.muted }}>Abre la mesa y el marcador aunque no haya internet.</div>
                <div
                  style={{
                    height: 62,
                    borderRadius: 31,
                    background: C.ink,
                    color: C.volt,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: sans,
                    fontWeight: 800,
                    fontSize: 22,
                    scale: interpolate(frame, [120, 126, 132], [1, 0.94, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
                  }}
                >
                  Instalar app
                </div>
              </div>
            </div>
          </DeviceFrame>
        </div>

        <FadeUp delay={100} style={{ position: "absolute", left: 20, top: 600 }}>
          <Pill size={36} bg={C.ink} color={C.paper}>
            Perfiles públicos
          </Pill>
        </FadeUp>
      </div>
    </AbsoluteFill>
  );
};
