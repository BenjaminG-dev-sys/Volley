// Utilidades de color puras: contraste WCAG y variables CSS para "teñir" una página
// con el color de un equipo o torneo.

const INK = "#111111";
const PAPER = "#ffffff";

function parse(hex: string): [number, number, number] {
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3) h = [...h].map((c) => c + c).join("");
  if (!/^[0-9a-f]{6}$/i.test(h)) return [17, 17, 17];
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

const toHex = (rgb: number[]) => `#${rgb.map((c) => Math.round(Math.min(255, Math.max(0, c))).toString(16).padStart(2, "0")).join("")}`;

/** Luminancia relativa WCAG (0 = negro, 1 = blanco). */
export function luminance(hex: string): number {
  const [r, g, b] = parse(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Razón de contraste WCAG entre dos colores (1..21). */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Texto legible (negro o blanco) sobre `bg`: el de mayor contraste. */
export const readableOn = (bg: string) => (contrast(bg, INK) >= contrast(bg, PAPER) ? INK : PAPER);

/** Mezcla lineal de `a` hacia `b` (t = 0 → a, t = 1 → b). */
export function mix(a: string, b: string, t: number): string {
  const ca = parse(a);
  const cb = parse(b);
  return toHex(ca.map((c, i) => c + (cb[i] - c) * t));
}

/** Variables CSS para teñir un bloque con el color de un equipo: `style={teamVars(team.color_primary)}`. */
export function teamVars(hex: string): Record<string, string> {
  const team = toHex(parse(hex));
  return { "--team": team, "--team-ink": readableOn(team), "--team-soft": mix(team, PAPER, 0.85) };
}

/** Sigla para un escudo sin logo: "Club Deportivo Quito" → "CDQ", "LDU" → "LDU". */
export function initials(name: string, max = 3): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, max).toUpperCase();
  return words
    .map((w) => w[0])
    .join("")
    .slice(0, max)
    .toUpperCase();
}
