import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Voley EC · Torneos de vóley y ecuavóley",
    short_name: "Voley EC",
    description: "Torneos, posiciones y planilla electrónica con marcador en vivo. La mesa de control funciona sin conexión.",
    lang: "es-EC",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#111111",
    theme_color: "#111111",
    categories: ["sports"],
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Mesa de control", short_name: "Mesa", url: "/mesa" },
      { name: "Equipos", url: "/equipos" },
    ],
  };
}
