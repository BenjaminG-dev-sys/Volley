"use server";

import { createAuthActions } from "@insforge/sdk/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { safeNext } from "@/lib/redirect";

export async function signIn(_prev: { error: string | null }, formData: FormData) {
  const auth = createAuthActions({ cookies: await cookies() });
  const { error } = await auth.signInWithPassword({
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
  });
  if (error) {
    const msg = /verif/i.test(error.message) ? "La cuenta aún no verifica su correo." : "Correo o contraseña incorrectos.";
    return { error: msg };
  }
  redirect(safeNext(String(formData.get("next") ?? "")));
}

export async function signOut() {
  const auth = createAuthActions({ cookies: await cookies() });
  await auth.signOut();
  redirect("/");
}
