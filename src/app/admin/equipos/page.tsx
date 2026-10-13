import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { Card, CardHeader, Field, PageHeader, TeamDot, inputCls } from "@/components/ui";
import { listTeams } from "@/lib/data";
import { SPORT_LABEL } from "@/lib/scoresheet/rules";
import { createTeam } from "../actions";

export const metadata: Metadata = { title: "Equipos" };

export default async function TeamsPage() {
  const teams = await listTeams();
  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <div>
        <PageHeader title="Equipos y nóminas" sub="Vóley: hasta 14 jugadores y 2 líberos (FIVB). Ecuavóley: 3 titulares y 4 suplentes, sin líbero." />
        <Card className="divide-y divide-line">
          {teams.map((t) => (
            <Link key={t.id} href={`/admin/equipos/${t.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
              <TeamDot color={t.color_primary} />
              <div>
                <div className="font-medium">
                  {t.name} <span className="eyebrow ml-1 text-muted">{SPORT_LABEL[t.sport ?? "voley"]}</span>
                </div>
                <div className="text-sm text-muted">
                  {t.city}
                  {t.province ? `, ${t.province}` : ""}
                </div>
              </div>
            </Link>
          ))}
        </Card>
      </div>
      <Card>
        <CardHeader title="Nuevo equipo" />
        <ActionForm action={createTeam} submit="Crear equipo" className="p-4">
          <Field label="Nombre del club">
            <input name="name" required className={inputCls} />
          </Field>
          <Field label="Deporte" hint="Solo podrá inscribirse en torneos de este deporte">
            <select name="sport" className={inputCls} defaultValue="voley">
              <option value="voley">{SPORT_LABEL.voley}</option>
              <option value="ecuavoley">{SPORT_LABEL.ecuavoley}</option>
            </select>
          </Field>
          <Field label="Nombre corto (marcador)">
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
          <Field label="Color principal">
            <input name="color_primary" type="color" defaultValue="#1d4ed8" className="h-10 w-20 rounded border border-line" />
          </Field>
        </ActionForm>
      </Card>
    </div>
  );
}
