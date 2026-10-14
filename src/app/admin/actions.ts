"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseRoster } from "@/lib/admin/csv";
import { getSession, isStaff, serverClient } from "@/lib/insforge/server";
import { ROSTER_LIMITS, RULE_PRESETS, SPORT_POSITIONS, type RulePresetId, type Sport } from "@/lib/scoresheet/rules";
import { CATEGORIES, type Category, validateCategoryAge } from "@/lib/tournament/categories";
import { validateCedula } from "@/lib/tournament/cedula";
import { semifinalPairs } from "@/lib/tournament/knockout";
import { buildSchedule } from "@/lib/tournament/scheduler";
import { STANDINGS_PRESETS, computeStandings, standingsConfig, type StandingsPresetId } from "@/lib/tournament/standings";
import type { Match, Player, Referee, Role, Team, Tournament, TournamentTeam } from "@/lib/types";

export type ActionState = { error: string | null; ok?: string | null; details?: string[] };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function staffClient() {
  const s = await getSession();
  if (!isStaff(s)) throw new Error("Solo organizadores y administradores.");
  return serverClient();
}
async function staffDb() {
  return (await staffClient()).database;
}
async function adminDb() {
  const s = await getSession();
  if (s?.profile?.role !== "admin") throw new Error("Solo administradores.");
  return (await serverClient()).database;
}

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const optional = (f: FormData, k: string) => str(f, k) || null;
const id = (f: FormData, k: string) => {
  const v = str(f, k);
  if (!UUID.test(v)) throw new Error("Identificador inválido.");
  return v;
};
/** `datetime-local` en hora de Ecuador (UTC-5) → ISO. */
const ectToIso = (local: string) => (local ? new Date(`${local}:00-05:00`).toISOString() : null);

function friendly(msg: string) {
  if (/duplicate|unique/i.test(msg)) return "Ya existe un registro con esos datos.";
  if (/foreign key|violates.*constraint.*_fkey/i.test(msg)) return "No se puede eliminar: tiene datos relacionados (partidos, jugadores o inscripciones).";
  if (/row-level security/i.test(msg)) return "No tienes permiso para esta acción.";
  return msg;
}
const fail = (e: unknown): ActionState => ({ error: friendly(e instanceof Error ? e.message : String(e)) });

async function must<T>(p: PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return data as T;
}

const revalidateTournament = (tid: string) => {
  revalidatePath(`/admin/torneos/${tid}`);
  revalidatePath(`/torneos/${tid}`);
  revalidatePath("/");
};

// ---------- Imágenes (InsForge Storage, bucket `media`: se guardan url y key) ----------
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

async function uploadImage(f: FormData, field: string, folder: string): Promise<{ url: string; key: string } | null> {
  const file = f.get(field);
  if (!(file instanceof File) || file.size === 0) return null;
  if (!file.type.startsWith("image/")) throw new Error("El archivo debe ser una imagen.");
  if (file.size > MAX_IMAGE_BYTES) throw new Error("La imagen supera 5 MB.");
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  const client = await staffClient();
  const { data, error } = await client.storage.from("media").upload(`${folder}/${crypto.randomUUID()}.${ext}`, file);
  if (error || !data) throw new Error(error?.message ?? "No se pudo subir la imagen.");
  return { url: data.url, key: data.key };
}

async function removeImage(key: string | null | undefined) {
  if (!key) return;
  const client = await staffClient();
  await client.storage.from("media").remove(key);
}

// ---------- Torneos ----------
function tournamentFields(f: FormData) {
  const category = str(f, "category");
  if (!CATEGORIES.includes(category as Category)) throw new Error("Categoría inválida.");
  const name = str(f, "name");
  if (!name) throw new Error("El torneo necesita un nombre.");
  const color = str(f, "color");
  return {
    name,
    season: Number(str(f, "season")),
    category,
    branch: str(f, "branch"),
    city: optional(f, "city"),
    format: str(f, "format"),
    color: /^#[0-9a-f]{6}$/i.test(color) ? color : null,
  };
}

function presetFields(f: FormData) {
  const preset = RULE_PRESETS[str(f, "preset") as RulePresetId];
  if (!preset) throw new Error("Reglamento inválido.");
  return {
    best_of: preset.bestOf,
    sport: preset.sport as Sport,
    rules: Object.keys(preset.overrides).length ? preset.overrides : null,
  };
}

function standingsFields(f: FormData) {
  const p = STANDINGS_PRESETS[str(f, "standings") as StandingsPresetId];
  return { standings: p ? p.config : null };
}

