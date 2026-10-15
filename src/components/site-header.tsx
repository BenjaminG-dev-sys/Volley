"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { CloseIcon, MenuIcon } from "@/components/icons";
import { clearCachedPages } from "@/components/pwa";
import { BrandBand } from "@/components/brand";
import { LinkButton, cx } from "@/components/ui";
import { BRAND } from "@/lib/brand";

export interface NavItem {
  href: string;
  label: string;
}

const isActive = (path: string, href: string) => (href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`));

export function Emblem({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <span
      className={cx("inline-grid shrink-0 place-items-center rounded-full bg-paper ring-1 ring-black/10", className)}
      style={{ width: size, height: size }}
    >
      <Image src={BRAND.emblem} alt="" width={Math.round(size * 0.86)} height={Math.round(size * 0.86)} priority />
    </span>
  );
}

function Wordmark({ inverse }: { inverse?: boolean }) {
  return (
    <span className="flex flex-col font-display uppercase leading-[0.9]">
      <span className={cx("text-[1.35rem] font-extrabold tracking-tight", inverse ? "text-paper" : "text-ink")}>{BRAND.wordmark.top}</span>
      <span className={cx("text-[0.8rem] font-bold tracking-[0.18em]", inverse ? "text-volt" : "text-rose")}>{BRAND.wordmark.bottom}</span>
    </span>
  );
}

export function Logo({ inverse }: { inverse?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2.5" aria-label={`${BRAND.name}, inicio`}>
      <Emblem size={42} />
      <Wordmark inverse={inverse} />
    </Link>
  );
}

export interface HeaderUser {
  name: string;
  role: string;
}

function Account({ user, signOut, inverse }: { user: HeaderUser | null; signOut: () => Promise<void>; inverse?: boolean }) {
  if (!user)
    return (
      <LinkButton href="/ingresar" variant={inverse ? "inverse" : "primary"}>
        Ingresar
      </LinkButton>
    );
  return (
    <form action={signOut} onSubmit={clearCachedPages} className="flex items-center gap-3 text-sm">
      <span className={cx("leading-tight", inverse ? "text-white/70" : "text-muted")}>
        <span className={cx("block font-medium", inverse ? "text-paper" : "text-ink")}>{user.name}</span>
        {user.role}
      </span>
      <button className={cx("rounded-full border-[1.5px] px-4 py-1.5 font-medium", inverse ? "border-white/40 hover:border-paper" : "border-line hover:border-ink")}>
        Salir
      </button>
    </form>
  );
}

/** Encabezado del sitio: navegación con indicador activo y menú móvil a pantalla completa. */
export function SiteHeader({ items, user, signOut }: { items: NavItem[]; user: HeaderUser | null; signOut: () => Promise<void> }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header className="no-print sticky top-0 z-40 border-b border-line bg-bg/95 backdrop-blur">
      <BrandBand height={4} />
      <div className="mx-auto flex h-[64px] max-w-[1440px] items-center gap-6 px-4 sm:px-6 lg:px-12">
        <Logo />
        <nav className="ml-auto hidden items-center gap-6 text-[15px] font-medium md:flex" aria-label="Principal">
          {items.map((it) => (
            <Link key={it.href} href={it.href} className="underline-anim py-1" aria-current={isActive(path, it.href) ? "page" : undefined}>
              {it.label}
            </Link>
          ))}
        </nav>
        <div className="hidden md:block">
          <Account user={user} signOut={signOut} />
        </div>
        <button
          className="ml-auto grid h-10 w-10 place-items-center rounded-full hover:bg-surface-2 md:hidden"
          onClick={() => setOpen(true)}
          aria-label="Abrir menú"
          aria-expanded={open}
        >
          <MenuIcon size={24} />
        </button>
      </div>

      {/* Portal: el `backdrop-blur` del header haría que `fixed` se posicione dentro del header. */}
      {open &&
        createPortal(
        <div className="fixed inset-0 z-50 flex flex-col bg-black text-paper md:hidden" role="dialog" aria-modal="true" aria-label="Menú">
          <div className="flex h-[68px] items-center justify-between px-4">
            <Logo inverse />
            <button className="grid h-10 w-10 place-items-center rounded-full hover:bg-white/10" onClick={() => setOpen(false)} aria-label="Cerrar menú">
              <CloseIcon size={24} />
            </button>
          </div>
          <nav className="flex flex-1 flex-col gap-2 px-4 pt-8" aria-label="Principal">
            {items.map((it) => (
              <Link
                key={it.href}
                href={it.href}
                className={cx("display-l", isActive(path, it.href) ? "text-volt" : "text-paper")}
                aria-current={isActive(path, it.href) ? "page" : undefined}
              >
                {it.label}
              </Link>
            ))}
          </nav>
          <div className="border-t border-white/15 p-4">
            <Account user={user} signOut={signOut} inverse />
          </div>
          <BrandBand />
        </div>,
          document.body,
        )}
    </header>
  );
}
