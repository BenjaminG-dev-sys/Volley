"use client";

import { useEffect, useState } from "react";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();

/** Registra el service worker (solo en producción) y guarda el aviso de instalación. */
export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
    const onPrompt = (e: Event) => {
      e.preventDefault();
      deferred = e as InstallPromptEvent;
      listeners.forEach((l) => l());
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);
  return null;
}

/** Botón "Instalar app": solo aparece si el navegador ofrece instalar. */
export function InstallButton({ className }: { className?: string }) {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    const update = () => setAvailable(Boolean(deferred));
    update();
    listeners.add(update);
    return () => {
      listeners.delete(update);
    };
  }, []);
  if (!available) return null;
  return (
    <button
      className={className}
      onClick={async () => {
        await deferred?.prompt();
        deferred = null;
        setAvailable(false);
      }}
    >
      Instalar app
    </button>
  );
}

/** Pide al service worker borrar las páginas guardadas (al cerrar sesión). */
export function clearCachedPages() {
  navigator.serviceWorker?.controller?.postMessage("clear-pages");
}