export async function createTournament(_: ActionState, f: FormData): Promise<ActionState> {
  let tid: string;
  try {
    const db = await staffDb();
    const [t] = await must<{ id: string }[]>(
      db
        .from("tournaments")
        .insert([{ ...tournamentFields(f), ...presetFields(f), ...standingsFields(f), status: "draft" }])
        .select("id"),
    );
    tid = t.id;
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/admin/torneos");
  redirect(`/admin/torneos/${tid}`);
}

export interface WizardPayload {
  name: string;
  season: number;
  category: string;
  branch: string;
  city: string;
  format: "round_robin" | "groups_knockout";
  preset: RulePresetId;
  standings: StandingsPresetId;
  color: string;
  teamIds: string[];
  groups: number;
  startDate: string;
  venueId: string;
  publish: boolean;
}

/** Asistente: crea el torneo, inscribe equipos y (si hay fecha) genera el calendario. */
export async function createTournamentWizard(p: WizardPayload): Promise<ActionState & { id?: string }> {
  try {
    const db = await staffDb();
    const f = new FormData();
    for (const [k, v] of Object.entries(p)) if (typeof v !== "object") f.set(k, String(v));
    const [t] = await must<{ id: string }[]>(
      db
        .from("tournaments")
        .insert([{ ...tournamentFields(f), ...presetFields(f), ...standingsFields(f), status: p.publish ? "active" : "draft" }])
        .select("id"),
    );
    const teamIds = p.teamIds.filter((x) => UUID.test(x));
    if (teamIds.length) await must(db.rpc("set_entries", { p_tournament: t.id, p_team_ids: teamIds }));
    let msg = `Torneo creado con ${teamIds.length} equipos.`;
    if (p.startDate && teamIds.length >= 2) {
      const startMs = new Date(`${p.startDate}T09:00:00-05:00`).getTime();
      if (Number.isNaN(startMs)) throw new Error("Fecha de inicio inválida.");
      const { groups, matches } = buildSchedule({
        teamIds,
        groupCount: p.format === "groups_knockout" ? p.groups : 1,
        startMs,
        venueId: UUID.test(p.venueId) ? p.venueId : null,
      });
      const n = await must<number>(db.rpc("replace_schedule", { p_tournament: t.id, p_groups: groups, p_matches: matches }));
      msg += ` Calendario: ${n} partidos.`;
    }
    revalidatePath("/admin/torneos");
    revalidatePath("/");
    return { error: null, ok: msg, id: t.id };
  } catch (e) {
    return fail(e);
  }
}

export async function updateTournament(_: ActionState, f: FormData): Promise<ActionState> {
  try {
    const db = await staffDb();
    const tid = id(f, "tournament_id");
    const [current, played, entries] = await Promise.all([
      must<Tournament>(db.from("tournaments").select("*").eq("id", tid).single()),
      must<{ id: string }[]>(db.from("matches").select("id").eq("tournament_id", tid).neq("status", "scheduled").limit(1)),
      must<{ team_id: string }[]>(db.from("tournament_teams").select("team_id").eq("tournament_id", tid).limit(1)),
    ]);
    const patch: Record<string, unknown> = { ...tournamentFields(f), ...standingsFields(f) };
    const preset = presetFields(f);
    const rulesChanged =
      preset.sport !== current.sport || preset.best_of !== current.best_of || JSON.stringify(preset.rules) !== JSON.stringify(current.rules ?? null);
    if (rulesChanged) {
      if (played.length) throw new Error("Ya hay partidos jugados: el reglamento no se puede cambiar.");
      if (preset.sport !== current.sport && entries.length) throw new Error("Quita los equipos inscritos antes de cambiar de deporte.");
      Object.assign(patch, preset);
    }
    if (played.length && patch.format !== current.format) throw new Error("Ya hay partidos jugados: el formato no se puede cambiar.");
    await must(db.from("tournaments").update(patch).eq("id", tid));
    revalidateTournament(tid);
    return { error: null, ok: "Torneo actualizado." };
  } catch (e) {
    return fail(e);
  }
}

export async function uploadTournamentCover(_: ActionState, f: FormData): Promise<ActionState> {
  try {
    const db = await staffDb();
    const tid = id(f, "tournament_id");
    const current = await must<Tournament>(db.from("tournaments").select("*").eq("id", tid).single());
    if (f.get("remove") === "1") {
      await must(db.from("tournaments").update({ cover_url: null, cover_key: null }).eq("id", tid));
      await removeImage(current.cover_key);
    } else {
      const img = await uploadImage(f, "file", `tournaments/${tid}`);
      if (!img) throw new Error("Elige una imagen.");
      await must(db.from("tournaments").update({ cover_url: img.url, cover_key: img.key }).eq("id", tid));
      await removeImage(current.cover_key);
    }
    revalidateTournament(tid);
    return { error: null, ok: "Portada actualizada." };
  } catch (e) {
    return fail(e);
  }
}

export async function setTournamentStatus(tid: string, status: Tournament["status"]) {
  const db = await staffDb();
  await must(db.from("tournaments").update({ status }).eq("id", tid));
  revalidateTournament(tid);
}

export async function deleteTournament(_: ActionState, f: FormData): Promise<ActionState> {
  try {
    const db = await staffDb();
    const tid = id(f, "tournament_id");
    const played = await must<{ id: string }[]>(db.from("matches").select("id").eq("tournament_id", tid).neq("status", "scheduled").limit(1));
    if (played.length) throw new Error("El torneo tiene partidos jugados: márcalo como finalizado en lugar de eliminarlo.");
    await must(db.from("tournaments").delete().eq("id", tid));
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/admin/torneos");
  revalidatePath("/");
  redirect("/admin/torneos");
}

/** Inscripción atómica (función SQL `set_entries`). */
export async function setEntries(tournamentId: string, teamIds: string[]): Promise<ActionState> {
  try {
    const db = await staffDb();
    await must(db.rpc("set_entries", { p_tournament: tournamentId, p_team_ids: teamIds.filter((x) => UUID.test(x)) }));
    revalidateTournament(tournamentId);
    return { error: null, ok: "Inscripción guardada." };
  } catch (e) {
    return fail(e);
  }
}

/** Genera el calendario y lo reemplaza en una sola transacción (función SQL `replace_schedule`). */
export async function generateSchedule(_: ActionState, f: FormData): Promise<ActionState> {
  const tournamentId = str(f, "tournament_id");
  try {
    const db = await staffDb();
    const t = await must<Tournament>(db.from("tournaments").select("*").eq("id", tournamentId).single());
    const entries = await must<TournamentTeam[]>(db.from("tournament_teams").select("*").eq("tournament_id", tournamentId).order("seed"));
    if (entries.length < 2) throw new Error("Inscribe al menos 2 equipos.");
    const startMs = new Date(`${str(f, "start_date")}T${str(f, "start_time") || "09:00"}:00-05:00`).getTime();
    if (Number.isNaN(startMs)) throw new Error("Fecha de inicio inválida.");
    const venueId = str(f, "venue_id");
    const { groups, matches } = buildSchedule({
      teamIds: entries.map((e) => e.team_id),
      groupCount: t.format === "groups_knockout" ? Math.max(1, Number(str(f, "groups") || 2)) : 1,
      startMs,
      venueId: UUID.test(venueId) ? venueId : null,
      daysBetweenRounds: Number(str(f, "days_between") || 7),
      slotHours: Number(str(f, "slot_hours") || 2),
    });
    const n = await must<number>(db.rpc("replace_schedule", { p_tournament: tournamentId, p_groups: groups, p_matches: matches }));
    revalidateTournament(tournamentId);
    return { error: null, ok: `Calendario generado: ${n} partidos.` };
  } catch (e) {
    return fail(e);
  }
}

/** Crea semifinales según los grupos (1 a N) o la final y el tercer lugar. */
export async function generateKnockout(_: ActionState, f: FormData): Promise<ActionState> {
  const tournamentId = str(f, "tournament_id");
  try {
    const db = await staffDb();
    const t = await must<Tournament>(db.from("tournaments").select("*").eq("id", tournamentId).single());
    const matches = await must<Match[]>(db.from("matches").select("*").eq("tournament_id", tournamentId));
    const entries = await must<TournamentTeam[]>(db.from("tournament_teams").select("*").eq("tournament_id", tournamentId));
    const semis = matches.filter((m) => m.stage === "semifinal");
    const when = ectToIso(str(f, "scheduled_at")) ?? new Date(Date.now() + 7 * 86400_000).toISOString();

    if (!semis.length) {
      const phase = matches.filter((m) => m.stage === "group" || m.stage === "league");
      if (!phase.length || phase.some((m) => m.status !== "finished")) throw new Error("La fase de grupos aún no termina.");
      const labels = [...new Set(entries.map((e) => e.group_label ?? "Única"))];
      const config = standingsConfig(t.standings);
      const rankings = labels.map((g) => ({
        group: g,
        rows: computeStandings(
          entries.filter((e) => (e.group_label ?? "Única") === g).map((e) => e.team_id),
          phase.filter((m) => (m.group_label ?? "Única") === g).map((m) => ({ home: m.home_team_id, away: m.away_team_id, sets: m.result!.sets, bestOf: t.best_of })),
          config,
        ),
      }));
      const pairs = semifinalPairs(rankings);
      await must(
        db.from("matches").insert(
          pairs.map(([home, away]) => ({ tournament_id: tournamentId, stage: "semifinal", round: 1, home_team_id: home, away_team_id: away, scheduled_at: when })),
        ),
      );
      revalidateTournament(tournamentId);
      return { error: null, ok: "Semifinales creadas." };
    }
    if (semis.some((m) => m.status !== "finished")) throw new Error("Las semifinales aún no terminan.");
    if (matches.some((m) => m.stage === "final")) throw new Error("La final ya existe.");
    const winners = semis.map((m) => m.winner_team_id!);
    const losers = semis.map((m) => (m.winner_team_id === m.home_team_id ? m.away_team_id : m.home_team_id));
    await must(
      db.from("matches").insert([
        { tournament_id: tournamentId, stage: "third_place", round: 2, home_team_id: losers[0], away_team_id: losers[1], scheduled_at: when },
        { tournament_id: tournamentId, stage: "final", round: 2, home_team_id: winners[0], away_team_id: winners[1], scheduled_at: when },
      ]),
    );
    revalidateTournament(tournamentId);
    return { error: null, ok: "Final y tercer lugar creados." };
  } catch (e) {
    return fail(e);
  }
}

// ---------- Partidos ----------
export async function updateMatch(_: ActionState, f: FormData): Promise<ActionState> {
  try {
    const db = await staffDb();
    await must(
      db
        .from("matches")
        .update({
          scorer_id: optional(f, "scorer_id"),
          referee_1: optional(f, "referee_1"),
          referee_2: optional(f, "referee_2"),
          venue_id: optional(f, "venue_id"),
          scheduled_at: ectToIso(str(f, "scheduled_at")),
        })
        .eq("id", id(f, "match_id")),
    );
    revalidateTournament(str(f, "tournament_id"));
    return { error: null, ok: "Guardado" };
  } catch (e) {
    return fail(e);
  }
}

export async function createMatch(_: ActionState, f: FormData): Promise<ActionState> {
  try {
    const db = await staffDb();
    const tid = id(f, "tournament_id");
    const home = id(f, "home_team_id");
    const away = id(f, "away_team_id");
    if (home === away) throw new Error("Elige dos equipos distintos.");
    await must(
      db.from("matches").insert([
        {
          tournament_id: tid,
          stage: str(f, "stage") || "league",
          group_label: optional(f, "group_label"),
          round: Number(str(f, "round")) || null,
          home_team_id: home,
          away_team_id: away,
          venue_id: optional(f, "venue_id"),
          scheduled_at: ectToIso(str(f, "scheduled_at")),
        },
      ]),
    );
    revalidateTournament(tid);
    return { error: null, ok: "Partido creado." };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteMatch(_: ActionState, f: FormData): Promise<ActionState> {
  try {
    const db = await staffDb();
    const mid = id(f, "match_id");
    const m = await must<Match>(db.from("matches").select("*").eq("id", mid).single());
    if (m.status !== "scheduled") throw new Error("Solo se eliminan partidos que no han empezado.");
    await must(db.from("matches").delete().eq("id", mid));
    revalidateTournament(m.tournament_id);
    return { error: null, ok: "Partido eliminado." };
  } catch (e) {
    return fail(e);
  }
}

/** Reprogramación desde el calendario visual (arrastrar y soltar). */
export async function rescheduleMatch(matchId: string, scheduledAt: string, venueId?: string | null): Promise<ActionState> {
  try {
    if (!UUID.test(matchId) || Number.isNaN(Date.parse(scheduledAt))) throw new Error("Datos inválidos.");
    const db = await staffDb();
    const patch: Record<string, unknown> = { scheduled_at: new Date(scheduledAt).toISOString() };
    if (venueId !== undefined) patch.venue_id = venueId && UUID.test(venueId) ? venueId : null;
    const [m] = await must<Match[]>(db.from("matches").update(patch).eq("id", matchId).eq("status", "scheduled").select("*"));
    if (!m) throw new Error("Solo se reprograman partidos que no han empezado.");
    revalidateTournament(m.tournament_id);
    revalidatePath("/admin/partidos");
    return { error: null, ok: "Partido reprogramado." };
  } catch (e) {
    return fail(e);
  }
}

/**
 * Reabre un partido cerrado para corregir la planilla: vuelve a "en vivo" y agrega un evento `reopen`
 * (queda registrado quién y cuándo). Después la mesa corrige con "deshacer" y vuelve a cerrar.
 */
export async function reopenMatch(_: ActionState, f: FormData): Promise<ActionState> {
  try {
    const db = await staffDb();
    const mid = id(f, "match_id");
    const m = await must<Match>(db.from("matches").select("*").eq("id", mid).single());
    if (m.status !== "finished") throw new Error("El partido no está cerrado.");
    const last = await must<{ seq: number }[]>(db.from("match_events").select("seq").eq("match_id", mid).order("seq", { ascending: false }).limit(1));
    await must(db.from("matches").update({ status: "live" }).eq("id", mid));
    await must(db.from("match_events").insert([{ match_id: mid, seq: (last[0]?.seq ?? 0) + 1, type: "reopen", payload: {}, client_ts: new Date().toISOString() }]));
    revalidateTournament(m.tournament_id);
    return { error: null, ok: "Partido reabierto: corrige la planilla en la mesa y vuelve a cerrarla." };
  } catch (e) {
    return fail(e);
  }
}

/** Asigna árbitros activos a los partidos programados de una jornada, rotando la lista. */
export async function assignReferees(_: ActionState, f: FormData): Promise<ActionState> {
  try {
    const db = await staffDb();
    const tid = id(f, "tournament_id");
    const round = Number(str(f, "round"));
    const refs = await must<Referee[]>(db.from("referees").select("*").eq("active", true).order("name"));
    if (refs.length < 2) throw new Error("Registra al menos 2 árbitros activos.");
    let q = db.from("matches").select("*").eq("tournament_id", tid).eq("status", "scheduled").order("scheduled_at");
    if (round) q = q.eq("round", round);
    const ms = await must<Match[]>(q);
    if (!ms.length) throw new Error("No hay partidos programados en esa jornada.");
    for (const [i, m] of ms.entries()) {
      const r1 = refs[(i * 2) % refs.length];
      const r2 = refs[(i * 2 + 1) % refs.length];
      await must(db.from("matches").update({ referee_1: r1.name, referee_2: r2.id === r1.id ? null : r2.name }).eq("id", m.id));
    }
    revalidateTournament(tid);
    return { error: null, ok: `Árbitros asignados a ${ms.length} partidos.` };
  } catch (e) {
    return fail(e);
  }
}

// ---------- Equipos ----------
function teamFields(f: FormData) {
  const name = str(f, "name");
  const short = str(f, "short_name");
  if (!name || !short) throw new Error("Nombre y nombre corto son obligatorios.");
  const c1 = str(f, "color_primary");
  const c2 = str(f, "color_secondary");
  return {
    name,
    short_name: short,
    city: optional(f, "city"),
    province: optional(f, "province"),
    color_primary: /^#[0-9a-f]{6}$/i.test(c1) ? c1 : "#1d4ed8",
    color_secondary: /^#[0-9a-f]{6}$/i.test(c2) ? c2 : "#ffffff",
    organization_id: optional(f, "organization_id"),
  };
}

export async function createTeam(_: ActionState, f: FormData): Promise<ActionState> {
  try {
    const db = await staffDb();
    await must(db.from("teams").insert([{ ...teamFields(f), sport: str(f, "sport") === "ecuavoley" ? "ecuavoley" : "voley" }]));
    revalidatePath("/admin/equipos");
    return { error: null, ok: "Equipo creado." };
  } catch (e) {
    return fail(e);
  }
}

export async function updateTeam(_: ActionState, f: FormData): Promise<ActionState> {
  try {
    const db = await staffDb();
    const tid = id(f, "team_id");
    await must(db.from("teams").update(teamFields(f)).eq("id", tid));
    revalidatePath(`/admin/equipos/${tid}`);
    revalidatePath(`/equipos/${tid}`);
    return { error: null, ok: "Equipo actualizado." };
  } catch (e) {
    return fail(e);
  }
}

export async function uploadTeamImage(_: ActionState, f: FormData): Promise<ActionState> {
  try {
    const db = await staffDb();
    const tid = id(f, "team_id");
    const kind = str(f, "kind") === "cover" ? "cover" : "logo";
    const team = await must<Team>(db.from("teams").select("*").eq("id", tid).single());
    const oldKey = kind === "cover" ? team.cover_key : team.logo_key;
    if (f.get("remove") === "1") {
      await must(db.from("teams").update(kind === "cover" ? { cover_url: null, cover_key: null } : { logo_url: null, logo_key: null }).eq("id", tid));
    } else {
      const img = await uploadImage(f, "file", `teams/${tid}`);
      if (!img) throw new Error("Elige una imagen.");
      await must(
        db.from("teams").update(kind === "cover" ? { cover_url: img.url, cover_key: img.key } : { logo_url: img.url, logo_key: img.key }).eq("id", tid),
      );
    }
    await removeImage(oldKey);
    revalidatePath(`/admin/equipos/${tid}`);
    revalidatePath(`/equipos/${tid}`);
    return { error: null, ok: kind === "cover" ? "Portada actualizada." : "Logo actualizado." };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteTeam(_: ActionState, f: FormData): Promise<ActionState> {
  try {
    const db = await staffDb();
    const tid = id(f, "team_id");
    const ms = await must<{ id: string }[]>(db.from("matches").select("id").or(`home_team_id.eq.${tid},away_team_id.eq.${tid}`).limit(1));
    if (ms.length) throw new Error("El equipo tiene partidos: no se puede eliminar.");
    const team = await must<Team>(db.from("teams").select("*").eq("id", tid).single());
    await must(db.from("teams").delete().eq("id", tid));
    await removeImage(team.logo_key);
    await removeImage(team.cover_key);
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/admin/equipos");
  redirect("/admin/equipos");
}

// ---------- Jugadores ----------
async function playerFields(f: FormData, sport: Sport) {
  const cedula = str(f, "cedula").replace(/\D/g, "");
  const cedErr = validateCedula(cedula);
  if (cedErr) throw new Error(`Cédula: ${cedErr}`);
  const birth = str(f, "birth_date");
  const category = str(f, "category");
  if (category) {
    const ageErr = validateCategoryAge(category as Category, birth, Number(str(f, "season") || new Date().getFullYear()));
    if (ageErr) throw new Error(ageErr);
  }
  const isLibero = f.get("is_libero") === "on" && ROSTER_LIMITS[sport].liberos > 0;
  const position = str(f, "position");
  return {
    first_name: str(f, "first_name"),
    last_name: str(f, "last_name"),
    cedula,
    birth_date: birth,
    number: Number(str(f, "number")),
    position: isLibero ? "libero" : SPORT_POSITIONS[sport].includes(position) ? position : null,
    is_libero: isLibero,
    is_captain: f.get("is_captain") === "on",
  };
}

async function teamSport(db: Awaited<ReturnType<typeof staffDb>>, teamId: string): Promise<Sport> {
  const t = await must<Team>(db.from("teams").select("*").eq("id", teamId).single());
  return t.sport ?? "voley";
}

export async function createPlayer(_: ActionState, f: FormData): Promise<ActionState> {
  try {
    const db = await staffDb();
    const teamId = id(f, "team_id");
    await must(db.from("players").insert([{ team_id: teamId, ...(await playerFields(f, await teamSport(db, teamId))) }]));
    revalidatePath(`/admin/equipos/${teamId}`);
    revalidatePath(`/equipos/${teamId}`);
    return { error: null, ok: "Jugador(a) registrado(a)." };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/duplicate|unique/i.test(msg)) return { error: "Ya existe esa cédula o ese número de camiseta en el equipo." };
    return fail(e);
  }
}

export async function updatePlayer(_: ActionState, f: FormData): Promise<ActionState> {
  try {
    const db = await staffDb();
    const pid = id(f, "player_id");
    const teamId = id(f, "team_id");
    const sport = await teamSport(db, teamId);
    const patch = { team_id: teamId, ...(await playerFields(f, sport)) };
    await must(db.from("players").update(patch).eq("id", pid));
    const img = await uploadImage(f, "photo", `players/${pid}`);
    if (img) {
      const old = await must<Player>(db.from("players").select("*").eq("id", pid).single());
      await must(db.from("players").update({ photo_url: img.url, photo_key: img.key }).eq("id", pid));
      if (old.photo_key && old.photo_key !== img.key) await removeImage(old.photo_key);
    }
    revalidatePath(`/admin/equipos/${str(f, "from_team_id") || teamId}`);
    revalidatePath(`/admin/equipos/${teamId}`);
    revalidatePath(`/jugadores/${pid}`);
    return { error: null, ok: "Jugador(a) actualizado(a)." };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/duplicate|unique/i.test(msg)) return { error: "Ya existe esa cédula o ese número de camiseta en el equipo." };
    return fail(e);
  }
}

export async function deletePlayer(teamId: string, playerId: string) {
  const db = await staffDb();
  const p = await must<Player>(db.from("players").select("*").eq("id", playerId).single());
  await must(db.from("players").delete().eq("id", playerId));
  await removeImage(p.photo_key);
  revalidatePath(`/admin/equipos/${teamId}`);
}

/** Importa una nómina desde CSV: valida todas las filas y solo inserta las correctas. */
export async function importRoster(_: ActionState, f: FormData): Promise<ActionState> {
  try {
    const db = await staffDb();
    const teamId = id(f, "team_id");
    const file = f.get("file");
    const text = file instanceof File && file.size ? await file.text() : str(f, "csv");
    if (!text) throw new Error("Pega el CSV o elige un archivo.");
    const sport = await teamSport(db, teamId);
    const existing = await must<Player[]>(db.from("players").select("*").eq("team_id", teamId));
    const category = str(f, "category");
    const { rows, errors } = parseRoster(text, {
      positions: SPORT_POSITIONS[sport],
      allowLibero: ROSTER_LIMITS[sport].liberos > 0,
      existingNumbers: existing.map((p) => p.number),
      category: CATEGORIES.includes(category as Category) ? (category as Category) : undefined,
      season: Number(str(f, "season")) || new Date().getFullYear(),
    });
    const room = ROSTER_LIMITS[sport].players - existing.length;
    if (rows.length > room) throw new Error(`La nómina admite ${ROSTER_LIMITS[sport].players} jugadores: solo caben ${Math.max(0, room)} más.`);
    const details = errors.map((e) => (e.line ? `Fila ${e.line}: ${e.message}` : e.message));
    let inserted = 0;
    for (const r of rows) {
      const { error } = await db.from("players").insert([{ team_id: teamId, ...r }]);
      if (error) details.push(`${r.first_name} ${r.last_name}: ${friendly(error.message)}`);
      else inserted += 1;
    }
    revalidatePath(`/admin/equipos/${teamId}`);
    revalidatePath(`/equipos/${teamId}`);
    return { error: inserted ? null : "No se importó ninguna fila.", ok: inserted ? `${inserted} jugadores importados.` : null, details };
  } catch (e) {
    return fail(e);
  }
}

// ---------- Sedes, organizaciones y árbitros ----------
export async function saveVenue(_: ActionState, f: FormData): Promise<ActionState> {
  try {
    const db = await staffDb();
    const row = { name: str(f, "name"), city: str(f, "city"), province: str(f, "province") };
    if (!row.name || !row.city || !row.province) throw new Error("Nombre, ciudad y provincia son obligatorios.");
    const vid = str(f, "venue_id");
    if (vid) await must(db.from("venues").update(row).eq("id", id(f, "venue_id")));
    else await must(db.from("venues").insert([row]));
    revalidatePath("/admin/sedes");
    return { error: null, ok: vid ? "Sede actualizada." : "Sede creada." };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteVenue(_: ActionState, f: FormData): Promise<ActionState> {
  try {
    const db = await staffDb();
    await must(db.from("venues").delete().eq("id", id(f, "venue_id")));
    revalidatePath("/admin/sedes");
    return { error: null, ok: "Sede eliminada." };
  } catch (e) {
    return fail(e);
  }
}

export async function saveOrganization(_: ActionState, f: FormData): Promise<ActionState> {
  try {
    const db = await staffDb();
    const kind = str(f, "kind");
    const row = {
      name: str(f, "name"),
      short_name: optional(f, "short_name"),
      kind: ["federation", "association", "league"].includes(kind) ? kind : "association",
      province: optional(f, "province"),
    };
    if (!row.name) throw new Error("El nombre es obligatorio.");
    const oid = str(f, "organization_id");
    if (oid) await must(db.from("organizations").update(row).eq("id", id(f, "organization_id")));
    else await must(db.from("organizations").insert([row]));
    revalidatePath("/admin/organizaciones");
    return { error: null, ok: oid ? "Organización actualizada." : "Organización creada." };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteOrganization(_: ActionState, f: FormData): Promise<ActionState> {
  try {
    const db = await staffDb();
    await must(db.from("organizations").delete().eq("id", id(f, "organization_id")));
    revalidatePath("/admin/organizaciones");
    return { error: null, ok: "Organización eliminada." };
  } catch (e) {
    return fail(e);
  }
}

export async function saveReferee(_: ActionState, f: FormData): Promise<ActionState> {
  try {
    const db = await staffDb();
    const level = str(f, "level");
    const row = {
      name: str(f, "name"),
      phone: optional(f, "phone"),
      email: optional(f, "email"),
      city: optional(f, "city"),
      level: ["provincial", "nacional", "internacional", "parroquial"].includes(level) ? level : null,
      active: f.get("active") !== "off",
    };
    if (!row.name) throw new Error("El nombre es obligatorio.");
    const rid = str(f, "referee_id");
    if (rid) await must(db.from("referees").update(row).eq("id", id(f, "referee_id")));
    else await must(db.from("referees").insert([row]));
    revalidatePath("/admin/arbitros");
    return { error: null, ok: rid ? "Árbitro actualizado." : "Árbitro registrado." };
  } catch (e) {
    return fail(e);
  }
}

export async function toggleReferee(refereeId: string, active: boolean) {
  const db = await staffDb();
  await must(db.from("referees").update({ active }).eq("id", refereeId));
  revalidatePath("/admin/arbitros");
}

// ---------- Usuarios ----------
export async function setRole(userId: string, role: Role) {
  const db = await adminDb();
  await must(db.from("profiles").update({ role }).eq("user_id", userId));
  revalidatePath("/admin/usuarios");
}

/** Invita por correo: si la cuenta existe se le asigna el rol; si no, se aplica al registrarse. */
export async function inviteUser(_: ActionState, f: FormData): Promise<ActionState> {
  try {
    const db = await adminDb();
    const email = str(f, "email").toLowerCase();
    const role = str(f, "role") as Role;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Correo inválido.");
    if (!["admin", "organizer", "scorer", "referee", "viewer"].includes(role)) throw new Error("Rol inválido.");
    const existing = await must<{ user_id: string }[]>(db.from("profiles").select("user_id").ilike("email", email).limit(1));
    if (existing.length) {
      await must(db.from("profiles").update({ role }).eq("user_id", existing[0].user_id));
      revalidatePath("/admin/usuarios");
      return { error: null, ok: "La cuenta ya existía: rol asignado." };
    }
    await must(db.from("role_invites").upsert([{ email, role }]));
    revalidatePath("/admin/usuarios");
    return { error: null, ok: `Invitación guardada: ${email} tendrá ese rol al crear su cuenta.` };
  } catch (e) {
    return fail(e);
  }
}

export async function revokeInvite(email: string) {
  const db = await adminDb();
  await must(db.from("role_invites").delete().eq("email", email));
  revalidatePath("/admin/usuarios");
}

// ---------- Búsqueda global ----------
export interface SearchResult {
  kind: "Torneo" | "Equipo" | "Jugador" | "Árbitro" | "Sede";
  label: string;
  sub: string;
  href: string;
}

export async function searchAdmin(query: string): Promise<SearchResult[]> {
  const q = query.trim().replace(/[%,()*]/g, " ").slice(0, 60);
  if (q.length < 2) return [];
  const db = await staffDb();
  const like = `%${q}%`;
  const [tournaments, teams, players, referees, venues] = await Promise.all([
    db.from("tournaments").select("id, name, season, category").ilike("name", like).limit(5),
    db.from("teams").select("id, name, short_name, city").or(`name.ilike.${like},short_name.ilike.${like}`).limit(5),
    db.from("players").select("id, team_id, first_name, last_name, number, cedula").or(`first_name.ilike.${like},last_name.ilike.${like},cedula.ilike.${like}`).limit(6),
    db.from("referees").select("id, name, city").ilike("name", like).limit(4),
    db.from("venues").select("id, name, city").ilike("name", like).limit(4),
  ]);
  const out: SearchResult[] = [];
  for (const t of (tournaments.data ?? []) as Tournament[]) out.push({ kind: "Torneo", label: t.name, sub: `${t.category} · ${t.season}`, href: `/admin/torneos/${t.id}` });
  for (const t of (teams.data ?? []) as Team[]) out.push({ kind: "Equipo", label: t.name, sub: t.city ?? t.short_name, href: `/admin/equipos/${t.id}` });
  for (const p of (players.data ?? []) as Player[])
    out.push({ kind: "Jugador", label: `${p.first_name} ${p.last_name}`, sub: `N.º ${p.number} · ${p.cedula}`, href: `/admin/equipos/${p.team_id}#p-${p.id}` });
  for (const r of (referees.data ?? []) as Referee[]) out.push({ kind: "Árbitro", label: r.name, sub: r.city ?? "", href: `/admin/arbitros#r-${r.id}` });
  for (const v of (venues.data ?? []) as { id: string; name: string; city: string }[]) out.push({ kind: "Sede", label: v.name, sub: v.city, href: `/admin/sedes#v-${v.id}` });
  return out;
}
