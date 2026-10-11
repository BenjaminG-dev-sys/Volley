"use client";

import { createClient } from "@insforge/sdk";
import { createBrowserClient } from "@insforge/sdk/ssr";

type BrowserClient = Pick<ReturnType<typeof createBrowserClient>, "database" | "realtime">;
let client: BrowserClient | null = null;

/**
 * Cliente del navegador. Con sesión usa la cookie de acceso (y renueva el token);
 * el público usa la clave anónima sin intentar renovar una sesión inexistente.
 */
export function insforge(): BrowserClient {
  if (client) return client;
  const hasSession = typeof document !== "undefined" && document.cookie.includes("insforge_access_token=");
  client = hasSession
    ? createBrowserClient()
    : createClient({ baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL, anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY });
  return client;
}
