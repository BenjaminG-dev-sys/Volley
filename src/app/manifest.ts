import type { MetadataRoute } from "next";
import { BRAND } from "@/lib/brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: BRAND.name,
    short_name: BRAND.short,
    description: "Campeonatos interparroquiales, posiciones y planilla electrónica con marcador en vivo. La mesa de control funciona sin conexión.",
    lang: "es-EC",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#ffffff",
    theme_color: BRAND.colors.navy,
    categories: ["sports"],
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/brand/icon-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Mesa de control", short_name: "Mesa", url: "/mesa" },
      { name: "Ligas parroquiales", short_name: "Ligas", url: "/equipos" },
    ],
  };
}
