"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { changePassword, type PasswordState } from "@/app/cuenta/actions";
import { BrandBand } from "@/components/brand";
import { Button, Field, inputCls } from "@/components/ui";

export function PasswordGate({ email, signOut }: { email: string; signOut: () => Promise<void> }) {
  const router = useRouter();
  const [state, run, pending] = useActionState<PasswordState, FormData>(changePassword, { error: null, step: "send" });

  useEffect(() => {
    if (state.step === "done") router.refresh();
  }, [state.step, router]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="pw-title" className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4">
      <div className="w-full max-w-md overflow-hidden rounded-t-2xl bg-bg shadow-2xl sm:rounded-2xl">
        <BrandBand height={4} />
        <div className="space-y-4 p-6">
          <div>
            <h2 id="pw-title" className="font-display text-2xl font-bold uppercase">
              Crea tu contraseña
            </h2>
            <p className="mt-1 text-sm text-muted">
              Ingresaste con una contraseña temporal. Por seguridad, crea una propia para continuar. Te enviaremos un código a{" "}
              <strong className="text-ink">{email}</strong>.
            </p>
          </div>

          {state.step === "done" ? (
            <p className="rounded-lg bg-ok/10 px-3 py-2 text-sm text-ok">Listo, tu contraseña quedó guardada.</p>
          ) : (
            <form action={run} className="space-y-3">
              {state.step === "code" && (
                <>
                  <Field label="Código de 6 dígitos">
                    <input name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required className={`${inputCls} tracking-[0.4em]`} />
                  </Field>
                  <Field label="Nueva contraseña" hint="Mínimo 8 caracteres.">
                    <input name="password" type="password" minLength={8} required autoComplete="new-password" className={inputCls} />
                  </Field>
                  <Field label="Repite la contraseña">
                    <input name="confirm" type="password" minLength={8} required autoComplete="new-password" className={inputCls} />
                  </Field>
                </>
              )}
              {state.ok && state.step === "code" && <p className="rounded-lg bg-ok/10 px-3 py-2 text-sm text-ok">{state.ok} Revisa también spam.</p>}
              {state.error && (
                <p role="alert" className="rounded-lg bg-live/10 px-3 py-2 text-sm text-live">
                  {state.error}
                </p>
              )}
              {state.step === "send" ? (
                <Button name="intent" value="send" className="w-full" disabled={pending}>
                  {pending ? "Enviando…" : "Enviarme el código"}
                </Button>
              ) : (
                <div className="flex flex-col gap-2">
                  <Button name="intent" value="save" className="w-full" disabled={pending}>
                    {pending ? "Guardando…" : "Guardar contraseña"}
                  </Button>
                  <Button name="intent" value="resend" variant="ghost" formNoValidate className="w-full" disabled={pending}>
                    Reenviar código
                  </Button>
                </div>
              )}
            </form>
          )}
          <form action={signOut} className="text-center">
            <button className="text-xs text-muted underline">Cerrar sesión</button>
          </form>
        </div>
      </div>
    </div>
  );
}
