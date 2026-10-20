import React from "react";
import {
  Easing,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { BAND, C, display, sans } from "./theme";

const clamp = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
} as const;

/** Progreso 0→1 con resorte suave, empezando en `delay` frames. */
export const useEnter = (delay = 0, damping = 200) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping } });
};

/** Línea que sube desde una máscara (titulares estilo campaña). */
export const Reveal: React.FC<{
  delay?: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ delay = 0, children, style }) => {
  const p = useEnter(delay);
  return (
    <div style={{ overflow: "hidden", paddingBottom: "0.04em", ...style }}>
      <div style={{ translate: `0 ${(1 - p) * 110}%` }}>{children}</div>
    </div>
  );
};

export const BigTitle: React.FC<{
  lines: React.ReactNode[];
  delay?: number;
  size?: number;
  color?: string;
  stagger?: number;
}> = ({ lines, delay = 0, size = 150, color = C.ink, stagger = 5 }) => (
  <div
    style={{
      fontFamily: display,
      fontWeight: 800,
      fontSize: size,
      lineHeight: 0.88,
      textTransform: "uppercase",
      letterSpacing: "-0.01em",
      color,
    }}
  >
    {lines.map((l, i) => (
      <Reveal key={i} delay={delay + i * stagger}>
        {l}
      </Reveal>
    ))}
  </div>
);

export const Kicker: React.FC<{
  children: React.ReactNode;
  delay?: number;
  color?: string;
  bar?: string;
}> = ({ children, delay = 0, color = C.ink, bar = C.ink }) => {
  const p = useEnter(delay);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 18,
        fontFamily: sans,
        fontWeight: 700,
        fontSize: 32,
        letterSpacing: "0.2em",
        textTransform: "uppercase",
        color,
        opacity: p,
      }}
    >
      <div style={{ width: 70 * p, height: 8, background: bar }} />
      {children}
    </div>
  );
};

export const FadeUp: React.FC<{
  delay?: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ delay = 0, children, style }) => {
  const p = useEnter(delay);
  return (
    <div style={{ opacity: p, translate: `0 ${(1 - p) * 40}px`, ...style }}>
      {children}
    </div>
  );
};

export const Pill: React.FC<{
  children: React.ReactNode;
  bg?: string;
  color?: string;
  border?: string;
  size?: number;
  style?: React.CSSProperties;
}> = ({ children, bg = C.ink, color = C.paper, border, size = 40, style }) => (
  <div
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 14,
      padding: `${size * 0.36}px ${size * 0.7}px`,
      borderRadius: 999,
      background: bg,
      color,
      border: border ? `3px solid ${border}` : undefined,
      fontFamily: sans,
      fontWeight: 600,
      fontSize: size,
      lineHeight: 1,
      whiteSpace: "nowrap",
      ...style,
    }}
  >
    {children}
  </div>
);

export const Ball: React.FC<{ size?: number; color?: string; rotate?: number }> = ({
  size = 80,
  color = C.paper,
  rotate = 0,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={1.8}
    strokeLinecap="round"
    style={{ rotate: `${rotate}deg` }}
  >
    <circle cx="12" cy="12" r="10" />
    <path d="M12 2a10 10 0 0 0 0 20" />
    <path d="M2.5 9.5c4 1 9.5 0 14-4.5" />
    <path d="M5 19c2-5 7-9 15-9.5" />
  </svg>
);

export const Crest: React.FC<{ name: string; color: string; size?: number; ink?: string }> = ({
  name,
  color,
  size = 56,
  ink = C.paper,
}) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: "50%",
      background: color,
      color: ink,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: display,
      fontWeight: 800,
      fontSize: size * 0.44,
      flexShrink: 0,
    }}
  >
    {(name.includes(" ") ? name.split(" ").map((w) => w[0]).join("") : name.slice(0, 2)).slice(0, 2).toUpperCase()}
  </div>
);

export const Check: React.FC<{ size?: number; bg?: string; color?: string }> = ({
  size = 48,
  bg = C.gold,
  color = C.ink,
}) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: size * 0.22,
      background: bg,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    }}
  >
    <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12.5l5 5L20 6.5" />
    </svg>
  </div>
);

/** Marco de navegador para mostrar pantallas de la app. */
export const BrowserFrame: React.FC<{
  width: number;
  height: number;
  url?: string;
  children: React.ReactNode;
  dark?: boolean;
  style?: React.CSSProperties;
}> = ({ width, height, url = "voley.ec", children, dark = false, style }) => (
  <div
    style={{
      width,
      height,
      borderRadius: 28,
      overflow: "hidden",
      background: dark ? C.night : C.paper,
      boxShadow: "0 40px 90px rgba(0,10,40,0.35)",
      display: "flex",
      flexDirection: "column",
      ...style,
    }}
  >
    <div
      style={{
        height: 58,
        background: dark ? C.ink : C.surface,
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "0 24px",
        flexShrink: 0,
      }}
    >
      {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
        <div key={c} style={{ width: 16, height: 16, borderRadius: 8, background: c }} />
      ))}
      <div
        style={{
          marginLeft: 20,
          flex: 1,
          height: 34,
          borderRadius: 17,
          background: dark ? C.navy : C.paper,
          color: C.muted,
          fontFamily: sans,
          fontSize: 18,
          display: "flex",
          alignItems: "center",
          padding: "0 18px",
        }}
      >
        {url}
      </div>
    </div>
    <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>{children}</div>
  </div>
);

export const DeviceFrame: React.FC<{
  width: number;
  height: number;
  radius?: number;
  bezel?: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ width, height, radius = 48, bezel = 18, children, style }) => (
  <div
    style={{
      width,
      height,
      borderRadius: radius,
      background: "#030719",
      padding: bezel,
      boxShadow: "0 40px 90px rgba(0,0,0,0.35)",
      ...style,
    }}
  >
    <div
      style={{
        width: "100%",
        height: "100%",
        borderRadius: radius - bezel / 2,
        overflow: "hidden",
        position: "relative",
        background: C.paper,
      }}
    >
      {children}
    </div>
  </div>
);

/** Número que cuenta hacia arriba entre dos frames. */
export const Counter: React.FC<{
  to: number;
  from?: number;
  start?: number;
  duration?: number;
  style?: React.CSSProperties;
}> = ({ to, from = 0, start = 0, duration = 30, style }) => {
  const frame = useCurrentFrame();
  const v = interpolate(frame, [start, start + duration], [from, to], {
    ...clamp,
    easing: Easing.out(Easing.cubic),
  });
  return <span style={style}>{Math.round(v)}</span>;
};

export { clamp };

/** Franja de 5 colores de la marca (borde superior de la web). */
export const BrandBand: React.FC<{ height?: number; progress?: number; style?: React.CSSProperties }> = ({
  height = 14,
  progress = 1,
  style,
}) => (
  <div style={{ display: "flex", height, width: `${progress * 100}%`, ...style }}>
    {BAND.map((c) => (
      <div key={c} style={{ flex: 1, background: c }} />
    ))}
  </div>
);

/** Logo circular de la Asociación (con texto) o solo el emblema. */
export const Logo: React.FC<{ size: number; variant?: "logo" | "emblema"; style?: React.CSSProperties }> = ({
  size,
  variant = "logo",
  style,
}) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: "50%",
      background: C.paper,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      boxShadow: "0 20px 50px rgba(0,10,40,0.25)",
      flexShrink: 0,
      ...style,
    }}
  >
    <Img src={staticFile(`brand/${variant}.png`)} style={{ width: size * 0.86, height: size * 0.86, objectFit: "contain" }} />
  </div>
);
