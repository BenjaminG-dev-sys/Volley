import type { Metadata } from "next";
import { ActionForm } from "@/components/action-form";
import { Badge, Card, CardHeader, Empty, Field, PageHeader, inputCls } from "@/components/ui";
import { serverClient } from "@/lib/insforge/server";
import type { Organization } from "@/lib/types";
import { deleteOrganization, saveOrganization } from "../actions";

export const metadata: Metadata = { title: "Organizaciones" };
export const dynamic = "force-dynamic";

const KINDS = { federation: "Federación", association: "Asociación", league: "Liga" } as const;

function OrgFields({ o }: { o?: Organization }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Nombre">
        <input name="name" defaultValue={o?.name} required className={inputCls} />
      </Field>
      <Field label="Sigla">
        <input name="short_name" defaultValue={o?.short_name ?? ""} className={inputCls} />
      </Field>
      <Field label="Tipo">
        <select name="kind" defaultValue={o?.kind ?? "association"} className={inputCls}>
          {Object.entries(KINDS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Provincia">
        <input name="province" defaultValue={o?.province ?? ""} className={inputCls} />
      </Field>
    </div>
  );
}

export default async function OrganizationsPage() {
  const db = (await serverClient()).database;
  const { data } = await db.from("organizations").select("*").order("name");
  const orgs = (data ?? []) as Organization[];
  return (
    <div className="grid gap-6 xl:grid-cols-[3fr_2fr]">
      <div className="space-y-4">
        <PageHeader eyebrow={`${orgs.length} organizaciones`} title="Organizaciones" sub="Federaciones, asociaciones y ligas (parroquiales o barriales) que organizan torneos y agrupan clubes." />
        <Card className="divide-y divide-line">
          {orgs.map((o) => (
            <details key={o.id} className="px-4 py-3">
              <summary className="flex cursor-pointer items-center justify-between gap-3">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{o.name}</span>
                  <Badge>{KINDS[o.kind]}</Badge>
                  {o.province && <span className="text-sm text-muted">{o.province}</span>}
                </span>
                <span className="text-xs font-semibold">Editar</span>
              </summary>
              <div className="mt-3 space-y-3">
                <ActionForm action={saveOrganization} submit="Guardar">
                  <input type="hidden" name="organization_id" value={o.id} />
                  <OrgFields o={o} />
                </ActionForm>
                <ActionForm action={deleteOrganization} submit="Eliminar" variant="ghost" confirm={`¿Eliminar «${o.name}»? Sus torneos y equipos quedan sin organización.`}>
                  <input type="hidden" name="organization_id" value={o.id} />
                </ActionForm>
              </div>
            </details>
          ))}
          {!orgs.length && <Empty>Aún no hay organizaciones.</Empty>}
        </Card>
      </div>
      <Card className="h-fit">
        <CardHeader title="Nueva organización" />
        <ActionForm action={saveOrganization} submit="Crear" className="p-4">
          <OrgFields />
        </ActionForm>
      </Card>
    </div>
  );
}
