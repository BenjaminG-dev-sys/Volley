"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { BallIcon, CloseIcon, MenuIcon } from "@/components/icons";
import { clearCachedPages } from "@/components/pwa";
import { LinkButton, cx } from "@/components/ui";

export interface NavItem {
  href: string;
  label: string;
}

const isActive = (path: string, href: string) => (href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`));

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2" aria-label="Voley EC, inicio">
      <BallIcon size={26} strokeWidth={2} />
      <span className="font-display text-2xl font-extrabold uppercase leading-none tracking-tight">Voley EC</span>
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
      <div className="mx-auto flex h-[60px] max-w-[1440px] items-center gap-6 px-4 sm:px-6 lg:px-12">
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
          <div className="flex h-[60px] items-center justify-between px-4">
            <span className="font-display text-2xl font-extrabold uppercase">Voley EC</span>
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
          <div className="flex h-2" aria-hidden>
            <span className="flex-1 bg-orange" />
            <span className="flex-1 bg-sky" />
            <span className="flex-1 bg-sun" />
            <span className="flex-1 bg-rose" />
            <span className="flex-1 bg-volt" />
          </div>
        </div>,
          document.body,
        )}
    </header>
  );
}
