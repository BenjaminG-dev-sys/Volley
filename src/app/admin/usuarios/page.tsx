import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card, PageHeader } from "@/components/ui";
import { getSession, serverClient } from "@/lib/insforge/server";
import { ROLE_LABEL, type Profile, type Role } from "@/lib/types";
import { setRole } from "../actions";

export const metadata: Metadata = { title: "Usuarios" };

export default async function UsersPage() {
  const session = await getSession();
  if (session?.profile?.role !== "admin") redirect("/admin");
  const db = (await serverClient()).database;
  const { data } = await db.from("profiles").select("user_id, display_name, email, role").order("created_at").limit(500);
  const users = (data ?? []) as Profile[];
  return (
    <div>
      <PageHeader title="Usuarios y roles" sub="Las personas se registran con su correo; aquí el administrador les asigna un rol." />
      <Card className="divide-y divide-line">
        {users.map((u) => (
          <div key={u.user_id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div>
              <div className="font-medium">{u.display_name || u.email}</div>
              <div className="text-sm text-muted">{u.email}</div>
            </div>
            <div className="flex flex-wrap gap-1">
              {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
                <form key={r} action={setRole.bind(null, u.user_id, r)}>
                  <button
                    disabled={u.user_id === session.userId}
                    className={`rounded-full px-3 py-1 text-xs ${u.role === r ? "bg-primary text-primary-contrast" : "border border-line hover:bg-surface-2"} disabled:opacity-50`}
                  >
                    {ROLE_LABEL[r]}
                  </button>
                </form>
              ))}
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}
