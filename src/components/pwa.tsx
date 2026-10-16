"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BrandBand } from "@/components/brand";
import { AddSquareIcon, CloseIcon, DotsIcon, DownloadIcon, ShareIcon } from "@/components/icons";
import { BRAND } from "@/lib/brand";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: InstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    installed = true;
    notify();
  });
}

async function promptInstall() {
  const event = deferred;
  if (!event) return false;
  await event.prompt();
  const { outcome } = await event.userChoice;
  deferred = null;
  notify();
  return outcome === "accepted";
}

function useInstallState() {
  const [state, setState] = useState({ canPrompt: false, installed: false });
  useEffect(() => {
    const update = () => setState({ canPrompt: Boolean(deferred), installed });
    update();
    listeners.add(update);
    return () => {
      listeners.delete(update);
    };
  }, []);
  return state;
}

/** Registra el service worker (solo en producción) y guarda el aviso de instalación. */
export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}

/** Botón "Instalar app": solo aparece si el navegador ofrece instalar. */
export function InstallButton({ className }: { className?: string }) {
  const { canPrompt } = useInstallState();
  if (!canPrompt) return null;
  return (
    <button className={className} onClick={() => promptInstall()}>
      Instalar app
    </button>
  );
}

/** Pide al service worker borrar las páginas guardadas (al cerrar sesión). */
export function clearCachedPages() {
  navigator.serviceWorker?.controller?.postMessage("clear-pages");
}

type Platform = "android" | "ios" | "in-app";

const DISMISS_KEY = "voley-install-dismissed";
const DISMISS_DAYS = 7;
const SHOW_DELAY_MS = 2500;
const FALLBACK_DELAY_MS = 6000;

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isPhone() {
  const ua = navigator.userAgent;
  const mobileUa = /Android|iPhone|iPod|Mobile/i.test(ua);
  const narrowTouch = window.matchMedia("(max-width: 820px) and (pointer: coarse)").matches;
  return mobileUa || narrowTouch;
}

function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  if (/FBAN|FBAV|FB_IAB|Instagram|TikTok|Line\/|Snapchat|musical_ly/i.test(ua)) return "in-app";
  const iOS = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  return iOS ? "ios" : "android";
}

function recentlyDismissed() {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY));
    return Boolean(at) && Date.now() - at < DISMISS_DAYS * 86_400_000;
  } catch {
    return false;
  }
}

function rememberDismiss() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {}
}

export function InstallPrompt() {
  const pathname = usePathname();
  const { canPrompt, installed: justInstalled } = useInstallState();
  const [eligible, setEligible] = useState(false);
  const [platform, setPlatform] = useState<Platform>("android");
  const [ready, setReady] = useState(false);
  const [fallback, setFallback] = useState(false);
  const [open, setOpen] = useState(true);
  const [copied, setCopied] = useState(false);

  const onScorerConsole = /^\/mesa\/[^/]+/.test(pathname ?? "");

  useEffect(() => {
    if (isStandalone() || !isPhone() || recentlyDismissed()) return;
    setPlatform(detectPlatform());
    setEligible(true);
    const show = window.setTimeout(() => setReady(true), SHOW_DELAY_MS);
    const late = window.setTimeout(() => setFallback(true), FALLBACK_DELAY_MS);
    return () => {
      window.clearTimeout(show);
      window.clearTimeout(late);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const close = () => {
    rememberDismiss();
    setOpen(false);
  };

  const install = async () => {
    const accepted = await promptInstall();
    if (accepted) setOpen(false);
    else close();
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
    } catch {}
  };

  const mode: "button" | "ios" | "android-manual" | "in-app" | null =
    platform === "in-app"
      ? "in-app"
      : platform === "ios"
        ? "ios"
        : canPrompt
          ? "button"
          : fallback
            ? "android-manual"
            : null;

  if (!eligible || !ready || !open || justInstalled || onScorerConsole || !mode) return null;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="install-title"
      className="no-print fixed inset-x-0 bottom-0 z-50 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] reveal"
    >
      <div className="mx-auto max-w-md overflow-hidden rounded-3xl bg-black text-paper shadow-2xl ring-1 ring-white/10">
        <BrandBand height={6} />

        <div className="p-5">
          <div className="flex items-start gap-4">
            <Image src="/brand/icon-192.png" alt="" width={56} height={56} className="size-14 shrink-0 rounded-2xl" />
            <div className="min-w-0 flex-1">
              <p id="install-title" className="font-display text-2xl font-extrabold uppercase leading-none">
                Instala {BRAND.short}
              </p>
              <p className="mt-1.5 text-sm text-white/70">
                Marcador en vivo y mesa de control sin conexión, directo desde tu pantalla de inicio.
              </p>
            </div>
            <button
              type="button"
              onClick={close}
              aria-label="Cerrar"
              className="-mr-1 -mt-1 rounded-full p-2 text-white/60 transition hover:bg-white/10 hover:text-paper"
            >
              <CloseIcon size={18} />
            </button>
          </div>

          {mode === "button" && (
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={install}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-sun px-5 py-3.5 text-base font-semibold text-black transition hover:opacity-85"
              >
                <DownloadIcon size={20} /> Descargar app
              </button>
              <button
                type="button"
                onClick={close}
                className="rounded-full px-4 py-3.5 text-sm font-medium text-white/70 transition hover:bg-white/10 hover:text-paper"
              >
                Ahora no
              </button>
            </div>
          )}

          {mode === "ios" && (
            <Steps
              steps={[
                {
                  icon: <ShareIcon size={20} />,
                  text: (
                    <>
                      Toca <strong>Compartir</strong> en la barra del navegador
                    </>
                  ),
                },
                {
                  icon: <AddSquareIcon size={20} />,
                  text: (
                    <>
                      Elige <strong>Agregar a inicio</strong>
                    </>
                  ),
                },
                {
                  icon: <DownloadIcon size={20} />,
                  text: (
                    <>
                      Confirma con <strong>Agregar</strong>
                    </>
                  ),
                },
              ]}
            />
          )}

          {mode === "android-manual" && (
            <Steps
              steps={[
                {
                  icon: <DotsIcon size={20} />,
                  text: (
                    <>
                      Abre el <strong>menú</strong> del navegador
                    </>
                  ),
                },
                {
                  icon: <AddSquareIcon size={20} />,
                  text: (
                    <>
                      Toca <strong>Instalar app</strong> o <strong>Agregar a pantalla de inicio</strong>
                    </>
                  ),
                },
              ]}
            />
          )}

          {mode === "in-app" && (
            <div className="mt-5 space-y-3">
              <p className="text-sm text-white/80">
                Desde esta app no se puede instalar. Abre el enlace en <strong>Chrome</strong> o <strong>Safari</strong> y
                verás el botón para descargarla.
              </p>
              <button
                type="button"
                onClick={copyLink}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-sun px-5 py-3.5 text-base font-semibold text-black transition hover:opacity-85"
              >
                {copied ? "Enlace copiado" : "Copiar enlace"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Steps({ steps }: { steps: { icon: React.ReactNode; text: React.ReactNode }[] }) {
  return (
    <ol className="mt-5 space-y-2.5">
      {steps.map((s, i) => (
        <li key={i} className="flex items-center gap-3 rounded-2xl bg-white/[0.06] px-3.5 py-3 text-sm">
          <span className="font-display text-lg font-extrabold text-volt tabular">{i + 1}</span>
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/10">{s.icon}</span>
          <span className="text-white/85">{s.text}</span>
        </li>
      ))}
    </ol>
  );
}
