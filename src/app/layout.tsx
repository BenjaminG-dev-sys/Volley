import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Inter } from "next/font/google";
import Link from "next/link";
import { getSession, isStaff } from "@/lib/insforge/server";
import { ROLE_LABEL } from "@/lib/types";
import { signOut } from "./ingresar/actions";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const display = Barlow_Condensed({ variable: "--font-display-face", subsets: ["latin"], weight: ["600", "700", "800"] });

export const metadata: Metadata = {
  title: { default: "Gestión de Torneos de Voleibol", template: "%s · Torneos de Voleibol" },
  description: "Torneos, calendario, posiciones y planilla electrónica FIVB con marcador en vivo.",
};

export const viewport: Viewport = { themeColor: "#1e40af" };

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await getSession();
  const role = session?.profile?.role;
  const canScore = role === "scorer" || isStaff(session);

  return (
    <html lang="es-EC">
      <body className={`${inter.variable} ${display.variable} min-h-dvh font-sans antialiased`}>
        <header className="no-print sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
            <Link href="/" className="flex items-center gap-2 font-display text-lg font-bold tracking-tight">
              <span aria-hidden className="grid h-7 w-7 place-items-center rounded-full bg-primary text-sm text-primary-contrast">
                🏐
              </span>
              <span className="hidden sm:inline">Gestión de Torneos de Voleibol</span>
              <span className="sm:hidden">Torneos Vóley</span>
            </Link>
            <nav className="ml-auto flex items-center gap-1 text-sm">
              <Link className="rounded-lg px-2.5 py-1.5 hover:bg-surface-2" href="/">
                Inicio
              </Link>
              {canScore && (
                <Link className="rounded-lg px-2.5 py-1.5 hover:bg-surface-2" href="/mesa">
                  Mesa
                </Link>
              )}
              {isStaff(session) && (
                <Link className="rounded-lg px-2.5 py-1.5 hover:bg-surface-2" href="/admin">
                  Admin
                </Link>
              )}
              {session ? (
                <form action={signOut} className="flex items-center gap-2">
                  <span className="hidden text-xs text-muted md:inline">
                    {session.profile?.display_name || session.email} · {ROLE_LABEL[role ?? "viewer"]}
                  </span>
                  <button className="rounded-lg px-2.5 py-1.5 hover:bg-surface-2">Salir</button>
                </form>
              ) : (
                <Link className="rounded-lg bg-primary px-3 py-1.5 font-medium text-primary-contrast" href="/ingresar">
                  Ingresar
                </Link>
              )}
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6 sm:py-8">{children}</main>
      </body>
    </html>
  );
}
