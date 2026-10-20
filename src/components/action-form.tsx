"use client";

import { useActionState, type ReactNode } from "react";
import type { ActionState } from "@/app/admin/actions";
import { Button, cx } from "@/components/ui";

/** Formulario con server action, confirmación opcional y mensaje de resultado (con detalles por fila). */
export function ActionForm({
  action,
  children,
  submit,
  className,
  inline,
  confirm: confirmText,
  variant = "primary",
}: {
  action: (s: ActionState, f: FormData) => Promise<ActionState>;
  children?: ReactNode;
  submit: string;
  className?: string;
  inline?: boolean;
  /** Pregunta antes de enviar (acciones destructivas). */
  confirm?: string;
  variant?: "primary" | "secondary" | "danger" | "ghost";
}) {
  const [state, run, pending] = useActionState(action, { error: null, ok: null });
  return (
    <form
      action={run}
      onSubmit={(e) => {
        if (confirmText && !window.confirm(confirmText)) e.preventDefault();
      }}
      className={cx(inline ? "flex flex-wrap items-end gap-2" : "space-y-3", className)}
    >
      {children}
      <div className="flex flex-wrap items-center gap-3">
        <Button variant={variant} disabled={pending}>
          {pending ? "Guardando…" : submit}
        </Button>
        {state.error && (
          <span role="alert" className="text-sm text-live">
            {state.error}
          </span>
        )}
        {state.ok && <span className="text-sm text-ok">{state.ok}</span>}
      </div>
      {state.details && state.details.length > 0 && (
        <ul className="max-h-48 list-disc space-y-0.5 overflow-y-auto pl-5 text-xs text-muted">
          {state.details.map((d, i) => (
            <li key={i}>{d}</li>
          ))}
        </ul>
      )}
    </form>
  );
}
