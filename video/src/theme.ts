import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

// Misma identidad que voley.integroecuador.com: Barlow Condensed para titulares, Inter para texto.
// Las fuentes (licencia OFL) van en public/fonts para que el render no dependa de la red.
export const display = "Barlow Condensed";
export const sans = "Inter";

for (const weight of ["600", "700", "800"]) {
  loadFont({ family: display, url: staticFile(`fonts/BarlowCondensed-${weight}.woff2`), weight });
}
loadFont({ family: sans, url: staticFile("fonts/Inter-400-800.woff2"), weight: "400 800" });

// Paleta de la Asociación de Ligas Rurales del Cantón Quito (variables :root de la web).
export const C = {
  ink: "#001a5c",
  navy: "#002478",
  sky: "#2b3990",
  gold: "#f2c230",
  orange: "#ee7a2e",
  red: "#e4243c",
  lavender: "#9c95c4",
  lavenderSoft: "#ebe9f6",
  surface: "#f1f2f9",
  line: "#dde0ee",
  muted: "#5d6488",
  ok: "#0f7a3d",
  night: "#060b24",
  paper: "#ffffff",
} as const;

/** Fondo "esfera" del héroe de la web. */
export const ESFERA =
  "radial-gradient(circle at 84% 24%, #f4f2fb 0, #c3bee0 14%, #9c95c4 26%, #2b399000 52%), radial-gradient(circle at 10% 110%, #e4243c8c 0, #e4243c00 38%), linear-gradient(160deg, #2b3990, #001a5c)";

/** Franja de marca: rosa · dorado · naranja · azul · lavanda. */
export const BAND = [C.red, C.gold, C.orange, C.sky, C.lavender];

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;
