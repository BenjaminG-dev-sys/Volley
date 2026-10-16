import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { Badge, Button, Card, CardHeader, Empty, Field, LinkButton, PageHeader, TeamCrest, cx, inputCls } from "@/components/ui";
import { getTournament, listTeams, listVenues } from "@/lib/data";
import { BRANCH_LABEL, fmtDateTime } from "@/lib/format";
import { serverClient } from "@/lib/insforge/server";
import { RULE_PRESETS, SPORT_LABEL, describeRules, resolveRules } from "@/lib/scoresheet/rules";
import { CATEGORIES } from "@/lib/tournament/categories";
import { STANDINGS_PRESETS, standingsConfig } from "@/lib/tournament/standings";
import type { Match, Profile, Referee, Team, Tournament, Venue } from "@/lib/types";
import { STAGE_LABEL } from "@/lib/types";
import {
  assignReferees,
  createMatch,
  deleteMatch,
  deleteTournament,
  generateKnockout,
  generateSchedule,
  reopenMatch,
  setTournamentStatus,
  updateMatch,
  updateTournament,
  uploadTournamentCover,
} from "../../actions";
import { ScheduleBoard } from "../../schedule-board";
import { EntriesEditor } from "./entries-editor";

export const metadata: Metadata = { title: "Administrar torneo" };
export const dynamic = "force-dynamic";

const TABS = [
  { id: "resumen", label: "Resumen y ajustes" },
  { id: "equipos", label: "Equipos" },
  { id: "calendario", label: "Calendario" },
  { id: "partidos", label: "Partidos" },
  { id: "eliminatorias", label: "Eliminatorias" },
  { id: "exportar", label: "Exportar" },
] as const;
type Tab = (typeof TABS)[number]["id"];

const toLocalInput = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() - 5 * 3600_000).toISOString().slice(0, 16) : "");

/** Preset de reglamento que corresponde a lo guardado en el torneo (para preseleccionar). */
function presetOf(t: Tournament) {
  const found = Object.entries(RULE_PRESETS).find(
    ([, p]) => p.sport === (t.sport ?? "voley") && p.bestOf === t.best_of && JSON.stringify(Object.keys(p.overrides).length ? p.overrides : null) === JSON.stringify(t.rules ?? null),
  );
  return found?.[0] ?? (t.sport === "ecuavoley" ? "ecuavoley_15" : "voley_fivb");
}
function standingsPresetOf(t: Tournament) {
  const c = standingsConfig(t.standings);
  return Object.entries(STANDINGS_PRESETS).find(([, p]) => JSON.stringify(p.config) === JSON.stringify(c))?.[0] ?? "fivb";
}

