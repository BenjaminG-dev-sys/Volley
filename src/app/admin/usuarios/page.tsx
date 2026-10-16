import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { Button, Card, CardHeader, Empty, Field, PageHeader, cx, inputCls } from "@/components/ui";
import { getSession, serverClient } from "@/lib/insforge/server";
import { ROLE_LABEL, type Profile, type Role, type RoleInvite } from "@/lib/types";
import { inviteUser, revokeInvite, setRole } from "../actions";

export const metadata: Metadata = { title: "Usuarios" };
export const dynamic = "force-dynamic";

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ rol?: string }> }) {
  const session = await getSession();
  if (session?.profile?.role !== "admin") redirect("/admin");
  const { rol } = await searchParams;
  const filter = rol && rol in ROLE_LABEL ? (rol as Role) : null;
  const db = (await serverClient()).database;
  const [{ data }, { data: invitesData }] = await Promise.all([
    db.from("profiles").select("user_id, display_name, email, role").order("created_at").limit(1000),
    db.from("role_invites").select("*").order("created_at", { ascending: false }),
  ]);
  const all = (data ?? []) as Profile[];
  const users = all.filter((u) => !filter || u.role === filter);
  const invites = (invitesData ?? []) as RoleInvite[];

  return (
    <div className="grid gap-6 xl:grid-cols-[3fr_2fr]">
      <div className="space-y-4">
        <PageHeader eyebrow={`${all.length} cuentas`} title="Usuarios y roles" sub="«Público» quita el acceso al panel y a la mesa sin borrar la cuenta." />
        <div className="flex flex-wrap gap-2">
          {[null, ...(Object.keys(ROLE_LABEL) as Role[])].map((r) => (
            <Link
              key={r ?? "todos"}
              href={r ? `/admin/usuarios?rol=${r}` : "/admin/usuarios"}
              className={cx("rounded-full border-[1.5px] px-3 py-1 text-sm font-semibold", filter === r ? "border-ink bg-ink text-bg" : "border-line")}
            >
              {r ? `${ROLE_LABEL[r]} (${all.filter((u) => u.role === r).length})` : "Todos"}
            </Link>
          ))}
        </div>
        <Card className="divide-y divide-line">
          {users.map((u) => (
            <div key={u.user_id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <div className="truncate font-medium">{u.display_name || u.email}</div>
                <div className="truncate text-sm text-muted">{u.email}</div>
              </div>
              <div className="flex flex-wrap gap-1">
                {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
                  <form key={r} action={setRole.bind(null, u.user_id, r)}>
                    <button
                      disabled={u.user_id === session.userId}
                      className={cx(
                        "rounded-full px-3 py-1 text-xs font-medium disabled:opacity-50",
                        u.role === r ? "bg-ink text-bg" : "border border-line hover:border-ink",
                      )}
                    >
                      {ROLE_LABEL[r]}
                    </button>
                  </form>
                ))}
              </div>
            </div>
          ))}
          {!users.length && <Empty>No hay cuentas con ese rol.</Empty>}
        </Card>
      </div>
      <div className="space-y-6">
        <Card>
          <CardHeader title="Invitar por correo" sub="Si la cuenta ya existe se le asigna el rol; si no, lo recibe al registrarse con ese correo." />
          <ActionForm action={inviteUser} submit="Invitar" className="p-4">
            <Field label="Correo">
              <input name="email" type="email" required className={inputCls} />
            </Field>
            <Field label="Rol">
              <select name="role" defaultValue="scorer" className={inputCls}>
                {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </select>
            </Field>
          </ActionForm>
        </Card>
        <Card className="divide-y divide-line">
          <CardHeader title="Invitaciones pendientes" />
          {invites.map((i) => (
            <div key={i.email} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <span className="truncate">
                {i.email} · <strong>{ROLE_LABEL[i.role]}</strong>
              </span>
              <form action={revokeInvite.bind(null, i.email)}>
                <Button variant="ghost">Cancelar</Button>
              </form>
            </div>
          ))}
          {!invites.length && <Empty>Sin invitaciones pendientes.</Empty>}
        </Card>
      </div>
    </div>
  );
}
