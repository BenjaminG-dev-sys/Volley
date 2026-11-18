"use server";

import { createClient } from "@insforge/sdk";
import { createAuthActions } from "@insforge/sdk/ssr";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { getSession, serverClient } from "@/lib/insforge/server";

export type PasswordState = { error: string | null; ok?: string | null; step: "send" | "code" | "done" };

const anon = () =>
  createClient({ baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL, anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY, isServerMode: true });

export async function sendPasswordCode(): Promise<PasswordState> {
  const s = await getSession();
  if (!s) return { error: "Tu sesión expiró. Vuelve a ingresar.", step: "send" };
  const { error } = await anon().auth.sendResetPasswordEmail({ email: s.email });
  if (error) return { error: "No se pudo enviar el código. Intenta de nuevo en un minuto.", step: "send" };
  return { error: null, ok: `Enviamos un código de 6 dígitos a ${s.email}.`, step: "code" };
}

export async function changePassword(_prev: PasswordState, f: FormData): Promise<PasswordState> {
  const s = await getSession();
  if (!s) return { error: "Tu sesión expiró. Vuelve a ingresar.", step: "send" };
  if (f.get("intent") !== "save") return sendPasswordCode();
  const code = String(f.get("code") ?? "").replace(/\D/g, "");
  const password = String(f.get("password") ?? "");
  const confirm = String(f.get("confirm") ?? "");
  if (code.length !== 6) return { error: "El código tiene 6 dígitos.", step: "code" };
  if (password.length < 8) return { error: "La contraseña debe tener al menos 8 caracteres.", step: "code" };
  if (password !== confirm) return { error: "Las contraseñas no coinciden.", step: "code" };

  const client = anon();
  const exchanged = await client.auth.exchangeResetPasswordToken({ email: s.email, code });
  if (exchanged.error || !exchanged.data?.token) return { error: "El código no es válido o ya expiró.", step: "code" };
  const reset = await client.auth.resetPassword({ newPassword: password, otp: exchanged.data.token });
  if (reset.error) return { error: "No se pudo guardar la contraseña. Intenta con otra.", step: "code" };

  const auth = createAuthActions({ cookies: await cookies() });
  await auth.signInWithPassword({ email: s.email, password });
  const { error } = await (await serverClient()).database
    .from("profiles")
    .update({ must_change_password: false })
    .eq("user_id", s.userId);
  if (error) return { error: "La contraseña se guardó, pero no se pudo actualizar tu cuenta. Recarga la página.", step: "code" };
  revalidatePath("/", "layout");
  return { error: null, ok: "Contraseña guardada.", step: "done" };
}
