import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { BigTitle, BrowserFrame, Check, Kicker, useEnter } from "../components";
import { C, display, sans } from "../theme";

const FEATURES = [
  "Arrastrar y soltar partidos",
  "Alertas de conflictos",
  "Nóminas por CSV",
  "Árbitros y sedes",
  "Roles e invitaciones",
  "Auditoría de cambios",
];

const NAV = ["Panel", "Torneos", "Partidos", "Equipos", "Árbitros", "Sedes", "Usuarios", "Auditoría"];
const DAYS = ["SÁB 12", "DOM 13", "SÁB 19"];
const HOURS = ["09:00", "10:00", "11:00", "12:00"];
const COL = 220;
const ROW = 112;
const LEFT = 80;
const TOP = 46;

const STATIC_CHIPS = [
  { d: 0, h: 0, t: "LEO vs ÁGU", c: C.orange },
  { d: 0, h: 1, t: "TIG vs CÓN", c: C.ink, conflict: true },
  { d: 1, h: 0, t: "OSO vs LOB", c: C.rose },
  { d: 2, h: 1, t: "COL vs JAG", c: C.sky },
  { d: 1, h: 3, t: "ÁGU vs PUM", c: C.sky },
  { d: 2, h: 3, t: "LEO vs TIG", c: C.orange },
];

const MOVE_START = 96;
const MOVE_END = 128;

const Chip: React.FC<{ text: string; color: string; bad: boolean; style?: React.CSSProperties }> = ({ text, color, bad, style }) => (
  <div
    style={{
      position: "absolute",
      width: COL - 16,
      height: 46,
      borderRadius: 10,
      background: bad ? "#fde5ea" : C.paper,
      border: `3px solid ${bad ? C.live : C.line}`,
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "0 10px",
      fontFamily: sans,
      fontWeight: 700,
      fontSize: 21,
      color: C.ink,
      ...style,
    }}
  >
    <span style={{ width: 14, height: 14, borderRadius: 7, background: color, flexShrink: 0 }} />
    {text}
  </div>
);

const cell = (d: number, h: number, slot = 0) => ({ left: LEFT + d * COL + 8, top: TOP + h * ROW + 8 + slot * 54 });

