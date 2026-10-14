import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Inter } from "next/font/google";
import Link from "next/link";
import { BallIcon } from "@/components/icons";
import { InstallButton, PwaRegister } from "@/components/pwa";
import { SiteHeader, type NavItem } from "@/components/site-header";
import { getSession, isStaff } from "@/lib/insforge/server";
import { ROLE_LABEL } from "@/lib/types";
import { signOut } from "./ingresar/actions";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const display = Barlow_Condensed({ variable: "--font-display-face", subsets: ["latin"], weight: ["600", "700", "800"] });

export const metadata: Metadata = {
  title: { default: "Voley EC · Torneos de voleibol", template: "%s · Voley EC" },
  description: "Torneos de vóley y ecuavóley: calendario, posiciones y planilla electrónica con marcador en vivo.",
  applicationName: "Voley EC",
  appleWebApp: { capable: true, title: "Voley EC", statusBarStyle: "black-translucent" },
  icons: { apple: "/icons/192" },
};

export const viewport: Viewport = { themeColor: "#111111" };

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await getSession();
  const role = session?.profile?.role;
  const canScore = role === "scorer" || isStaff(session);

  const items: NavItem[] = [
    { href: "/", label: "Inicio" },
    { href: "/equipos", label: "Equipos" },
  ];
  if (canScore) items.push({ href: "/mesa", label: "Mesa" });
  if (isStaff(session)) items.push({ href: "/admin", label: "Admin" });
  const user = session ? { name: session.profile?.display_name || session.email, role: ROLE_LABEL[role ?? "viewer"] } : null;

  return (
    <html lang="es-EC">
      <body className={`${inter.variable} ${display.variable} flex min-h-dvh flex-col font-sans antialiased`}>
        <PwaRegister />
        <SiteHeader items={items} user={user} signOut={signOut} />
        <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-12">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}

function SiteFooter() {
  const year = new Date().getFullYear();
  const link = "text-white/70 transition hover:text-paper";
  return (
    <footer className="no-print mt-16 bg-black text-paper">
      <div className="flex h-2" aria-hidden>
        <span className="flex-1 bg-orange" />
        <span className="flex-1 bg-sky" />
        <span className="flex-1 bg-sun" />
        <span className="flex-1 bg-rose" />
        <span className="flex-1 bg-volt" />
      </div>
      <div className="mx-auto grid max-w-[1440px] gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[2fr_1fr_1fr] lg:px-12">
        <div>
          <p className="display-l">
            Voleibol
            <br />
            que se vive
          </p>
          <p className="mt-4 max-w-sm text-sm text-white/70">
            Torneos de vóley y ecuavóley, posiciones y planilla electrónica con marcador en vivo para ligas, parroquias y
            asociaciones de Ecuador.
          </p>
        </div>
        <nav aria-label="Torneos" className="space-y-3 text-sm">
          <p className="eyebrow text-white/50">Seguir</p>
          <Link className={`block ${link}`} href="/">
            Torneos y resultados
          </Link>
          <Link className={`block ${link}`} href="/#en-vivo">
            Partidos en vivo
          </Link>
          <Link className={`block ${link}`} href="/equipos">
            Equipos y nóminas
          </Link>
        </nav>
        <nav aria-label="Equipo de mesa" className="space-y-3 text-sm">
          <p className="eyebrow text-white/50">Para clubes</p>
          <Link className={`block ${link}`} href="/mesa">
            Mesa de control
          </Link>
          <Link className={`block ${link}`} href="/admin">
            Administración
          </Link>
          <Link className={`block ${link}`} href="/ingresar">
            Ingresar
          </Link>
          <InstallButton className={`block ${link}`} />
        </nav>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-4 py-5 text-xs text-white/50 sm:px-6 lg:px-12">
          <span className="flex items-center gap-2">
            <BallIcon size={16} /> Voley EC · {year}
          </span>
          <span>Hora de Ecuador (GMT-5)</span>
        </div>
      </div>
    </footer>
  );
}
