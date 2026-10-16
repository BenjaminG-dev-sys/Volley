import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { Badge, Button, Card, CardHeader, Field, LinkButton, PageHeader, TeamCrest, inputCls } from "@/components/ui";
import { serverClient } from "@/lib/insforge/server";
import { ROSTER_LIMITS, SPORT_LABEL, SPORT_POSITIONS } from "@/lib/scoresheet/rules";
import { CATEGORIES } from "@/lib/tournament/categories";
import type { Organization, Player, Team } from "@/lib/types";
import { createPlayer, deletePlayer, deleteTeam, importRoster, updatePlayer, updateTeam, uploadTeamImage } from "../../actions";

export const metadata: Metadata = { title: "Nómina" };
export const dynamic = "force-dynamic";

export default async function TeamAdmin({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = (await serverClient()).database;
  const [{ data: team }, { data: players }, { data: teamsData }, { data: orgsData }] = await Promise.all([
    db.from("teams").select("*").eq("id", id).maybeSingle(),
    db.from("players").select("*").eq("team_id", id).order("number"),
    db.from("teams").select("id, name, short_name, sport").order("name"),
    db.from("organizations").select("*").order("name"),
  ]);
  if (!team) notFound();
  const t = team as Team;
  const list = (players ?? []) as Player[];
  const sport = t.sport ?? "voley";
  const limits = ROSTER_LIMITS[sport];
  const sameSport = ((teamsData ?? []) as Team[]).filter((x) => (x.sport ?? "voley") === sport);
  const orgs = (orgsData ?? []) as Organization[];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`${SPORT_LABEL[sport]} · ${list.length}/${limits.players} jugadores${limits.liberos ? ` · ${list.filter((p) => p.is_libero).length}/${limits.liberos} líberos` : ""}`}
        title={
          <span className="flex items-center gap-4">
            <TeamCrest name={t.name} color={t.color_primary} logo={t.logo_url} size="md" /> {t.name}
          </span>
        }
        action={
          <div className="flex flex-wrap gap-2">
            <LinkButton variant="secondary" href={`/equipos/${id}`}>
              Ver perfil público
            </LinkButton>
            <LinkButton variant="secondary" href={`/admin/exportar?tipo=equipo&equipo=${id}`} prefetch={false}>
              Exportar nómina
            </LinkButton>
          </div>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[3fr_2fr]">
        <Card className="overflow-x-auto">
          <CardHeader title="Nómina" sub="Toca «Editar» para cambiar datos, foto o mover a otro equipo." />
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
            <tbody className="divide-y divide-line">
              {list.map((p) => (
                <tr key={p.id} id={`p-${p.id}`} className="align-top target:bg-sun/20">
                  <td className="tabular px-3 py-2 font-display text-lg font-bold">{p.number}</td>
                  <td className="px-3 py-2">
                    {p.first_name} {p.last_name} {p.is_captain && <Badge tone="primary">C</Badge>} {p.is_libero && <Badge tone="accent">L</Badge>}
                  </td>
                  <td className="tabular px-3 py-2 text-muted">{p.cedula}</td>
                  <td className="tabular px-3 py-2 text-muted">{p.birth_date}</td>
                  <td className="px-3 py-2 capitalize">{p.position ?? "—"}</td>
                  <td className="px-3 py-2 text-right">
                    <details className="group text-left">
                      <summary className="cursor-pointer list-none text-right text-xs font-semibold hover:underline">Editar</summary>
                      <div className="mt-3 w-[min(36rem,80vw)] rounded-xl border border-line bg-surface p-3 shadow-lg">
                        <ActionForm action={updatePlayer} submit="Guardar">
                          <input type="hidden" name="player_id" value={p.id} />
                          <input type="hidden" name="from_team_id" value={id} />
                          <PlayerFields p={p} sport={sport} />
                          <div className="grid gap-3 sm:grid-cols-2">
                            <Field label="Equipo" hint="Para transferir a otro equipo del mismo deporte">
                              <select name="team_id" defaultValue={id} className={inputCls}>
                                {sameSport.map((x) => (
                                  <option key={x.id} value={x.id}>
                                    {x.name}
                                  </option>
                                ))}
                              </select>
                            </Field>
                            <Field label="Foto" hint="Opcional, hasta 5 MB">
                              <input type="file" name="photo" accept="image/*" className="block text-sm" />
                            </Field>
                          </div>
                        </ActionForm>
                        <form action={deletePlayer.bind(null, id, p.id)} className="mt-2">
                          <Button variant="ghost" className="text-live">
                            Eliminar de la nómina
                          </Button>
                        </form>
                      </div>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Agregar jugador(a)" sub="Cédula ecuatoriana validada y edad por categoría." />
            <ActionForm action={createPlayer} submit="Registrar" className="p-4">
              <input type="hidden" name="team_id" value={id} />
              <PlayerFields sport={sport} />
              <div className="grid gap-3 sm:grid-cols-2">
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
            </ActionForm>
          </Card>

          <Card>
            <CardHeader title="Importar nómina (CSV)" sub="Se valida cada fila; solo se agregan las correctas y se listan los errores." />
            <ActionForm action={importRoster} submit="Importar" className="p-4">
              <input type="hidden" name="team_id" value={id} />
              <Field label="Archivo CSV">
                <input type="file" name="file" accept=".csv,text/csv" className="block text-sm" />
              </Field>
              <Field label="…o pega aquí el contenido">
                <textarea name="csv" rows={4} className={inputCls} placeholder="Nombres;Apellidos;Cédula;Fecha de nacimiento;Número;Posición;Líbero;Capitán" />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Validar edad para">
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
              <a className="text-xs font-semibold underline" href="/admin/exportar?tipo=plantilla">
                Descargar plantilla CSV
              </a>
            </ActionForm>
          </Card>

          <Card>
            <CardHeader title="Datos del equipo" />
            <ActionForm action={updateTeam} submit="Guardar" className="p-4">
              <input type="hidden" name="team_id" value={id} />
              <Field label="Nombre">
                <input name="name" defaultValue={t.name} required className={inputCls} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Nombre corto">
                  <input name="short_name" defaultValue={t.short_name} required maxLength={14} className={inputCls} />
                </Field>
                <Field label="Ciudad">
                  <input name="city" defaultValue={t.city ?? ""} className={inputCls} />
                </Field>
                <Field label="Provincia">
                  <input name="province" defaultValue={t.province ?? ""} className={inputCls} />
                </Field>
                <Field label="Organización">
                  <select name="organization_id" defaultValue={t.organization_id ?? ""} className={inputCls}>
                    <option value="">Ninguna</option>
                    {orgs.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="flex gap-4">
                <Field label="Color principal">
                  <input name="color_primary" type="color" defaultValue={t.color_primary} className="h-10 w-20 rounded border border-line" />
                </Field>
                <Field label="Color secundario">
                  <input name="color_secondary" type="color" defaultValue={t.color_secondary} className="h-10 w-20 rounded border border-line" />
                </Field>
              </div>
            </ActionForm>
          </Card>

          <Card>
            <CardHeader title="Logo y portada" sub="Se guardan en InsForge Storage." />
            <div className="grid gap-4 p-4 sm:grid-cols-2">
              {(["logo", "cover"] as const).map((kind) => {
                const url = kind === "logo" ? t.logo_url : t.cover_url;
                return (
                  <div key={kind} className="space-y-2">
                    <p className="text-sm font-semibold">{kind === "logo" ? "Logo" : "Portada"}</p>
                    {url && (
                      // eslint-disable-next-line @next/next/no-img-element -- imagen de Storage
                      <img src={url} alt="" className={kind === "logo" ? "h-20 w-20 rounded-full object-contain ring-1 ring-line" : "aspect-[16/7] w-full rounded-lg object-cover"} />
                    )}
                    <ActionForm action={uploadTeamImage} submit="Subir">
                      <input type="hidden" name="team_id" value={id} />
                      <input type="hidden" name="kind" value={kind} />
                      <input type="file" name="file" accept="image/*" required className="block w-full text-xs" />
                    </ActionForm>
                    {url && (
                      <ActionForm action={uploadTeamImage} submit="Quitar" variant="ghost">
                        <input type="hidden" name="team_id" value={id} />
                        <input type="hidden" name="kind" value={kind} />
                        <input type="hidden" name="remove" value="1" />
                      </ActionForm>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>

          <Card>
            <CardHeader title="Eliminar equipo" sub="Solo si no tiene partidos. Borra también su nómina." />
            <ActionForm action={deleteTeam} submit="Eliminar equipo" variant="danger" className="p-4" confirm={`¿Eliminar «${t.name}» y su nómina?`}>
              <input type="hidden" name="team_id" value={id} />
            </ActionForm>
          </Card>
        </div>
      </div>
    </div>
  );
}

function PlayerFields({ p, sport }: { p?: Player; sport: "voley" | "ecuavoley" }) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nombres">
          <input name="first_name" defaultValue={p?.first_name} required className={inputCls} />
        </Field>
        <Field label="Apellidos">
          <input name="last_name" defaultValue={p?.last_name} required className={inputCls} />
        </Field>
        <Field label="Cédula">
          <input name="cedula" defaultValue={p?.cedula} required inputMode="numeric" pattern="\d{10}" maxLength={10} className={inputCls} />
        </Field>
        <Field label="Fecha de nacimiento">
          <input name="birth_date" type="date" defaultValue={p?.birth_date} required className={inputCls} />
        </Field>
        <Field label="Número">
          <input name="number" type="number" min={1} max={99} defaultValue={p?.number} required className={inputCls} />
        </Field>
        <Field label="Posición">
          <select name="position" defaultValue={p?.position ?? ""} className={inputCls}>
            <option value="">—</option>
            {SPORT_POSITIONS[sport].map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="flex gap-4 text-sm">
        {ROSTER_LIMITS[sport].liberos > 0 && (
          <label className="flex items-center gap-2">
            <input type="checkbox" name="is_libero" defaultChecked={p?.is_libero} /> Líbero
          </label>
        )}
        <label className="flex items-center gap-2">
          <input type="checkbox" name="is_captain" defaultChecked={p?.is_captain} /> Capitán(a)
        </label>
      </div>
    </>
  );
}
