import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { Badge, Card, CardHeader, Empty, Field, PageHeader, inputCls } from "@/components/ui";
import { listTournaments } from "@/lib/data";
import { BRANCH_LABEL } from "@/lib/format";
import { RULE_PRESETS, SPORT_LABEL } from "@/lib/scoresheet/rules";
import { CATEGORIES } from "@/lib/tournament/categories";
import { createTournament } from "./actions";

export const metadata: Metadata = { title: "Administración" };

const STATUS = { draft: "Borrador", active: "En curso", finished: "Finalizado" } as const;

export default async function AdminHome() {
  const tournaments = await listTournaments();
  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <div>
        <PageHeader title="Torneos" sub="Crea torneos, inscribe equipos, genera el calendario y asigna planilleros." />
        <Card className="divide-y divide-line">
          {tournaments.map((t) => (
            <Link key={t.id} href={`/admin/torneos/${t.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-surface-2">
              <div>
                <div className="font-medium">{t.name}</div>
                <div className="text-sm text-muted">
                  {SPORT_LABEL[t.sport ?? "voley"]} · {t.category} · {BRANCH_LABEL[t.branch]} · {t.season}
                </div>
              </div>
              <Badge tone={t.status === "active" ? "ok" : "neutral"}>{STATUS[t.status]}</Badge>
            </Link>
          ))}
          {!tournaments.length && <Empty>Aún no hay torneos.</Empty>}
        </Card>
      </div>
      <Card>
        <CardHeader title="Nuevo torneo" />
        <ActionForm action={createTournament} submit="Crear torneo" className="p-4">
          <Field label="Nombre">
            <input name="name" required className={inputCls} placeholder="Campeonato Provincial Sub-17" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Temporada">
              <input name="season" type="number" defaultValue={new Date().getFullYear()} className={inputCls} />
            </Field>
            <Field label="Ciudad">
              <input name="city" className={inputCls} />
            </Field>
            <Field label="Categoría">
              <select name="category" className={inputCls}>
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="Rama">
              <select name="branch" className={inputCls}>
                {Object.entries(BRANCH_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Formato">
              <select name="format" className={inputCls}>
                <option value="round_robin">Todos contra todos</option>
                <option value="groups_knockout">Grupos + eliminatoria</option>
              </select>
            </Field>
            <Field label="Deporte y reglamento" hint="El ecuavóley se juega con 3 por equipo y cambio de saque">
              <select name="preset" className={inputCls} defaultValue="voley_fivb">
                {Object.entries(RULE_PRESETS).map(([id, p]) => (
                  <option key={id} value={id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </ActionForm>
      </Card>
    </div>
  );
}
