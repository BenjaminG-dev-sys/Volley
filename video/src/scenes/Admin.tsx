import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { BigTitle, BrowserFrame, Check, Kicker, Logo, useEnter } from "../components";
import { BRAND, ROUND3, RULES, VENUES, team } from "../data";
import { C, display, sans } from "../theme";
import { ADMIN } from "../timeline";

const FEATURES = [
  "Arrastrar y soltar partidos",
  "Alerta de sede ocupada",
  `Nóminas por CSV (hasta ${RULES.maxRoster})`,
  "Árbitros y sedes",
  "Roles e invitaciones",
  "Auditoría de cambios",
];

const NAV = ["Panel", "Torneos", "Partidos", "Ligas", "Árbitros", "Sedes", "Usuarios", "Auditoría"];
const TIMES = ["10:00", "11:30", "13:00", "14:30"];
const LEFT = 84;
const COL = 222;
const TOP = 64;
const ROW = 116;

// El partido que se reprograma: Guayllabamba–Puembo empieza encima de Cumbayá–Tumbaco
// (13:00, misma sede) y se arrastra a la sede libre, que es su lugar real en el calendario.
const MOVED = ROUND3.findIndex((m) => m.home === "guayllabamba");
const FROM = { row: 2, col: 1, slot: 1 };
const TO = { row: 2, col: ROUND3[MOVED].venue, slot: 0 };
const MOVE_START = ADMIN.moveStart;
const MOVE_END = ADMIN.moveEnd;

const cell = (row: number, col: number, slot = 0) => ({ left: LEFT + col * COL + 8, top: TOP + row * ROW + 10 + slot * 52 });

const Chip: React.FC<{ i: number; bad: boolean; live?: boolean; style?: React.CSSProperties }> = ({ i, bad, live, style }) => {
  const m = ROUND3[i];
  const h = team(m.home);
  const a = team(m.away);
  return (
    <div
      style={{
        position: "absolute",
        width: COL - 16,
        height: 46,
        borderRadius: 10,
        background: bad ? "#fde4e8" : C.paper,
        border: `3px solid ${bad ? C.red : C.line}`,
        borderLeft: `10px solid ${h.color}`,
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "0 6px",
        fontFamily: sans,
        fontWeight: 700,
        fontSize: 15,
        color: C.ink,
        whiteSpace: "nowrap",
        overflow: "hidden",
        ...style,
      }}
    >
      {live ? <span style={{ width: 10, height: 10, borderRadius: 5, background: C.red, flexShrink: 0 }} /> : null}
      {h.short}–{a.short}
    </div>
  );
};

