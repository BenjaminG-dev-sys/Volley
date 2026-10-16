import { toCsv } from "@/lib/admin/csv";
import { getTournament, listTeams, listVenues } from "@/lib/data";
import { fmtDateTime } from "@/lib/format";
import { getSession, isStaff, serverClient } from "@/lib/insforge/server";
import { computeStandings, formatRatio, standingsConfig } from "@/lib/tournament/standings";
import type { Player } from "@/lib/types";
import { STAGE_LABEL } from "@/lib/types";

const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

/** Exportaciones CSV del panel: posiciones, calendario y nóminas de un torneo (solo staff). */
export async function GET(req: Request) {
  if (!isStaff(await getSession())) return new Response("No autorizado", { status: 403 });
  const url = new URL(req.url);
  const tipo = url.searchParams.get("tipo");
  if (tipo === "plantilla") {
    const csv = toCsv([
      ["Nombres", "Apellidos", "Cédula", "Fecha de nacimiento", "Número", "Posición", "Líbero", "Capitán"],
      ["María", "Andrade Vera", "1712345675", "15/03/2008", 7, "armador", "", "sí"],
    ]);
    return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="plantilla-nomina.csv"' } });
  }
  if (tipo === "equipo") {
    const teamId = url.searchParams.get("equipo") ?? "";
    const db = (await serverClient()).database;
    const [{ data: team }, { data }] = await Promise.all([
      db.from("teams").select("name").eq("id", teamId).maybeSingle(),
      db.from("players").select("*").eq("team_id", teamId).order("number"),
    ]);
    if (!team) return new Response("Equipo no encontrado", { status: 404 });
    const out: (string | number | null)[][] = [["Número", "Nombres", "Apellidos", "Cédula", "Fecha de nacimiento", "Posición", "Líbero", "Capitán"]];
    for (const p of (data ?? []) as Player[]) out.push([p.number, p.first_name, p.last_name, p.cedula, p.birth_date, p.position, p.is_libero ? "sí" : "", p.is_captain ? "sí" : ""]);
    return new Response(toCsv(out), {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="nomina-${slug((team as { name: string }).name)}.csv"`, "Cache-Control": "no-store" },
    });
  }
  const tid = url.searchParams.get("torneo") ?? "";
  const { tournament, entries, matches } = await getTournament(tid);
  if (!tournament) return new Response("Torneo no encontrado", { status: 404 });
  const teams = new Map((await listTeams()).map((t) => [t.id, t]));
  const name = (id: string) => teams.get(id)?.name ?? "";
  const rows: (string | number | null)[][] = [];

  if (tipo === "posiciones") {
    rows.push(["Grupo", "Pos.", "Equipo", "PJ", "G", "P", "Sets a favor", "Sets en contra", "C.S.", "Puntos a favor", "Puntos en contra", "C.P.", "Pts"]);
    const groups = [...new Set(entries.map((e) => e.group_label ?? "Única"))].sort();
    for (const g of groups) {
      const table = computeStandings(
        entries.filter((e) => (e.group_label ?? "Única") === g).map((e) => e.team_id),
        matches
          .filter((m) => m.status === "finished" && m.result && (m.stage === "group" || m.stage === "league") && (m.group_label ?? "Única") === g)
          .map((m) => ({ home: m.home_team_id, away: m.away_team_id, sets: m.result!.sets, bestOf: tournament.best_of })),
        standingsConfig(tournament.standings),
      );
      table.forEach((r, i) =>
        rows.push([g, i + 1, name(r.teamId), r.played, r.won, r.lost, r.setsWon, r.setsLost, formatRatio(r.setRatio), r.pointsWon, r.pointsLost, formatRatio(r.pointRatio), r.points]),
      );
    }
  } else if (tipo === "calendario") {
    const venues = new Map((await listVenues()).map((v) => [v.id, v]));
    rows.push(["Fase", "Grupo", "Jornada", "Fecha", "Local", "Visitante", "Sede", "Estado", "Sets local", "Sets visitante", "Parciales", "1.er árbitro", "2.º árbitro"]);
    for (const m of matches)
      rows.push([
        STAGE_LABEL[m.stage],
        m.group_label,
        m.round,
        fmtDateTime(m.scheduled_at),
        name(m.home_team_id),
        name(m.away_team_id),
        m.venue_id ? venues.get(m.venue_id)?.name ?? "" : "",
        { scheduled: "Programado", live: "En vivo", finished: "Final" }[m.status],
        m.result?.home_sets ?? null,
        m.result?.away_sets ?? null,
        m.result?.sets.map((s) => `${s.home}-${s.away}`).join(" ") ?? "",
        m.referee_1,
        m.referee_2,
      ]);
  } else if (tipo === "nominas") {
    const db = (await serverClient()).database;
    const { data } = await db.from("players").select("*").in("team_id", entries.map((e) => e.team_id).concat("00000000-0000-0000-0000-000000000000")).order("number");
    rows.push(["Equipo", "Número", "Nombres", "Apellidos", "Cédula", "Fecha de nacimiento", "Posición", "Líbero", "Capitán"]);
    for (const p of ((data ?? []) as Player[]).sort((a, b) => name(a.team_id).localeCompare(name(b.team_id)) || a.number - b.number))
      rows.push([name(p.team_id), p.number, p.first_name, p.last_name, p.cedula, p.birth_date, p.position, p.is_libero ? "sí" : "", p.is_captain ? "sí" : ""]);
  } else {
    return new Response("Tipo de exportación inválido", { status: 400 });
  }

  return new Response(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slug(tournament.name)}-${tipo}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
