import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Inter } from "next/font/google";
import Link from "next/link";
import { BrandBand, BrandSeal } from "@/components/brand";
import { InstallButton, InstallPrompt, PwaRegister } from "@/components/pwa";
import { SiteHeader, type NavItem } from "@/components/site-header";
import { BRAND } from "@/lib/brand";
import { getSession, isStaff } from "@/lib/insforge/server";
import { ROLE_LABEL } from "@/lib/types";
import { signOut } from "./ingresar/actions";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const display = Barlow_Condensed({ variable: "--font-display-face", subsets: ["latin"], weight: ["600", "700", "800"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://voley.integroecuador.com"),
  title: { default: `${BRAND.short} · Campeonatos interparroquiales`, template: `%s · ${BRAND.short}` },
  description: BRAND.description,
  applicationName: BRAND.short,
  appleWebApp: { capable: true, title: BRAND.short, statusBarStyle: "black-translucent" },
  openGraph: { type: "website", locale: "es_EC", siteName: BRAND.name, title: BRAND.name, description: BRAND.description },
  twitter: { card: "summary_large_image", title: BRAND.name, description: BRAND.description },
};

export const viewport: Viewport = { themeColor: BRAND.colors.navy };

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await getSession();
  const role = session?.profile?.role;
  const canScore = role === "scorer" || isStaff(session);

  const items: NavItem[] = [
    { href: "/", label: "Inicio" },
    { href: "/equipos", label: "Ligas" },
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
        <InstallPrompt />
      </body>
    </html>
  );
}

function SiteFooter() {
  const year = new Date().getFullYear();
  const link = "text-white/70 transition hover:text-paper";
  return (
    <footer className="no-print mt-16 bg-black text-paper">
      <BrandBand />
      <div className="mx-auto grid max-w-[1440px] gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[2fr_1fr_1fr] lg:px-12">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
          <BrandSeal size={128} className="shadow-lg ring-4 ring-white/10" />
          <div>
            <p className="display-m">
              Ligas Rurales
              <br />
              <span className="text-volt">del Cantón Quito</span>
            </p>
            <p className="mt-4 max-w-sm text-sm text-white/70">
              Campeonatos interparroquiales de vóley y ecuavóley: calendario, posiciones, nóminas y planilla electrónica con
              marcador en vivo para cada liga parroquial afiliada.
            </p>
          </div>
        </div>
        <nav aria-label="Campeonatos" className="space-y-3 text-sm">
          <p className="eyebrow text-white/50">Seguir</p>
          <Link className={`block ${link}`} href="/#torneos">
            Campeonatos y resultados
          </Link>
          <Link className={`block ${link}`} href="/#en-vivo">
            Partidos en vivo
          </Link>
          <Link className={`block ${link}`} href="/equipos">
            Ligas parroquiales y nóminas
          </Link>
        </nav>
        <nav aria-label="Directiva y mesa" className="space-y-3 text-sm">
          <p className="eyebrow text-white/50">Directiva y ligas</p>
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
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-5 text-xs text-white/50 sm:px-6 lg:px-12">
          <span>
            © {year} {BRAND.name}
          </span>
          <span>
            Hora de Ecuador (GMT-5) · Plataforma por{" "}
            <a className="underline-offset-2 hover:text-paper hover:underline" href={BRAND.builtBy.url} target="_blank" rel="noreferrer">
              {BRAND.builtBy.name}
            </a>
          </span>
        </div>
      </div>
    </footer>
  );
}
