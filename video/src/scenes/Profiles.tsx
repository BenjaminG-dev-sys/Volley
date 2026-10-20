import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { BigTitle, BrandBand, DeviceFrame, FadeUp, Kicker, Logo, Pill, useEnter } from "../components";
import { BRAND, MESA_START, ROSTERS, ROUND3, team, type TeamId } from "../data";
import { C, ESFERA, display, sans } from "../theme";

const CARDS: { id: TeamId; rot: number; x: number; y: number }[] = [
  { id: "elQuinche", rot: -8, x: 0, y: 70 },
  { id: "amaguana", rot: 4, x: 280, y: 30 },
];

const PlayerCard: React.FC<{ card: (typeof CARDS)[number]; delay: number }> = ({ card, delay }) => {
  const p = useEnter(delay, 16);
  const t = team(card.id);
  const cap = ROSTERS[card.id]![0];
  return (
    <div
      style={{
        position: "absolute",
        left: card.x,
        top: card.y,
        width: 320,
        height: 450,
        borderRadius: 28,
        background: t.color,
        color: C.paper,
        padding: 28,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        boxShadow: "0 30px 70px rgba(0,10,40,0.35)",
        rotate: `${card.rot * p}deg`,
        translate: `0px ${(1 - p) * 500}px`,
      }}
    >
      <div style={{ fontFamily: sans, fontWeight: 700, fontSize: 22, letterSpacing: "0.14em", textTransform: "uppercase" }}>Liga {t.short}</div>
      <div style={{ fontFamily: display, fontWeight: 800, fontSize: 240, lineHeight: 0.8 }}>{cap.n}</div>
      <div>
        <div style={{ fontFamily: display, fontWeight: 800, fontSize: 34, lineHeight: 1, textTransform: "uppercase" }}>{cap.name}</div>
        <div style={{ marginTop: 8, fontFamily: sans, fontWeight: 600, fontSize: 22, color: C.gold }}>{cap.role} · Capitán</div>
      </div>
    </div>
  );
};

export const Profiles: React.FC = () => {
  const frame = useCurrentFrame();
  const phone = useEnter(40, 16);
  const sheet = useEnter(80, 18);
  const pulse = 0.5 + 0.5 * Math.sin(frame / 4);
  const home = team("elQuinche");
  const away = team("amaguana");

  return (
    <AbsoluteFill name="Ligas y app" style={{ backgroundColor: C.red }}>
      <div style={{ position: "absolute", left: 120, top: 140, width: 720, display: "flex", flexDirection: "column", gap: 34 }}>
        <Kicker delay={4} color={C.paper} bar={C.gold}>
          Ligas, nóminas y app
        </Kicker>
        <BigTitle lines={["Tu liga", "en el", "bolsillo"]} delay={6} size={160} color={C.paper} />
        <FadeUp delay={22} style={{ fontFamily: sans, fontWeight: 500, fontSize: 46, lineHeight: 1.2, color: C.paper }}>
          Cada parroquia con su color y su nómina. Se instala como app desde el celular.
        </FadeUp>
      </div>

      <div style={{ position: "absolute", left: 900, top: 160, width: 880, height: 780 }}>
        {CARDS.map((c, i) => (
          <PlayerCard key={c.id} card={c} delay={10 + i * 7} />
        ))}

        <div style={{ position: "absolute", right: 0, top: 0, translate: `${(1 - phone) * 600}px 0px`, rotate: `${(1 - phone) * 10}deg` }}>
          <DeviceFrame width={380} height={770} radius={56} bezel={16}>
            <div style={{ position: "absolute", inset: 0, background: C.paper, display: "flex", flexDirection: "column" }}>
              <BrandBand height={6} />
              <div style={{ height: 84, display: "flex", alignItems: "center", gap: 10, padding: "14px 18px 0" }}>
                <Logo size={46} variant="emblema" style={{ boxShadow: "none", border: `1px solid ${C.line}` }} />
                <div style={{ fontFamily: display, fontWeight: 800, fontSize: 22, lineHeight: 0.95, textTransform: "uppercase", color: C.ink }}>
                  {BRAND.name}
                  <div style={{ fontSize: 15, letterSpacing: "0.14em", color: C.red }}>{BRAND.place}</div>
                </div>
              </div>
              <div style={{ margin: "10px 0 0", padding: "26px 20px", background: ESFERA, color: C.paper }}>
                <div style={{ fontFamily: display, fontWeight: 800, fontSize: 46, lineHeight: 0.9, textTransform: "uppercase" }}>
                  Cada liga,
                  <br />
                  en vivo
                </div>
                <div style={{ marginTop: 16, borderRadius: 18, background: "rgba(0,10,40,0.55)", padding: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: sans, fontWeight: 700, fontSize: 15, letterSpacing: "0.12em" }}>
                    <span style={{ width: 12, height: 12, borderRadius: 6, background: C.red, opacity: 0.4 + pulse * 0.6 }} />
                    EN VIVO · SET 1
                  </div>
                  <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center", fontFamily: display, fontWeight: 800, fontSize: 30 }}>
                    <span>{home.short}</span>
                    <span style={{ color: C.gold }}>
                      {MESA_START.h}-{MESA_START.a}
                    </span>
                    <span>{away.short}</span>
                  </div>
                </div>
              </div>
              <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ fontFamily: sans, fontWeight: 700, fontSize: 14, letterSpacing: "0.14em", color: C.muted }}>PRÓXIMOS · HOY</div>
                {ROUND3.filter((m) => m.time === "11:30").map((m) => (
                  <div key={m.home} style={{ padding: "12px 14px", borderRadius: 14, background: C.surface, fontFamily: sans, fontWeight: 600, fontSize: 17, color: C.ink }}>
                    {m.time} · {team(m.home).short} vs {team(m.away).short}
                  </div>
                ))}
              </div>
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: C.paper,
                  borderTopLeftRadius: 28,
                  borderTopRightRadius: 28,
                  boxShadow: "0 -20px 40px rgba(0,10,40,0.18)",
                  padding: 24,
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                  translate: `0px ${(1 - sheet) * 320}px`,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <Logo size={54} variant="emblema" style={{ boxShadow: "none", border: `1px solid ${C.line}` }} />
                  <div style={{ fontFamily: display, fontWeight: 800, fontSize: 32, textTransform: "uppercase", color: C.ink }}>Instalar la app</div>
                </div>
                <div style={{ fontFamily: sans, fontSize: 18, color: C.muted }}>Abre la mesa y el marcador aunque no haya señal.</div>
                <div
                  style={{
                    height: 60,
                    borderRadius: 30,
                    background: C.navy,
                    color: C.paper,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: sans,
                    fontWeight: 800,
                    fontSize: 22,
                    scale: interpolate(frame, [120, 126, 132], [1, 0.94, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
                  }}
                >
                  Instalar
                </div>
              </div>
            </div>
          </DeviceFrame>
        </div>

        <FadeUp delay={100} style={{ position: "absolute", left: 20, top: 610 }}>
          <Pill size={34} bg={C.ink} color={C.paper}>
            16 ligas · 96 jugadores
          </Pill>
        </FadeUp>
      </div>
    </AbsoluteFill>
  );
};