export default async function AdminTournament({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; jornada?: string }>;
}) {
  const { id } = await params;
  const { tab: rawTab, jornada } = await searchParams;
  const tab: Tab = TABS.some((t) => t.id === rawTab) ? (rawTab as Tab) : "resumen";
  const db = (await serverClient()).database;
  const [{ tournament, entries, matches }, teams, venues, scorersRes, refereesRes] = await Promise.all([
    getTournament(id),
    listTeams(),
    listVenues(),
    db.from("profiles").select("user_id, display_name, email, role").in("role", ["scorer", "organizer", "admin"]).limit(200),
    db.from("referees").select("*").eq("active", true).order("name"),
  ]);
  if (!tournament) notFound();
  const scorers = (scorersRes.data ?? []) as Profile[];
  const referees = (refereesRes.data ?? []) as Referee[];
  const teamMap = new Map(teams.map((t) => [t.id, t]));
  const locked = matches.some((m) => m.status !== "scheduled");
  const rounds = [...new Set(matches.map((m) => m.round).filter((r): r is number => r !== null))].sort((a, b) => a - b);
  const round = Number(jornada) || null;
  const listed = matches.filter((m) => !round || m.round === round);
  const rules = resolveRules(tournament.sport ?? "voley", tournament.rules, tournament.best_of);
  const tabHref = (t: Tab) => `/admin/torneos/${id}?tab=${t}`;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`${SPORT_LABEL[tournament.sport ?? "voley"]} · ${tournament.category} · ${BRANCH_LABEL[tournament.branch]} · ${tournament.season}`}
        title={tournament.name}
        sub={describeRules(rules)}
        action={
          <div className="flex flex-wrap gap-2">
            <LinkButton variant="secondary" href={`/torneos/${id}`}>
              Ver público
            </LinkButton>
            {(["draft", "active", "finished"] as const).map((s) => (
              <form key={s} action={setTournamentStatus.bind(null, id, s)}>
                <Button variant={tournament.status === s ? "primary" : "secondary"}>
                  {{ draft: "Borrador", active: "Publicado", finished: "Finalizado" }[s]}
                </Button>
              </form>
            ))}
          </div>
        }
      />

      <nav aria-label="Secciones del torneo" className="-mx-1 flex gap-1 overflow-x-auto border-b border-line pb-px">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={tabHref(t.id)}
            aria-current={tab === t.id ? "page" : undefined}
            className={cx(
              "whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-semibold",
              tab === t.id ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === "resumen" && <SettingsTab t={tournament} locked={locked} hasEntries={entries.length > 0} />}

      {tab === "equipos" && (
        <Card>
          <CardHeader title="Equipos inscritos" sub={`${entries.length} equipos · solo de ${SPORT_LABEL[tournament.sport ?? "voley"].toLowerCase()}`} />
          <EntriesEditor
            tournamentId={id}
            teams={teams.filter((t) => (t.sport ?? "voley") === (tournament.sport ?? "voley"))}
            selected={entries.map((e) => e.team_id)}
            locked={locked}
          />
        </Card>
      )}

      {tab === "calendario" && (
        <div className="space-y-6">
          <Card>
            <CardHeader title="Generar calendario" sub="Reemplaza todos los partidos en una sola operación; se bloquea cuando ya hay partidos jugados." />
            <ActionForm action={generateSchedule} submit="Generar calendario" className="p-4" confirm={matches.length ? "Esto reemplaza el calendario actual. ¿Continuar?" : undefined}>
              <input type="hidden" name="tournament_id" value={id} />
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Primera jornada">
                  <input type="date" name="start_date" required className={inputCls} />
                </Field>
                <Field label="Hora del primer partido">
                  <input type="time" name="start_time" defaultValue="09:00" className={inputCls} />
                </Field>
                <Field label="Sede">
                  <select name="venue_id" className={inputCls}>
                    <option value="">Por definir</option>
                    {venues.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name} ({v.city})
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Días entre jornadas">
                  <input type="number" name="days_between" min={1} max={30} defaultValue={7} className={inputCls} />
                </Field>
                <Field label="Horas entre partidos">
                  <input type="number" name="slot_hours" min={1} max={4} step={0.5} defaultValue={2} className={inputCls} />
                </Field>
                {tournament.format === "groups_knockout" && (
                  <Field label="Grupos">
                    <input type="number" name="groups" min={1} max={4} defaultValue={2} className={inputCls} />
                  </Field>
                )}
              </div>
              {locked && <p className="text-xs text-muted">Ya hay partidos jugados: no se puede regenerar.</p>}
            </ActionForm>
          </Card>
          <ScheduleBoard matches={matches.filter((m) => m.status !== "finished")} teams={teams} venues={venues} />
        </div>
      )}

      {tab === "partidos" && (
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="Árbitros por jornada" sub="Rota los árbitros activos entre los partidos programados." />
              <ActionForm action={assignReferees} submit="Asignar árbitros" className="p-4">
                <input type="hidden" name="tournament_id" value={id} />
                <Field label="Jornada">
                  <select name="round" className={inputCls} defaultValue={round ?? ""}>
                    <option value="">Todas las pendientes</option>
                    {rounds.map((r) => (
                      <option key={r} value={r}>
                        Jornada {r}
                      </option>
                    ))}
                  </select>
                </Field>
                {referees.length < 2 && (
                  <p className="text-xs text-muted">
                    Registra árbitros en <Link className="underline" href="/admin/arbitros">Árbitros</Link>.
                  </p>
                )}
              </ActionForm>
            </Card>
            <Card>
              <CardHeader title="Agregar partido" sub="Amistoso, partido aplazado o desempate." />
              <ActionForm action={createMatch} submit="Crear partido" className="p-4">
                <input type="hidden" name="tournament_id" value={id} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <TeamSelect name="home_team_id" label="Local" teams={entries.map((e) => teamMap.get(e.team_id)).filter((t): t is Team => !!t)} />
                  <TeamSelect name="away_team_id" label="Visitante" teams={entries.map((e) => teamMap.get(e.team_id)).filter((t): t is Team => !!t)} />
                  <Field label="Fase">
                    <select name="stage" className={inputCls} defaultValue={tournament.format === "groups_knockout" ? "group" : "league"}>
                      {Object.entries(STAGE_LABEL).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Jornada">
                    <input type="number" name="round" min={1} className={inputCls} />
                  </Field>
                  <Field label="Fecha y hora">
                    <input type="datetime-local" name="scheduled_at" className={inputCls} />
                  </Field>
                  <Field label="Sede">
                    <select name="venue_id" className={inputCls}>
                      <option value="">Por definir</option>
                      {venues.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
              </ActionForm>
            </Card>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href={`${tabHref("partidos")}`}
              className={cx("rounded-full border-[1.5px] px-3 py-1 text-sm font-semibold", !round ? "border-ink bg-ink text-bg" : "border-line")}
            >
              Todas
            </Link>
            {rounds.map((r) => (
              <Link
                key={r}
                href={`${tabHref("partidos")}&jornada=${r}`}
                className={cx("rounded-full border-[1.5px] px-3 py-1 text-sm font-semibold", round === r ? "border-ink bg-ink text-bg" : "border-line")}
              >
                J{r}
              </Link>
            ))}
          </div>

          <datalist id="referee-names">
            {referees.map((r) => (
              <option key={r.id} value={r.name} />
            ))}
          </datalist>
          <Card className="divide-y divide-line">
            <CardHeader title="Partidos" sub="Planillero, árbitros, sede y horario (hora de Ecuador)." />
            {listed.map((m) => (
              <MatchEditor key={m.id} m={m} teams={teamMap} venues={venues} scorers={scorers} tournamentId={id} />
            ))}
            {!listed.length && <Empty>Sin partidos.</Empty>}
          </Card>
        </div>
      )}

      {tab === "eliminatorias" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader
              title="Generar siguiente fase"
              sub="1 grupo: 1.º–4.º y 2.º–3.º · 2 grupos: cruzadas · 3 grupos: primeros + mejor segundo · 4 grupos: primeros de cada grupo. Luego final y tercer lugar."
            />
            <ActionForm action={generateKnockout} submit="Generar" className="p-4">
              <input type="hidden" name="tournament_id" value={id} />
              <Field label="Fecha y hora" hint="Opcional; por defecto, dentro de una semana">
                <input type="datetime-local" name="scheduled_at" className={inputCls} />
              </Field>
            </ActionForm>
          </Card>
          <Card className="divide-y divide-line">
            <CardHeader title="Fase final" />
            {matches
              .filter((m) => ["semifinal", "third_place", "final"].includes(m.stage))
              .map((m) => (
                <div key={m.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                  <Badge>{STAGE_LABEL[m.stage]}</Badge>
                  <span className="font-semibold">{teamMap.get(m.home_team_id)?.short_name}</span> vs
                  <span className="font-semibold">{teamMap.get(m.away_team_id)?.short_name}</span>
                  <span className="ml-auto text-muted">{fmtDateTime(m.scheduled_at)}</span>
                </div>
              ))}
            {!matches.some((m) => ["semifinal", "third_place", "final"].includes(m.stage)) && <Empty>Aún no hay fase final.</Empty>}
          </Card>
        </div>
      )}

      {tab === "exportar" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="space-y-3 p-5">
            <h2 className="font-display text-lg font-bold uppercase">Hojas de cálculo (CSV)</h2>
            <p className="text-sm text-muted">Se abren en Excel o Google Sheets (separador «;»).</p>
            <div className="flex flex-wrap gap-2">
              <LinkButton variant="secondary" href={`/admin/exportar?tipo=posiciones&torneo=${id}`} prefetch={false}>
                Posiciones
              </LinkButton>
              <LinkButton variant="secondary" href={`/admin/exportar?tipo=calendario&torneo=${id}`} prefetch={false}>
                Calendario y resultados
              </LinkButton>
              <LinkButton variant="secondary" href={`/admin/exportar?tipo=nominas&torneo=${id}`} prefetch={false}>
                Nóminas (con cédula)
              </LinkButton>
            </div>
          </Card>
          <Card className="space-y-3 p-5">
            <h2 className="font-display text-lg font-bold uppercase">Planillas para imprimir</h2>
            <p className="text-sm text-muted">Todas las planillas de una jornada en una sola página (Imprimir / Guardar como PDF).</p>
            <div className="flex flex-wrap gap-2">
              {rounds.map((r) => (
                <LinkButton key={r} variant="secondary" href={`/admin/torneos/${id}/planillas?jornada=${r}`}>
                  Jornada {r}
                </LinkButton>
              ))}
              {matches.some((m) => m.round === null) && (
                <LinkButton variant="secondary" href={`/admin/torneos/${id}/planillas?jornada=final`}>
                  Fase final
                </LinkButton>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function SettingsTab({ t, locked, hasEntries }: { t: Tournament; locked: boolean; hasEntries: boolean }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
      <Card>
        <CardHeader title="Datos y reglamento" sub={locked ? "Con partidos jugados no se cambian el reglamento ni el formato." : undefined} />
        <ActionForm action={updateTournament} submit="Guardar cambios" className="p-4">
          <input type="hidden" name="tournament_id" value={t.id} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nombre">
              <input name="name" defaultValue={t.name} required className={inputCls} />
            </Field>
            <Field label="Ciudad">
              <input name="city" defaultValue={t.city ?? ""} className={inputCls} />
            </Field>
            <Field label="Temporada">
              <input name="season" type="number" defaultValue={t.season} className={inputCls} />
            </Field>
            <Field label="Categoría">
              <select name="category" defaultValue={t.category} className={inputCls}>
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="Rama">
              <select name="branch" defaultValue={t.branch} className={inputCls}>
                {Object.entries(BRANCH_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Formato">
              <select name="format" defaultValue={t.format} className={inputCls}>
                <option value="round_robin">Todos contra todos</option>
                <option value="groups_knockout">Grupos + eliminatoria</option>
              </select>
            </Field>
            <Field label="Deporte y reglamento" hint={hasEntries ? "Para cambiar de deporte, quita antes los equipos inscritos" : undefined}>
              <select name="preset" defaultValue={presetOf(t)} className={inputCls}>
                {Object.entries(RULE_PRESETS).map(([pid, p]) => (
                  <option key={pid} value={pid}>
                    {p.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Sistema de puntos">
              <select name="standings" defaultValue={standingsPresetOf(t)} className={inputCls}>
                {Object.entries(STANDINGS_PRESETS).map(([pid, p]) => (
                  <option key={pid} value={pid}>
                    {p.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Color del torneo">
              <input name="color" type="color" defaultValue={t.color ?? "#ff6b1a"} className="h-11 w-24 rounded-lg border border-line" />
            </Field>
          </div>
        </ActionForm>
      </Card>
      <div className="space-y-6">
        <Card>
          <CardHeader title="Portada" sub="Foto horizontal; se muestra en duotono con el color del torneo." />
          <div className="space-y-3 p-4">
            {t.cover_url && (
              // eslint-disable-next-line @next/next/no-img-element -- imagen de Storage
              <img src={t.cover_url} alt="Portada actual" className="aspect-[16/7] w-full rounded-xl object-cover" />
            )}
            <ActionForm action={uploadTournamentCover} submit="Subir portada">
              <input type="hidden" name="tournament_id" value={t.id} />
              <input type="file" name="file" accept="image/*" required className="block text-sm" />
            </ActionForm>
            {t.cover_url && (
              <ActionForm action={uploadTournamentCover} submit="Quitar portada" variant="ghost">
                <input type="hidden" name="tournament_id" value={t.id} />
                <input type="hidden" name="remove" value="1" />
              </ActionForm>
            )}
          </div>
        </Card>
        <Card>
          <CardHeader title="Eliminar torneo" sub="Solo si no tiene partidos jugados. Borra calendario e inscripciones." />
          <ActionForm action={deleteTournament} submit="Eliminar torneo" variant="danger" className="p-4" confirm={`¿Eliminar «${t.name}»? No se puede deshacer.`}>
            <input type="hidden" name="tournament_id" value={t.id} />
          </ActionForm>
        </Card>
      </div>
    </div>
  );
}

function TeamSelect({ name, label, teams }: { name: string; label: string; teams: Team[] }) {
  return (
    <Field label={label}>
      <select name={name} required className={inputCls}>
        <option value="">Elegir…</option>
        {teams.map((t) => (
          <option key={t.id} value={t.id}>
            {t.short_name}
          </option>
        ))}
      </select>
    </Field>
  );
}

function MatchEditor({
  m,
  teams,
  venues,
  scorers,
  tournamentId,
}: {
  m: Match;
  teams: Map<string, Team>;
  venues: Venue[];
  scorers: Profile[];
  tournamentId: string;
}) {
  const h = teams.get(m.home_team_id);
  const a = teams.get(m.away_team_id);
  return (
    <div className="space-y-3 px-4 py-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge>
          {STAGE_LABEL[m.stage]} {m.group_label ?? ""} {m.round ? `· J${m.round}` : ""}
        </Badge>
        <TeamCrest name={h?.name ?? ""} color={h?.color_primary ?? "#999"} size="xs" /> <strong>{h?.short_name}</strong> vs
        <TeamCrest name={a?.name ?? ""} color={a?.color_primary ?? "#999"} size="xs" /> <strong>{a?.short_name}</strong>
        <span className="text-muted">· {fmtDateTime(m.scheduled_at)}</span>
        {m.status === "live" && <Badge tone="live">En vivo</Badge>}
        {m.status === "finished" && (
          <Badge tone="ok">
            Final {m.result?.home_sets}-{m.result?.away_sets}
          </Badge>
        )}
        <span className="ml-auto flex gap-3 text-xs font-medium">
          <Link className="hover:underline" href={`/mesa/${m.id}`}>
            Abrir mesa
          </Link>
          <Link className="hover:underline" href={`/partidos/${m.id}/planilla`}>
            Planilla
          </Link>
        </span>
      </div>
      {m.status !== "finished" ? (
        <div className="flex flex-wrap items-end gap-2">
          <ActionForm action={updateMatch} submit="Guardar" inline>
            <input type="hidden" name="match_id" value={m.id} />
            <input type="hidden" name="tournament_id" value={tournamentId} />
            <select name="scorer_id" defaultValue={m.scorer_id ?? ""} className={`${inputCls} w-auto`} aria-label="Planillero">
              <option value="">Sin planillero</option>
              {scorers.map((s) => (
                <option key={s.user_id} value={s.user_id}>
                  {s.display_name || s.email}
                </option>
              ))}
            </select>
            <input name="referee_1" list="referee-names" defaultValue={m.referee_1 ?? ""} placeholder="1.er árbitro" className={`${inputCls} w-40`} />
            <input name="referee_2" list="referee-names" defaultValue={m.referee_2 ?? ""} placeholder="2.º árbitro" className={`${inputCls} w-40`} />
            <select name="venue_id" defaultValue={m.venue_id ?? ""} className={`${inputCls} w-auto`} aria-label="Sede">
              <option value="">Sede por definir</option>
              {venues.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
            <input type="datetime-local" name="scheduled_at" defaultValue={toLocalInput(m.scheduled_at)} className={`${inputCls} w-auto`} />
          </ActionForm>
          {m.status === "scheduled" && (
            <ActionForm action={deleteMatch} submit="Eliminar" variant="ghost" inline confirm="¿Eliminar este partido?">
              <input type="hidden" name="match_id" value={m.id} />
            </ActionForm>
          )}
        </div>
      ) : (
        <ActionForm
          action={reopenMatch}
          submit="Reabrir para corregir"
          variant="secondary"
          inline
          confirm="El partido vuelve a «en vivo» sin firmas y queda registrado quién lo reabrió. ¿Continuar?"
        >
          <input type="hidden" name="match_id" value={m.id} />
        </ActionForm>
      )}
    </div>
  );
}
