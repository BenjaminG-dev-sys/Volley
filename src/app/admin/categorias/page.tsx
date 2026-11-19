import type { Metadata } from "next";
import { ActionForm } from "@/components/action-form";
import { Badge, Card, CardHeader, Empty, Field, PageHeader, inputCls } from "@/components/ui";
import { ageRuleText, type CategoryDef } from "@/lib/tournament/categories";
import { listCategories } from "@/lib/tournament/categories-server";
import { deleteCategory, saveCategory } from "../actions";

export const metadata: Metadata = { title: "Categorías" };
export const dynamic = "force-dynamic";

function CategoryFields({ c }: { c?: CategoryDef }) {
  return (
    <div className="grid gap-3 sm:grid-cols-4">
      <div className="sm:col-span-2">
        <Field label="Nombre">
          <input name="name" defaultValue={c?.name} required maxLength={40} placeholder="Sub-18" className={inputCls} />
        </Field>
      </div>
      <Field label="Edad máxima" hint="Vacío = sin tope">
        <input name="max_age" type="number" min={1} max={99} defaultValue={c?.max_age ?? ""} className={inputCls} />
      </Field>
      <Field label="Edad mínima" hint="Vacío = sin mínimo">
        <input name="min_age" type="number" min={1} max={99} defaultValue={c?.min_age ?? ""} className={inputCls} />
      </Field>
      <Field label="Orden">
        <input name="sort" type="number" defaultValue={c?.sort ?? 100} className={inputCls} />
      </Field>
    </div>
  );
}

export default async function CategoriesPage() {
  const { list, stored } = await listCategories();
  const season = new Date().getFullYear();
  return (
    <div className="grid gap-6 xl:grid-cols-[3fr_2fr]">
      <div className="space-y-4">
        <PageHeader
          eyebrow={`${list.length} categorías`}
          title="Categorías"
          sub="Edita el nombre y la edad de cada categoría o agrega nuevas. La edad se cuenta con los años que la persona cumple en el año de la temporada, y se pide al registrar jugadores."
        />
        {!stored && (
          <Card className="p-4 text-sm">
            La tabla de categorías todavía no existe en la base de datos: se muestran las de fábrica. Aplica la migración
            <code className="mx-1">20261119100000_editable-categories.sql</code>
            o configura <code className="mx-1">INSFORGE_API_KEY</code> en el servidor para que se cree sola.
          </Card>
        )}
        <Card className="divide-y divide-line">
          {list.map((c) => (
            <div key={c.name} className="space-y-2 px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{c.name}</span>
                {c.max_age != null && <Badge tone="primary">Hasta {c.max_age} años</Badge>}
                {c.min_age != null && <Badge tone="accent">Desde {c.min_age} años</Badge>}
                {c.max_age == null && c.min_age == null && <Badge>Libre</Badge>}
                <span className="text-sm text-muted">Temporada {season}: {ageRuleText(c, season)}</span>
              </div>
              {stored && (
                <details>
                  <summary className="cursor-pointer text-xs font-semibold hover:underline">Editar</summary>
                  <ActionForm action={saveCategory} submit="Guardar" className="mt-3">
                    <input type="hidden" name="original_name" value={c.name} />
                    <CategoryFields c={c} />
                  </ActionForm>
                  <ActionForm
                    action={deleteCategory}
                    submit="Eliminar categoría"
                    variant="ghost"
                    confirm={`¿Eliminar la categoría ${c.name}?`}
                    className="mt-2"
                  >
                    <input type="hidden" name="original_name" value={c.name} />
                  </ActionForm>
                </details>
              )}
            </div>
          ))}
          {!list.length && <Empty>No hay categorías. Agrega la primera.</Empty>}
        </Card>
      </div>
      <Card className="h-fit">
        <CardHeader title="Nueva categoría" sub="Por ejemplo Sub-18 con edad máxima 18." />
        <ActionForm action={saveCategory} submit="Agregar" className="p-4">
          <CategoryFields />
        </ActionForm>
      </Card>
    </div>
  );
}
