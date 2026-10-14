import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

// Misma identidad que la app: Barlow Condensed para titulares, Inter para texto.
// Las fuentes (licencia OFL) van en public/fonts para que el render no dependa de la red.
export const display = "Barlow Condensed";
export const sans = "Inter";

for (const weight of ["600", "700", "800"]) {
  loadFont({ family: display, url: staticFile(`fonts/BarlowCondensed-${weight}.woff2`), weight });
}
loadFont({ family: sans, url: staticFile("fonts/Inter-400-800.woff2"), weight: "400 800" });

// Base monocromo estilo Nike + colores de campaña (src/app/globals.css de la app).
export const C = {
  ink: "#111111",
  paper: "#ffffff",
  grey: "#f5f5f5",
  line: "#e5e5e5",
  muted: "#707072",
  volt: "#d4ff3a",
  orange: "#ff6b1a",
  sky: "#2459f5",
  sun: "#ffd100",
  rose: "#ff3d7f",
  live: "#d0002a",
  ok: "#00843d",
} as const;

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;
