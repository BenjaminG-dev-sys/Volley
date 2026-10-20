import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { Ball, BigTitle, Check, FadeUp, Kicker, useEnter } from "../components";
import { RULES, team } from "../data";
import { C, display, sans } from "../theme";

const CHIPS = [
  "3 por equipo: servidor, colocador y volador",
  "Con cambio de saque: solo suma quien saca",
  "Sets a 15 por 2 · al mejor de 3",
  "2 tiempos por set, solo para quien saca",
  "Sustitución libre · sin líbero",
];

// Cancha vista desde arriba (18 × 9 m): red al centro, cada lado con sus 3 roles.
const W = 760;
const H = 380;
const SPOTS = [
  { role: "Colocador", x: 0.36, y: 0.5 }, // junto a la red
  { role: "Volador", x: 0.2, y: 0.28 }, // fondo, defensa
  { role: "Servidor", x: 0.08, y: 0.74 }, // saca desde el fondo
];

const Player: React.FC<{ x: number; y: number; color: string; role: string; delay: number }> = ({ x, y, color, role, delay }) => {
  const p = useEnter(delay, 14);
  return (
    <div style={{ position: "absolute", left: x * W - 44, top: y * H - 44, width: 88, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, scale: p }}>
      <div style={{ width: 88, height: 88, borderRadius: 44, background: color, border: `5px solid ${C.paper}`, color: C.paper, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: display, fontWeight: 800, fontSize: 40 }}>
        {role[0]}
      </div>
      <div style={{ padding: "4px 12px", borderRadius: 999, background: C.ink, color: C.paper, fontFamily: sans, fontWeight: 700, fontSize: 20, whiteSpace: "nowrap" }}>{role}</div>
    </div>
  );
};

export const Rules: React.FC = () => {
  const frame = useCurrentFrame();
  const court = useEnter(10);
  const home = team("elQuinche");
  const away = team("amaguana");
  // Saque del servidor local que cruza la red.
  const t = interpolate(frame, [70, 110], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.quad) });
  const bx = 0.08 * W + t * (0.8 * W - 0.08 * W);
  const by = 0.74 * H + t * (0.3 * H - 0.74 * H) - Math.sin(t * Math.PI) * 120;

  return (
    <AbsoluteFill name="Reglamento" style={{ backgroundColor: C.surface }}>
      <div style={{ position: "absolute", left: 120, top: 130, width: 860, display: "flex", flexDirection: "column", gap: 30 }}>
        <Kicker delay={2} bar={C.red}>
          Reglamento del torneo
        </Kicker>
        <div style={{ whiteSpace: "nowrap" }}>
          <BigTitle lines={["Así se juega", "el ecuavóley"]} delay={4} size={124} color={C.ink} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18, marginTop: 6 }}>
          {CHIPS.map((c, i) => (
            <FadeUp key={c} delay={22 + i * 8} style={{ display: "flex", alignItems: "center", gap: 18, fontFamily: sans, fontWeight: 600, fontSize: 34, color: C.ink, whiteSpace: "nowrap" }}>
              <Check size={46} bg={C.gold} color={C.ink} />
              {c}
            </FadeUp>
          ))}
        </div>
      </div>

      <div style={{ position: "absolute", right: 120, top: 250, width: W, opacity: court, translate: `${(1 - court) * 160}px 0px` }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 18, fontFamily: display, fontWeight: 800, fontSize: 48, textTransform: "uppercase" }}>
          <span style={{ color: home.color }}>{home.short}</span>
          <span style={{ color: away.color }}>{away.short}</span>
        </div>
        <div style={{ position: "relative", width: W, height: H, background: "#e8a95a", border: `6px solid ${C.paper}`, borderRadius: 8, boxShadow: "0 30px 70px rgba(0,10,40,0.25)" }}>
          <div style={{ position: "absolute", left: W / 2 - 5, top: -30, width: 10, height: H + 60, background: C.ink, borderRadius: 5 }} />
          {SPOTS.map((s, i) => (
            <Player key={`h${s.role}`} x={s.x} y={s.y} color={home.color} role={s.role} delay={18 + i * 6} />
          ))}
          {SPOTS.map((s, i) => (
            <Player key={`a${s.role}`} x={1 - s.x} y={1 - s.y} color={away.color} role={s.role} delay={30 + i * 6} />
          ))}
          <div style={{ position: "absolute", left: bx - 26, top: by - 26, opacity: frame >= 66 ? 1 : 0 }}>
            <Ball size={52} color={C.ink} rotate={frame * 6} />
          </div>
        </div>
        <FadeUp delay={80} style={{ marginTop: 26, fontFamily: sans, fontWeight: 500, fontSize: 28, lineHeight: 1.3, color: C.muted }}>
          Nómina de hasta {RULES.maxRoster} jugadores. Variantes: sets a 12, a 10 o punto directo.
        </FadeUp>
      </div>
    </AbsoluteFill>
  );
};