export const Admin: React.FC = () => {
  const frame = useCurrentFrame();
  const browser = useEnter(12);
  const fixed = frame >= MOVE_END;
  const lift =
    interpolate(frame, [MOVE_START - 8, MOVE_START], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) *
    interpolate(frame, [MOVE_END, MOVE_END + 6], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const t = interpolate(frame, [MOVE_START, MOVE_END], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });
  const from = cell(FROM.row, FROM.col, FROM.slot);
  const to = cell(TO.row, TO.col, TO.slot);
  const pos = { left: from.left + (to.left - from.left) * t, top: from.top + (to.top - from.top) * t };
  const query = "El Quinche";
  const typed = query.slice(0, Math.floor(interpolate(frame, [ADMIN.typeFrom, ADMIN.typeTo], [0, query.length], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })));
  const cursor = interpolate(frame, [75, 85, 135, 150], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const rowOf = (time: string) => TIMES.indexOf(time);

  return (
    <AbsoluteFill name="Admin" style={{ backgroundColor: C.ink }}>
      <div style={{ position: "absolute", left: 120, top: 130, width: 640, display: "flex", flexDirection: "column", gap: 30 }}>
        <Kicker delay={4} color={C.paper} bar={C.gold}>
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

      <div style={{ position: "absolute", right: 120, top: 140, opacity: browser, translate: `${(1 - browser) * 200}px 0px` }}>
        <BrowserFrame width={1000} height={780} url={`${BRAND.web}/admin/partidos`}>
          <div style={{ position: "absolute", inset: 0, display: "flex" }}>
            <div style={{ width: 200, background: C.ink, padding: "22px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 6px 16px" }}>
                <Logo size={46} variant="emblema" style={{ boxShadow: "none" }} />
                <div style={{ fontFamily: display, fontWeight: 800, fontSize: 24, lineHeight: 0.95, color: C.paper, textTransform: "uppercase" }}>
                  Ligas
                  <br />
                  <span style={{ color: C.gold }}>Rurales</span>
                </div>
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
                    background: n === "Partidos" ? C.gold : "transparent",
                    color: n === "Partidos" ? C.ink : C.lavenderSoft,
                  }}
                >
                  {n}
                </div>
              ))}
            </div>

            <div style={{ flex: 1, padding: 24, display: "flex", flexDirection: "column", gap: 16, background: C.paper }}>
              <div style={{ height: 52, borderRadius: 26, background: C.surface, display: "flex", alignItems: "center", gap: 12, padding: "0 20px", fontFamily: sans, fontSize: 22, color: typed ? C.ink : C.muted }}>
                <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth={2.5}>
                  <circle cx="11" cy="11" r="7" />
                  <path d="M20 20l-4-4" />
                </svg>
                {typed || "Buscar ligas, jugadores, partidos…"}
                {typed && frame % 20 < 12 ? <span style={{ width: 2, height: 26, background: C.ink }} /> : null}
                <span style={{ marginLeft: "auto", fontWeight: 700, fontSize: 18, color: C.muted, border: `2px solid ${C.line}`, borderRadius: 8, padding: "2px 8px" }}>⌘K</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <span style={{ fontFamily: display, fontWeight: 800, fontSize: 28, color: C.ink, textTransform: "uppercase" }}>Jornada 3 · hoy</span>
                <span style={{ padding: "8px 18px", borderRadius: 999, background: fixed ? "#dcefe3" : C.red, color: fixed ? C.ok : C.paper, fontFamily: sans, fontWeight: 700, fontSize: 20 }}>
                  {fixed ? "✓ Sin conflictos de horario" : `Sede ocupada: ${VENUES[1]}`}
                </span>
              </div>

              <div style={{ position: "relative", height: TOP + ROW * TIMES.length, border: `2px solid ${C.line}`, borderRadius: 16, overflow: "hidden" }}>
                {VENUES.map((v, i) => (
                  <div key={v} style={{ position: "absolute", left: LEFT + i * COL, top: 0, width: COL, height: "100%", borderLeft: `2px solid ${C.line}`, background: frame >= MOVE_START && frame < MOVE_END ? "#f8f8fc" : C.paper }}>
                    <div style={{ height: TOP, display: "flex", alignItems: "center", padding: "0 10px", fontFamily: sans, fontWeight: 800, fontSize: 16, lineHeight: 1.15, color: C.ink, borderBottom: `2px solid ${C.line}` }}>{v}</div>
                  </div>
                ))}
                {TIMES.map((h, i) => (
                  <div key={h} style={{ position: "absolute", left: 0, right: 0, top: TOP + i * ROW, height: ROW, borderBottom: `2px solid ${C.line}`, fontFamily: sans, fontSize: 18, color: C.muted, padding: "12px 12px" }}>
                    {h}
                  </div>
                ))}
                {ROUND3.map((m, i) =>
                  i === MOVED ? null : (
                    <Chip key={i} i={i} live={i === 0} bad={!fixed && rowOf(m.time) === FROM.row && m.venue === FROM.col} style={cell(rowOf(m.time), m.venue)} />
                  ),
                )}
                <Chip
                  i={MOVED}
                  bad={!fixed}
                  style={{ ...pos, scale: 1 + lift * 0.06, boxShadow: lift > 0 ? `0 ${16 * lift}px ${30 * lift}px rgba(0,10,40,0.25)` : undefined, zIndex: 2 }}
                />
                <svg width={40} height={40} viewBox="0 0 24 24" style={{ position: "absolute", left: pos.left + 160, top: pos.top + 22, opacity: cursor, zIndex: 3 }}>
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
    <div style={{ display: "flex", alignItems: "center", gap: 22, fontFamily: sans, fontWeight: 600, fontSize: 42, color: C.paper, opacity: p, translate: `${(1 - p) * -40}px 0px` }}>
      <Check size={50} bg={C.gold} color={C.ink} />
      {children}
    </div>
  );
};
