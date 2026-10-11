"use client";

import { useActionState, type ReactNode } from "react";
import type { ActionState } from "@/app/admin/actions";
import { Button, cx } from "@/components/ui";

/** Formulario con server action y mensaje de resultado. */
export function ActionForm({
  action,
  children,
  submit,
  className,
  inline,
}: {
  action: (s: ActionState, f: FormData) => Promise<ActionState>;
  children: ReactNode;
  submit: string;
  className?: string;
  inline?: boolean;
}) {
  const [state, run, pending] = useActionState(action, { error: null, ok: null });
  return (
    <form action={run} className={cx(inline ? "flex flex-wrap items-end gap-2" : "space-y-3", className)}>
      {children}
      <div className="flex items-center gap-3">
        <Button disabled={pending}>{pending ? "Guardando…" : submit}</Button>
        {state.error && <span className="text-sm text-live">{state.error}</span>}
        {state.ok && <span className="text-sm text-ok">{state.ok}</span>}
      </div>
    </form>
  );
}
