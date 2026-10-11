import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession, isStaff } from "@/lib/insforge/server";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/ingresar?next=/admin");
  if (!isStaff(session)) redirect("/");
  const link = "rounded-lg px-3 py-1.5 text-sm hover:bg-surface-2";
  return (
    <div className="space-y-6">
      <nav className="flex flex-wrap gap-1 border-b border-line pb-3">
        <Link className={link} href="/admin">Torneos</Link>
        <Link className={link} href="/admin/equipos">Equipos y nóminas</Link>
        {session.profile?.role === "admin" && <Link className={link} href="/admin/usuarios">Usuarios y roles</Link>}
      </nav>
      {children}
    </div>
  );
}
