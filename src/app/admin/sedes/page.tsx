import type { Metadata } from "next";
import { ActionForm } from "@/components/action-form";
import { Card, CardHeader, Empty, Field, PageHeader, inputCls } from "@/components/ui";
import { listVenues } from "@/lib/data";
import type { Venue } from "@/lib/types";
import { deleteVenue, saveVenue } from "../actions";

export const metadata: Metadata = { title: "Sedes" };
export const dynamic = "force-dynamic";

function VenueFields({ v }: { v?: Venue }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Field label="Nombre">
        <input name="name" defaultValue={v?.name} required className={inputCls} />
      </Field>
      <Field label="Ciudad">
        <input name="city" defaultValue={v?.city} required className={inputCls} />
      </Field>
      <Field label="Provincia">
        <input name="province" defaultValue={v?.province} required className={inputCls} />
      </Field>
    </div>
  );
}

export default async function VenuesPage() {
  const venues = await listVenues();
  return (
    <div className="grid gap-6 xl:grid-cols-[3fr_2fr]">
      <div className="space-y-4">
        <PageHeader eyebrow={`${venues.length} sedes`} title="Sedes" sub="Coliseos y canchas donde se programan los partidos." />
        <Card className="divide-y divide-line">
          {venues.map((v) => (
            <details key={v.id} id={`v-${v.id}`} className="px-4 py-3 target:bg-sun/20">
              <summary className="flex cursor-pointer items-center justify-between gap-3">
                <span>
                  <span className="font-semibold">{v.name}</span> <span className="text-sm text-muted">· {v.city}, {v.province}</span>
                </span>
                <span className="text-xs font-semibold">Editar</span>
              </summary>
              <div className="mt-3 space-y-3">
                <ActionForm action={saveVenue} submit="Guardar">
                  <input type="hidden" name="venue_id" value={v.id} />
                  <VenueFields v={v} />
                </ActionForm>
                <ActionForm action={deleteVenue} submit="Eliminar sede" variant="ghost" confirm={`¿Eliminar «${v.name}»? Los partidos quedarán sin sede.`}>
                  <input type="hidden" name="venue_id" value={v.id} />
                </ActionForm>
              </div>
            </details>
          ))}
          {!venues.length && <Empty>Aún no hay sedes.</Empty>}
        </Card>
      </div>
      <Card className="h-fit">
        <CardHeader title="Nueva sede" />
        <ActionForm action={saveVenue} submit="Crear sede" className="p-4">
          <VenueFields />
        </ActionForm>
      </Card>
    </div>
  );
}
