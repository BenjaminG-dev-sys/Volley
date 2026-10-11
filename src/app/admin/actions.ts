"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession, isStaff, serverClient } from "@/lib/insforge/server";
import { CATEGORIES, type Category, validateCategoryAge } from "@/lib/tournament/categories";
import { validateCedula } from "@/lib/tournament/cedula";
import { crossSemis, groupLabel, roundRobin, snakeGroups } from "@/lib/tournament/scheduler";
import { computeStandings } from "@/lib/tournament/standings";
import type { Match, Role, Tournament, TournamentTeam } from "@/lib/types";

export type ActionState = { error: string | null; ok?: string | null };

async function staffDb() {
  const s = await getSession();
  if (!isStaff(s)) throw new Error("Solo organizadores y administradores.");
  return (await serverClient()).database;
}

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const fail = (e: unknown): ActionState => ({ error: e instanceof Error ? e.message : String(e) });

async function must<T>(p: PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return data as T;
}

// ---------- Torneos ----------
export async function createTournament(_: ActionState, f: FormData): Promise<ActionState> {
  let id: string;
  try {
    const db = await staffDb();
    const category = str(f, "category");
    if (!CATEGORIES.includes(category as Category)) throw new Error("Categoría inválida.");
    const [t] = await must<{ id: string }[]>(
      db.from("tournaments").insert([{
        name: str(f, "name"),
        season: Number(str(f, "season")),
        category,
        branch: str(f, "branch"),
        city: str(f, "city") || null,
        format: str(f, "format"),
        best_of: Number(str(f, "best_of")),
        status: "draft",
      }]).select("id"),
    );
    id = t.id;
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/admin");
  redirect(`/admin/torneos/${id}`);
}

export async function setTournamentStatus(id: string, status: Tournament["status"]) {
  const db = await staffDb();
  await must(db.from("tournaments").update({ status }).eq("id", id));
  revalidatePath(`/admin/torneos/${id}`);
  revalidatePath("/");
}

export async function setEntries(tournamentId: string, teamIds: string[]) {
  const db = await staffDb();
  await must(db.from("tournament_teams").delete().eq("tournament_id", tournamentId));
  if (teamIds.length)
    await must(db.from("tournament_teams").insert(teamIds.map((team_id, i) => ({ tournament_id: tournamentId, team_id, seed: i + 1 }))));
  revalidatePath(`/admin/torneos/${tournamentId}`);
}

/** Genera el calendario: todos contra todos o fase de grupos (serpentina). Reemplaza los partidos programados. */
export async function generateSchedule(_: ActionState, f: FormData): Promise<ActionState> {
  const tournamentId = str(f, "tournament_id");
  try {
    const db = await staffDb();
    const t = await must<Tournament>(db.from("tournaments").select("*").eq("id", tournamentId).single());
    const entries = await must<TournamentTeam[]>(db.from("tournament_teams").select("*").eq("tournament_id", tournamentId).order("seed"));
    if (entries.length < 2) throw new Error("Inscribe al menos 2 equipos.");
    const played = await must<{ id: string }[]>(db.from("matches").select("id").eq("tournament_id", tournamentId).neq("status", "scheduled"));
    if (played.length) throw new Error("Ya hay partidos jugados; el calendario no se puede regenerar.");

    const groupCount = t.format === "groups_knockout" ? Math.max(1, Number(str(f, "groups") || 2)) : 1;
    const groups = snakeGroups(entries.map((e) => e.team_id), groupCount);
    const start = new Date(`${str(f, "start_date")}T09:00:00-05:00`).getTime();
    if (Number.isNaN(start)) throw new Error("Fecha de inicio inválida.");
    const venueId = str(f, "venue_id") || null;

    await must(db.from("matches").delete().eq("tournament_id", tournamentId).eq("status", "scheduled"));
    for (const [gi, g] of groups.entries()) {
      for (const team_id of g)
        await must(db.from("tournament_teams").update({ group_label: groupCount > 1 ? groupLabel(gi) : null }).eq("tournament_id", tournamentId).eq("team_id", team_id));
    }
    const slots = new Map<number, number>();
    const rows = groups.flatMap((g, gi) =>
      roundRobin(g).map((fx) => {
        const slot = slots.get(fx.round) ?? 0;
        slots.set(fx.round, slot + 1);
        return {
          tournament_id: tournamentId,
          stage: groupCount > 1 ? "group" : "league",
          group_label: groupCount > 1 ? groupLabel(gi) : null,
          round: fx.round,
          home_team_id: fx.home,
          away_team_id: fx.away,
          venue_id: venueId,
          scheduled_at: new Date(start + (fx.round - 1) * 7 * 86400_000 + slot * 2 * 3600_000).toISOString(),
        };
      }),
    );
    await must(db.from("matches").insert(rows));
    revalidatePath(`/admin/torneos/${tournamentId}`);
    return { error: null, ok: `Calendario generado: ${rows.length} partidos.` };
  } catch (e) {
    return fail(e);
  }
}

/** Crea semifinales cruzadas (1A–2B, 1B–2A) o la final y el tercer lugar según corresponda. */
export async function generateKnockout(_: ActionState, f: FormData): Promise<ActionState> {
  const tournamentId = str(f, "tournament_id");
  try {
    const db = await staffDb();
    const t = await must<Tournament>(db.from("tournaments").select("*").eq("id", tournamentId).single());
    const matches = await must<Match[]>(db.from("matches").select("*").eq("tournament_id", tournamentId));
    const entries = await must<TournamentTeam[]>(db.from("tournament_teams").select("*").eq("tournament_id", tournamentId));
    const semis = matches.filter((m) => m.stage === "semifinal");
    const when = new Date(Date.now() + 7 * 86400_000).toISOString();

    if (!semis.length) {
      const group = matches.filter((m) => m.stage === "group");
      if (!group.length || group.some((m) => m.status !== "finished")) throw new Error("La fase de grupos aún no termina.");
      const rank = (g: string) =>
        computeStandings(
          entries.filter((e) => e.group_label === g).map((e) => e.team_id),
          group.filter((m) => m.group_label === g).map((m) => ({ home: m.home_team_id, away: m.away_team_id, sets: m.result!.sets, bestOf: t.best_of })),
        ).map((r) => r.teamId);
      const fx = crossSemis(rank("A"), rank("B"));
      await must(db.from("matches").insert(fx.map((x) => ({ tournament_id: tournamentId, stage: "semifinal", round: 1, home_team_id: x.home, away_team_id: x.away, scheduled_at: when }))));
      revalidatePath(`/admin/torneos/${tournamentId}`);
      return { error: null, ok: "Semifinales creadas." };
    }
    if (semis.some((m) => m.status !== "finished")) throw new Error("Las semifinales aún no terminan.");
    if (matches.some((m) => m.stage === "final")) throw new Error("La final ya existe.");
    const winners = semis.map((m) => m.winner_team_id!);
    const losers = semis.map((m) => (m.winner_team_id === m.home_team_id ? m.away_team_id : m.home_team_id));
    await must(db.from("matches").insert([
      { tournament_id: tournamentId, stage: "third_place", round: 2, home_team_id: losers[0], away_team_id: losers[1], scheduled_at: when },
      { tournament_id: tournamentId, stage: "final", round: 2, home_team_id: winners[0], away_team_id: winners[1], scheduled_at: when },
    ]));
    revalidatePath(`/admin/torneos/${tournamentId}`);
    return { error: null, ok: "Final y tercer lugar creados." };
  } catch (e) {
    return fail(e);
  }
}

export async function updateMatch(_: ActionState, f: FormData): Promise<ActionState> {
  try {
    const db = await staffDb();
    const local = str(f, "scheduled_at");
    await must(
      db.from("matches").update({
        scorer_id: str(f, "scorer_id") || null,
        referee_1: str(f, "referee_1") || null,
        referee_2: str(f, "referee_2") || null,
        venue_id: str(f, "venue_id") || null,
        scheduled_at: local ? new Date(`${local}:00-05:00`).toISOString() : null,
      }).eq("id", str(f, "match_id")),
    );
    revalidatePath(`/admin/torneos/${str(f, "tournament_id")}`);
    return { error: null, ok: "Guardado" };
  } catch (e) {
    return fail(e);
  }
}

// ---------- Equipos y jugadores ----------
export async function createTeam(_: ActionState, f: FormData): Promise<ActionState> {
  try {
    const db = await staffDb();
    await must(db.from("teams").insert([{
      name: str(f, "name"),
      short_name: str(f, "short_name"),
      city: str(f, "city") || null,
      province: str(f, "province") || null,
      color_primary: str(f, "color_primary") || "#1d4ed8",
      color_secondary: "#ffffff",
    }]));
    revalidatePath("/admin/equipos");
    return { error: null, ok: "Equipo creado." };
  } catch (e) {
    return fail(e);
  }
}

export async function createPlayer(_: ActionState, f: FormData): Promise<ActionState> {
  try {
    const cedula = str(f, "cedula");
    const cedErr = validateCedula(cedula);
    if (cedErr) throw new Error(`Cédula: ${cedErr}`);
    const birth = str(f, "birth_date");
    const category = str(f, "category");
    if (category) {
      const ageErr = validateCategoryAge(category as Category, birth, Number(str(f, "season") || new Date().getFullYear()));
      if (ageErr) throw new Error(ageErr);
    }
    const db = await staffDb();
    const isLibero = f.get("is_libero") === "on";
    await must(db.from("players").insert([{
      team_id: str(f, "team_id"),
      first_name: str(f, "first_name"),
      last_name: str(f, "last_name"),
      cedula,
      birth_date: birth,
      number: Number(str(f, "number")),
      position: isLibero ? "libero" : str(f, "position") || null,
      is_libero: isLibero,
      is_captain: f.get("is_captain") === "on",
    }]));
    revalidatePath(`/admin/equipos/${str(f, "team_id")}`);
    return { error: null, ok: "Jugador(a) registrado(a)." };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/duplicate|unique/i.test(msg)) return { error: "Ya existe esa cédula o ese número de camiseta en el equipo." };
    return { error: msg };
  }
}

export async function deletePlayer(teamId: string, playerId: string) {
  const db = await staffDb();
  await must(db.from("players").delete().eq("id", playerId));
  revalidatePath(`/admin/equipos/${teamId}`);
}

// ---------- Usuarios ----------
export async function setRole(userId: string, role: Role) {
  const s = await getSession();
  if (s?.profile?.role !== "admin") throw new Error("Solo administradores.");
  const db = (await serverClient()).database;
  await must(db.from("profiles").update({ role }).eq("user_id", userId));
  revalidatePath("/admin/usuarios");
}
