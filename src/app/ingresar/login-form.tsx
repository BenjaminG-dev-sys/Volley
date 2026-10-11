"use client";

import { useActionState } from "react";
import { Button, Field, inputCls } from "@/components/ui";
import { signIn } from "./actions";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(signIn, { error: null as string | null });
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <Field label="Correo">
        <input name="email" type="email" required autoComplete="email" className={inputCls} />
      </Field>
      <Field label="Contraseña">
        <input name="password" type="password" required autoComplete="current-password" className={inputCls} />
      </Field>
      {state.error && <p className="rounded-lg bg-live/10 px-3 py-2 text-sm text-live">{state.error}</p>}
      <Button className="w-full" disabled={pending}>
        {pending ? "Ingresando…" : "Ingresar"}
      </Button>
    </form>
  );
}
