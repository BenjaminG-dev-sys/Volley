import type { Metadata } from "next";
import { ActionForm } from "@/components/action-form";
import { Badge, Button, Card, CardHeader, Empty, Field, PageHeader, inputCls } from "@/components/ui";
import { serverClient } from "@/lib/insforge/server";
import type { Referee } from "@/lib/types";
import { saveReferee, toggleReferee } from "../actions";

export const metadata: Metadata = { title: "Árbitros" };
export const dynamic = "force-dynamic";

const LEVELS = { parroquial: "Parroquial", provincial: "Provincial", nacional: "Nacional", internacional: "Internacional" } as const;

function RefereeFields({ r }: { r?: Referee }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Nombre completo">
        <input name="name" defaultValue={r?.name} required className={inputCls} />
      </Field>
      <Field label="Nivel">
        <select name="level" defaultValue={r?.level ?? ""} className={inputCls}>
          <option value="">—</option>
          {Object.entries(LEVELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Teléfono / WhatsApp">
        <input name="phone" defaultValue={r?.phone ?? ""} inputMode="tel" className={inputCls} />
      </Field>
      <Field label="Correo">
        <input name="email" type="email" defaultValue={r?.email ?? ""} className={inputCls} />
      </Field>
      <Field label="Ciudad">
        <input name="city" defaultValue={r?.city ?? ""} className={inputCls} />
      </Field>
    </div>
  );
}

export default async function RefereesPage() {
  const db = (await serverClient()).database;
  const { data } = await db.from("referees").select("*").order("active", { ascending: false }).order("name");
  const refs = (data ?? []) as Referee[];
  return (
    <div className="grid gap-6 xl:grid-cols-[3fr_2fr]">
      <div className="space-y-4">
        <PageHeader eyebrow={`${refs.filter((r) => r.active).length} activos`} title="Árbitros" sub="Se asignan por jornada desde cada torneo (pestaña Partidos)." />
        <Card className="divide-y divide-line">
          {refs.map((r) => (
            <div key={r.id} id={`r-${r.id}`} className="space-y-2 px-4 py-3 target:bg-sun/20">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{r.name}</span>
                {r.level && <Badge>{LEVELS[r.level]}</Badge>}
                {!r.active && <Badge tone="live">Inactivo</Badge>}
                <span className="text-sm text-muted">{[r.city, r.phone, r.email].filter(Boolean).join(" · ")}</span>
                <form action={toggleReferee.bind(null, r.id, !r.active)} className="ml-auto">
                  <Button variant="secondary">{r.active ? "Desactivar" : "Activar"}</Button>
                </form>
              </div>
              <details>
                <summary className="cursor-pointer text-xs font-semibold hover:underline">Editar</summary>
                <ActionForm action={saveReferee} submit="Guardar" className="mt-3">
                  <input type="hidden" name="referee_id" value={r.id} />
                  <input type="hidden" name="active" value={r.active ? "on" : "off"} />
                  <RefereeFields r={r} />
                </ActionForm>
              </details>
            </div>
          ))}
          {!refs.length && <Empty>Aún no hay árbitros registrados.</Empty>}
        </Card>
      </div>
      <Card className="h-fit">
        <CardHeader title="Nuevo árbitro" />
        <ActionForm action={saveReferee} submit="Registrar" className="p-4">
          <RefereeFields />
        </ActionForm>
      </Card>
    </div>
  );
}
