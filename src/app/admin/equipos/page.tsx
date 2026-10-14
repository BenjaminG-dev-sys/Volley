import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { Card, CardHeader, Empty, Field, PageHeader, TeamCrest, cx, inputCls } from "@/components/ui";
import { listTeams } from "@/lib/data";
import { serverClient } from "@/lib/insforge/server";
import { ROSTER_LIMITS, SPORT_LABEL, resolveRules, type Sport } from "@/lib/scoresheet/rules";
import type { Organization } from "@/lib/types";
import { createTeam } from "../actions";

export const metadata: Metadata = { title: "Equipos" };
export const dynamic = "force-dynamic";

export default async function TeamsPage({ searchParams }: { searchParams: Promise<{ deporte?: string; q?: string }> }) {
  const { deporte, q } = await searchParams;
  const sport: Sport | null = deporte === "voley" || deporte === "ecuavoley" ? deporte : null;
  const db = (await serverClient()).database;
  const [teams, playersRes, orgsRes] = await Promise.all([
    listTeams(),
    db.from("players").select("team_id").limit(10000),
    db.from("organizations").select("*").order("name"),
  ]);
  const counts = new Map<string, number>();
  for (const p of (playersRes.data ?? []) as { team_id: string }[]) counts.set(p.team_id, (counts.get(p.team_id) ?? 0) + 1);
  const needle = (q ?? "").trim().toLowerCase();
  const list = teams.filter(
    (t) => (!sport || (t.sport ?? "voley") === sport) && (!needle || `${t.name} ${t.short_name} ${t.city ?? ""}`.toLowerCase().includes(needle)),
  );
  const chip = (id: string | null, label: string) => (
    <Link
      key={label}
      href={id ? `/admin/equipos?deporte=${id}` : "/admin/equipos"}
      className={cx("rounded-full border-[1.5px] px-3 py-1 text-sm font-semibold", (sport ?? null) === id ? "border-ink bg-ink text-bg" : "border-line")}
    >
      {label}
    </Link>
  );

  return (
    <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
      <div className="space-y-4">
        <PageHeader eyebrow={`${teams.length} equipos`} title="Equipos y nóminas" sub="Vóley: hasta 14 jugadores y 2 líberos. Ecuavóley: 3 titulares y 4 suplentes, sin líbero." />
        <div className="flex flex-wrap items-center gap-2">
          {chip(null, "Todos")}
          {chip("voley", SPORT_LABEL.voley)}
          {chip("ecuavoley", SPORT_LABEL.ecuavoley)}
          <form className="ml-auto">
            {sport && <input type="hidden" name="deporte" value={sport} />}
            <input name="q" defaultValue={q ?? ""} placeholder="Buscar equipo" className={cx(inputCls, "w-56")} />
          </form>
        </div>
        <Card className="divide-y divide-line">
          {list.map((t) => {
            const n = counts.get(t.id) ?? 0;
            const s = t.sport ?? "voley";
            const short = n < resolveRules(s).playersOnCourt;
            return (
              <Link key={t.id} href={`/admin/equipos/${t.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
                <TeamCrest name={t.name} color={t.color_primary} logo={t.logo_url} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{t.name}</div>
                  <div className="text-sm text-muted">
                    {SPORT_LABEL[s]} · {t.city ?? "—"}
                  </div>
                </div>
                <span className={cx("tabular text-sm", short ? "font-semibold text-live" : "text-muted")}>
                  {n}/{ROSTER_LIMITS[s].players}
                </span>
              </Link>
            );
          })}
          {!list.length && <Empty>No hay equipos con ese filtro.</Empty>}
        </Card>
      </div>
      <Card className="h-fit">
        <CardHeader title="Nuevo equipo" />
        <ActionForm action={createTeam} submit="Crear equipo" className="p-4">
          <Field label="Nombre">
            <input name="name" required className={inputCls} />
          </Field>
          <Field label="Deporte" hint="Solo podrá inscribirse en torneos de este deporte">
            <select name="sport" className={inputCls} defaultValue={sport ?? "voley"}>
              <option value="voley">{SPORT_LABEL.voley}</option>
              <option value="ecuavoley">{SPORT_LABEL.ecuavoley}</option>
            </select>
          </Field>
          <Field label="Nombre corto" hint="Se muestra en el marcador">
            <input name="short_name" required maxLength={14} className={inputCls} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Ciudad">
              <input name="city" className={inputCls} />
            </Field>
            <Field label="Provincia">
              <input name="province" className={inputCls} />
            </Field>
          </div>
          <Field label="Organización">
            <select name="organization_id" className={inputCls}>
              <option value="">Ninguna</option>
              {((orgsRes.data ?? []) as Organization[]).map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </Field>
          <div className="flex gap-4">
            <Field label="Color principal">
              <input name="color_primary" type="color" defaultValue="#1d4ed8" className="h-10 w-20 rounded border border-line" />
            </Field>
            <Field label="Color secundario">
              <input name="color_secondary" type="color" defaultValue="#ffffff" className="h-10 w-20 rounded border border-line" />
            </Field>
          </div>
        </ActionForm>
      </Card>
    </div>
  );
}
