import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Badge, Card, CardHeader, Empty, LinkButton, LiveBadge, TeamDot } from "@/components/ui";
import { listMatches, listTeams } from "@/lib/data";
import { fmtDateTime } from "@/lib/format";
import { getSession, isStaff } from "@/lib/insforge/server";
import type { Match } from "@/lib/types";
import { STAGE_LABEL } from "@/lib/types";

export const metadata: Metadata = { title: "Mesa de control" };
export const dynamic = "force-dynamic";

export default async function MesaPage() {
  const session = await getSession();
  if (!session) redirect("/ingresar?next=/mesa");
  const staff = isStaff(session);
  const [teams, live, scheduled] = await Promise.all([
    listTeams(),
    listMatches({ status: "live", scorerId: staff ? undefined : session.userId }),
    listMatches({ status: "scheduled", scorerId: staff ? undefined : session.userId }),
  ]);
  const teamMap = new Map(teams.map((t) => [t.id, t]));
  const row = (m: Match) => (
    <div key={m.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
      <div className="w-32 text-xs text-muted">{m.status === "live" ? <LiveBadge /> : fmtDateTime(m.scheduled_at)}</div>
      <div className="min-w-0 flex-1 text-sm">
        {[m.home_team_id, m.away_team_id].map((id) => (
          <div key={id} className="flex items-center gap-2">
            <TeamDot color={teamMap.get(id)?.color_primary ?? "#999"} /> {teamMap.get(id)?.short_name}
          </div>
        ))}
      </div>
      <Badge>
        {STAGE_LABEL[m.stage]} {m.group_label ?? ""}
      </Badge>
      {m.status === "live" && m.live_state && (
        <span className="tabular font-display text-lg font-bold">
          {m.live_state.setsWon.A}-{m.live_state.setsWon.B} · {m.live_state.score.A}-{m.live_state.score.B}
        </span>
      )}
      <LinkButton href={`/mesa/${m.id}`}>{m.status === "live" ? "Continuar planilla" : "Abrir planilla"}</LinkButton>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Mesa de control</h1>
        <p className="text-muted">
          {staff ? "Todos los partidos (vista de organizador)." : "Partidos asignados a tu usuario como planillero."}
        </p>
      </div>
      <Card className="divide-y divide-line">
        <CardHeader title="En juego" />
        {live.length ? live.map(row) : <Empty>No tienes partidos en juego.</Empty>}
      </Card>
      <Card className="divide-y divide-line">
        <CardHeader title="Programados" />
        {scheduled.length ? scheduled.map(row) : <Empty>No tienes partidos programados.</Empty>}
      </Card>
    </div>
  );
}