export const Admin: React.FC = () => {
  const frame = useCurrentFrame();
  const browser = useEnter(12);
  const fixed = frame >= MOVE_END;
  const lift = interpolate(frame, [MOVE_START - 8, MOVE_START], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) *
    interpolate(frame, [MOVE_END, MOVE_END + 6], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const t = interpolate(frame, [MOVE_START, MOVE_END], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  const from = cell(0, 1, 1);
  const to = cell(1, 2);
  const pos = { left: from.left + (to.left - from.left) * t, top: from.top + (to.top - from.top) * t };
  const typed = "Leones".slice(0, Math.floor(interpolate(frame, [28, 58], [0, 6], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })));
  const cursor = interpolate(frame, [70, 80, 140, 150], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill name="Admin" style={{ backgroundColor: C.ink }}>
      <div style={{ position: "absolute", left: 120, top: 130, width: 640, display: "flex", flexDirection: "column", gap: 30 }}>
        <Kicker delay={4} color={C.paper} bar={C.volt}>
          Administración
        </Kicker>
        <BigTitle lines={["Admin", "completo"]} delay={6} size={150} color={C.paper} />
        <div style={{ display: "flex", flexDirection: "column", gap: 20, marginTop: 10 }}>
          {FEATURES.map((f, i) => (
            <Feature key={f} delay={24 + i * 9}>
              {f}
            </Feature>
          ))}
        </div>
      </div>

      <div style={{ position: "absolute", right: 120, top: 150, opacity: browser, translate: `${(1 - browser) * 200}px 0px` }}>
        <BrowserFrame width={1000} height={760} url="voley.ec/admin/partidos">
          <div style={{ position: "absolute", inset: 0, display: "flex" }}>
            <div style={{ width: 200, background: C.ink, padding: "24px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontFamily: display, fontWeight: 800, fontSize: 34, color: C.paper, padding: "0 12px 16px" }}>
                VOLEY <span style={{ color: C.volt }}>EC</span>
              </div>
              {NAV.map((n) => (
                <div
                  key={n}
                  style={{
                    padding: "12px 14px",
                    borderRadius: 12,
                    fontFamily: sans,
                    fontWeight: 600,
                    fontSize: 21,
                    background: n === "Partidos" ? C.volt : "transparent",
                    color: n === "Partidos" ? C.ink : "#c9c9cc",
                  }}
                >
                  {n}
                </div>
              ))}
            </div>

            <div style={{ flex: 1, padding: 24, display: "flex", flexDirection: "column", gap: 18, background: C.paper }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div
                  style={{
                    flex: 1,
                    height: 52,
                    borderRadius: 26,
                    background: C.grey,
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "0 20px",
                    fontFamily: sans,
                    fontSize: 22,
                    color: typed ? C.ink : C.muted,
                  }}
                >
                  <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth={2.5}>
                    <circle cx="11" cy="11" r="7" />
                    <path d="M20 20l-4-4" />
                  </svg>
                  {typed || "Buscar equipos, jugadores, partidos…"}
                  {typed && frame % 20 < 12 ? <span style={{ width: 2, height: 26, background: C.ink }} /> : null}
                  <span style={{ marginLeft: "auto", fontWeight: 700, fontSize: 18, color: C.muted, border: `2px solid ${C.line}`, borderRadius: 8, padding: "2px 8px" }}>⌘K</span>
                </div>
              </div>
              <div
                style={{
                  alignSelf: "flex-start",
                  padding: "10px 20px",
                  borderRadius: 999,
                  background: fixed ? "#dff3e7" : C.live,
                  color: fixed ? C.ok : C.paper,
                  fontFamily: sans,
                  fontWeight: 700,
                  fontSize: 22,
                }}
              >
                {fixed ? "✓ Sin conflictos de horario" : "2 partidos con conflicto · sede ocupada"}
              </div>

              <div style={{ position: "relative", height: TOP + ROW * HOURS.length, border: `2px solid ${C.line}`, borderRadius: 16, overflow: "hidden" }}>
                {DAYS.map((d, i) => (
                  <div
                    key={d}
                    style={{
                      position: "absolute",
                      left: LEFT + i * COL,
                      top: 0,
                      width: COL,
                      height: "100%",
                      borderLeft: `2px solid ${C.line}`,
                      background: frame >= MOVE_START && frame < MOVE_END ? "#fafafa" : C.paper,
                    }}
                  >
                    <div style={{ height: TOP, display: "flex", alignItems: "center", padding: "0 12px", fontFamily: sans, fontWeight: 800, fontSize: 18, letterSpacing: "0.08em", borderBottom: `2px solid ${C.line}` }}>
                      {d}
                    </div>
                  </div>
                ))}
                {HOURS.map((h, i) => (
                  <div
                    key={h}
                    style={{
                      position: "absolute",
                      left: 0,
                      right: 0,
                      top: TOP + i * ROW,
                      height: ROW,
                      borderBottom: `2px solid ${C.line}`,
                      fontFamily: sans,
                      fontSize: 18,
                      color: C.muted,
                      padding: "10px 12px",
                    }}
                  >
                    {h}
                  </div>
                ))}
                {STATIC_CHIPS.map((c) => (
                  <Chip key={c.t + c.d} text={c.t} color={c.c} bad={Boolean(c.conflict) && !fixed} style={cell(c.d, c.h)} />
                ))}
                <Chip
                  text="PUM vs HAL"
                  color="#00a36c"
                  bad={!fixed}
                  style={{
                    ...pos,
                    scale: 1 + lift * 0.06,
                    boxShadow: lift > 0 ? `0 ${16 * lift}px ${30 * lift}px rgba(0,0,0,0.25)` : undefined,
                    zIndex: 2,
                  }}
                />
                <svg
                  width={40}
                  height={40}
                  viewBox="0 0 24 24"
                  style={{ position: "absolute", left: pos.left + 150, top: pos.top + 24, opacity: cursor, zIndex: 3 }}
                >
                  <path d="M4 2l16 9-7 1.6L9.5 20z" fill={C.ink} stroke={C.paper} strokeWidth={1.5} strokeLinejoin="round" />
                </svg>
              </div>
            </div>
          </div>
        </BrowserFrame>
      </div>
    </AbsoluteFill>
  );
};

const Feature: React.FC<{ delay: number; children: React.ReactNode }> = ({ delay, children }) => {
  const p = useEnter(delay);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 22,
        fontFamily: sans,
        fontWeight: 600,
        fontSize: 42,
        color: C.paper,
        opacity: p,
        translate: `${(1 - p) * -40}px 0px`,
      }}
    >
      <Check size={50} />
      {children}
    </div>
  );
};
