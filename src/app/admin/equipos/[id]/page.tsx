import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { Badge, Button, Card, CardHeader, Field, PageHeader, TeamDot, inputCls } from "@/components/ui";
import { serverClient } from "@/lib/insforge/server";
import { CATEGORIES } from "@/lib/tournament/categories";
import type { Player, Team } from "@/lib/types";
import { createPlayer, deletePlayer } from "../../actions";

export const metadata: Metadata = { title: "Nómina" };

export default async function TeamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = (await serverClient()).database;
  const [{ data: team }, { data: players }] = await Promise.all([
    db.from("teams").select("*").eq("id", id).maybeSingle(),
    db.from("players").select("*").eq("team_id", id).order("number"),
  ]);
  if (!team) notFound();
  const t = team as Team;
  const list = (players ?? []) as Player[];

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <TeamDot color={t.color_primary} /> {t.name}
          </span>
        }
        sub={`${list.length}/14 jugadores · ${list.filter((p) => p.is_libero).length}/2 líberos`}
      />
      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-left text-xs uppercase text-muted">
              <tr>
                <th className="px-3 py-2">N.º</th>
                <th className="px-3 py-2">Nombre</th>
                <th className="px-3 py-2">Cédula</th>
                <th className="px-3 py-2">Nacimiento</th>
                <th className="px-3 py-2">Posición</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="tabular divide-y divide-line">
              {list.map((p) => (
                <tr key={p.id}>
                  <td className="px-3 py-2 font-display text-lg font-bold">{p.number}</td>
                  <td className="px-3 py-2">
                    {p.first_name} {p.last_name} {p.is_captain && <Badge tone="primary">C</Badge>} {p.is_libero && <Badge tone="accent">L</Badge>}
                  </td>
                  <td className="px-3 py-2">{p.cedula}</td>
                  <td className="px-3 py-2">{p.birth_date}</td>
                  <td className="px-3 py-2 capitalize">{p.position ?? "—"}</td>
                  <td className="px-3 py-2 text-right">
                    <form action={deletePlayer.bind(null, id, p.id)}>
                      <Button variant="ghost" className="text-live" aria-label={`Eliminar ${p.first_name}`}>
                        Eliminar
                      </Button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card>
          <CardHeader title="Registrar jugador(a)" sub="Se valida la cédula ecuatoriana y la edad de la categoría." />
          <ActionForm action={createPlayer} submit="Registrar" className="p-4">
            <input type="hidden" name="team_id" value={id} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nombres">
                <input name="first_name" required className={inputCls} />
              </Field>
              <Field label="Apellidos">
                <input name="last_name" required className={inputCls} />
              </Field>
              <Field label="Cédula">
                <input name="cedula" required inputMode="numeric" pattern="\d{10}" maxLength={10} className={inputCls} />
              </Field>
              <Field label="Fecha de nacimiento">
                <input name="birth_date" type="date" required className={inputCls} />
              </Field>
              <Field label="Número">
                <input name="number" type="number" min={1} max={99} required className={inputCls} />
              </Field>
              <Field label="Posición">
                <select name="position" className={inputCls}>
                  <option value="">—</option>
                  {["armador", "opuesto", "central", "punta"].map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Validar edad para" hint="Opcional">
                <select name="category" className={inputCls}>
                  <option value="">Sin validar</option>
                  {CATEGORIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <Field label="Temporada">
                <input name="season" type="number" defaultValue={new Date().getFullYear()} className={inputCls} />
              </Field>
            </div>
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" name="is_libero" /> Líbero
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="is_captain" /> Capitán(a)
              </label>
            </div>
          </ActionForm>
        </Card>
      </div>
    </div>
  );
}
