import type { Metadata } from "next";
import { LinkButton } from "@/components/ui";

export const metadata: Metadata = { title: "Sin conexión" };

/** Página de respaldo del service worker cuando no hay red ni copia guardada. */
export default function Offline() {
  return (
    <div className="mx-auto max-w-xl py-16 text-center">
      <p className="eyebrow text-muted">Sin conexión</p>
      <h1 className="display-l mt-3">Estás sin red</h1>
      <p className="mt-4 text-muted">
        Esta página aún no se guardó en el dispositivo. La mesa de control sigue funcionando: las planillas abiertas antes se
        guardan y cada punto se sincroniza al volver la conexión.
      </p>
      <div className="mt-8 flex justify-center gap-3">
        <LinkButton href="/mesa">Ir a la mesa</LinkButton>
        <LinkButton href="/" variant="secondary">
          Reintentar
        </LinkButton>
      </div>
    </div>
  );
}
