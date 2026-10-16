"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { cx } from "@/components/ui";
import { type SearchResult, searchAdmin } from "./actions";

export interface AdminLink {
  href: string;
  label: string;
}

const active = (path: string, href: string) => (href === "/admin" ? path === "/admin" : path === href || path.startsWith(`${href}/`));

/** Navegación del panel: barra lateral en escritorio y selector en móvil. */
export function AdminNav({ links }: { links: AdminLink[] }) {
  const path = usePathname();
  const router = useRouter();
  const current = links.find((l) => active(path, l.href))?.href ?? "/admin";
  return (
    <>
      <select
        aria-label="Sección del panel"
        className="w-full rounded-full border-[1.5px] border-line bg-surface px-4 py-2.5 text-sm font-semibold lg:hidden"
        value={current}
        onChange={(e) => router.push(e.target.value)}
      >
        {links.map((l) => (
          <option key={l.href} value={l.href}>
            {l.label}
          </option>
        ))}
      </select>
      <nav aria-label="Panel" className="sticky top-[76px] hidden flex-col gap-0.5 lg:flex">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active(path, l.href) ? "page" : undefined}
            className={cx(
              "rounded-lg px-3 py-2 text-sm font-medium transition",
              active(path, l.href) ? "bg-ink text-bg" : "text-muted hover:bg-surface-2 hover:text-ink",
            )}
          >
            {l.label}
          </Link>
        ))}
      </nav>
    </>
  );
}

/** Buscador global del panel (⌘K / Ctrl+K): torneos, equipos, jugadores (también por cédula), árbitros y sedes. */
export function AdminSearch() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [sel, setSel] = useState(0);
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      } else if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => {
    if (open) setTimeout(() => input.current?.focus(), 0);
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => start(async () => setResults(await searchAdmin(q).catch(() => []))), 200);
    return () => clearTimeout(t);
  }, [q, open]);

  const go = (r: SearchResult) => {
    setOpen(false);
    setQ("");
    router.push(r.href);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-between gap-3 whitespace-nowrap rounded-full border-[1.5px] border-line px-4 py-2 text-left text-sm text-muted hover:border-ink sm:w-80"
      >
        Buscar equipo, jugador, cédula…
        <kbd className="rounded border border-line px-1.5 text-[11px]">⌘K</kbd>
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-[12vh]" onClick={() => setOpen(false)}>
          <div role="dialog" aria-label="Buscar" className="w-full max-w-xl overflow-hidden rounded-2xl bg-surface shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <input
              ref={input}
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setSel(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") setSel((s) => Math.min(s + 1, results.length - 1));
                else if (e.key === "ArrowUp") setSel((s) => Math.max(s - 1, 0));
                else if (e.key === "Enter" && results[sel]) go(results[sel]);
              }}
              placeholder="Escribe al menos 2 letras o una cédula…"
              className="w-full border-b border-line bg-transparent px-5 py-4 text-base outline-none"
            />
            <ul className="max-h-[50vh] overflow-y-auto py-2">
              {results.map((r, i) => (
                <li key={r.href + i}>
                  <button
                    onClick={() => go(r)}
                    onMouseEnter={() => setSel(i)}
                    className={cx("flex w-full items-center gap-3 px-5 py-2.5 text-left text-sm", i === sel && "bg-surface-2")}
                  >
                    <span className="eyebrow w-16 shrink-0 text-[10px] text-muted">{r.kind}</span>
                    <span className="min-w-0 flex-1 truncate font-medium">{r.label}</span>
                    <span className="truncate text-xs text-muted">{r.sub}</span>
                  </button>
                </li>
              ))}
              {q.trim().length >= 2 && !pending && !results.length && <li className="px-5 py-6 text-center text-sm text-muted">Sin resultados.</li>}
              {pending && <li className="px-5 py-3 text-sm text-muted">Buscando…</li>}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
