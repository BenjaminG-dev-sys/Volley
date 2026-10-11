import "server-only";

import { createServerClient } from "@insforge/sdk/ssr";
import { cookies } from "next/headers";
import { cache } from "react";
import type { Profile } from "@/lib/types";

export async function serverClient() {
  return createServerClient({ cookies: await cookies() });
}

export interface Session {
  userId: string;
  email: string;
  profile: Profile | null;
}

/** Usuario y perfil de la petición actual (o null si es público). */
export const getSession = cache(async (): Promise<Session | null> => {
  const jar = await cookies();
  if (!jar.get("insforge_access_token")) return null;
  const client = createServerClient({ cookies: jar });
  const { data } = await client.auth.getCurrentUser();
  const user = data?.user;
  if (!user) return null;
  const { data: profile } = await client.database
    .from("profiles")
    .select("user_id, display_name, email, role")
    .eq("user_id", user.id)
    .maybeSingle();
  return { userId: user.id, email: user.email, profile: (profile as Profile) ?? null };
});

export const isStaff = (s: Session | null) => s?.profile?.role === "admin" || s?.profile?.role === "organizer";
