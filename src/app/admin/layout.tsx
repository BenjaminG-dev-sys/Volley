import { redirect } from "next/navigation";
import { getSession, isStaff } from "@/lib/insforge/server";
import { AdminNav, AdminSearch, type AdminLink } from "./admin-nav";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/ingresar?next=/admin");
  if (!isStaff(session)) redirect("/");
  const links: AdminLink[] = [
    { href: "/admin", label: "Panel" },
    { href: "/admin/torneos", label: "Torneos" },
    { href: "/admin/partidos", label: "Calendario" },
    { href: "/admin/equipos", label: "Equipos y nóminas" },
    { href: "/admin/arbitros", label: "Árbitros" },
    { href: "/admin/sedes", label: "Sedes" },
    { href: "/admin/organizaciones", label: "Organizaciones" },
    ...(session.profile?.role === "admin" ? [{ href: "/admin/usuarios", label: "Usuarios y roles" }] : []),
    { href: "/admin/auditoria", label: "Auditoría" },
  ];
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
        <p className="eyebrow text-muted">Administración</p>
        <AdminSearch />
      </div>
      <div className="grid gap-6 lg:grid-cols-[13rem_1fr] lg:gap-10">
        <aside>
          <AdminNav links={links} />
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
