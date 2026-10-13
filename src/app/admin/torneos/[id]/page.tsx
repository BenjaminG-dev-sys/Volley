import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { Badge, Button, Card, CardHeader, Field, LinkButton, PageHeader, TeamDot, inputCls } from "@/components/ui";
import { getTournament, listTeams, listVenues } from "@/lib/data";
import { BRANCH_LABEL, fmtDateTime } from "@/lib/format";
import { serverClient } from "@/lib/insforge/server";
import type { Match, Profile, Team, Venue } from "@/lib/types";
import { STAGE_LABEL } from "@/lib/types";
import { generateKnockout, generateSchedule, setTournamentStatus, updateMatch } from "../../actions";
import { EntriesEditor } from "./entries-editor";

export const metadata: Metadata = { title: "Administrar torneo" };

const toLocalInput = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() - 5 * 3600_000).toISOString().slice(0, 16) : "");

export default async function AdminTournament({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = (await serverClient()).database;
  const [{ tournament, entries, matches }, teams, venues, scorersRes] = await Promise.all([
    getTournament(id),
    listTeams(),
    listVenues(),
    db.from("profiles").select("user_id, display_name, email, role").in("role", ["scorer", "organizer", "admin"]).limit(200),
  ]);
  if (!tournament) notFound();
  const scorers = (scorersRes.data ?? []) as Profile[];
  const teamMap = new Map(teams.map((t) => [t.id, t]));
  const locked = matches.some((m) => m.status !== "scheduled");

  return (
    <div className="space-y-6">
      <PageHeader
        title={tournament.name}
        sub={`${tournament.category} · ${BRANCH_LABEL[tournament.branch]} · ${tournament.season} · ${tournament.format === "groups_knockout" ? "Grupos + eliminatoria" : "Todos contra todos"}`}
        action={
          <div className="flex flex-wrap gap-2">
            <LinkButton variant="secondary" href={`/torneos/${id}`}>
              Ver público
            </LinkButton>
            {(["draft", "active", "finished"] as const).map((s) => (
              <form key={s} action={setTournamentStatus.bind(null, id, s)}>
                <Button variant={tournament.status === s ? "primary" : "secondary"}>
                  {{ draft: "Borrador", active: "Publicar / en curso", finished: "Finalizar" }[s]}
                </Button>
              </form>
            ))}
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Equipos inscritos" sub={`${entries.length} equipos`} />
          <EntriesEditor
            tournamentId={id}
            teams={teams.filter((t) => (t.sport ?? "voley") === (tournament.sport ?? "voley"))}
            selected={entries.map((e) => e.team_id)}
            locked={locked}
          />
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Generar calendario" sub="Método del círculo; grupos por sembrado en serpentina." />
            <ActionForm action={generateSchedule} submit="Generar" className="p-4">
              <input type="hidden" name="tournament_id" value={id} />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Primera jornada">
                  <input type="date" name="start_date" required className={inputCls} />
                </Field>
                {tournament.format === "groups_knockout" && (
                  <Field label="Grupos">
                    <input type="number" name="groups" min={2} max={4} defaultValue={2} className={inputCls} />
                  </Field>
                )}
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
              </div>
              {locked && <p className="text-xs text-muted">Ya hay partidos jugados: no se puede regenerar.</p>}
            </ActionForm>
          </Card>
          {tournament.format === "groups_knockout" && (
            <Card>
              <CardHeader title="Fase final" sub="Semifinales 1.º A–2.º B y 1.º B–2.º A; luego final y tercer lugar." />
              <ActionForm action={generateKnockout} submit="Generar siguiente fase" className="p-4">
                <input type="hidden" name="tournament_id" value={id} />
              </ActionForm>
            </Card>
          )}
        </div>
      </div>

      <Card className="divide-y divide-line">
        <CardHeader title="Partidos" sub="Asigna planillero, árbitros, sede y horario (hora de Ecuador)." />
        {matches.map((m) => (
          <MatchEditor key={m.id} m={m} teams={teamMap} venues={venues} scorers={scorers} tournamentId={id} />
        ))}
      </Card>
    </div>
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
    <div className="space-y-2 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge>
          {STAGE_LABEL[m.stage]} {m.group_label ?? ""} {m.round ? `· J${m.round}` : ""}
        </Badge>
        <TeamDot color={h?.color_primary ?? "#999"} /> <strong>{h?.short_name}</strong> vs <TeamDot color={a?.color_primary ?? "#999"} />
        <strong>{a?.short_name}</strong>
        <span className="text-muted">· {fmtDateTime(m.scheduled_at)}</span>
        {m.status === "live" && <Badge tone="live">En vivo</Badge>}
        {m.status === "finished" && (
          <Badge tone="ok">
            Final {m.result?.home_sets}-{m.result?.away_sets}
          </Badge>
        )}
        <Link className="ml-auto text-xs font-medium underline-offset-2 hover:underline" href={`/mesa/${m.id}`}>
          Abrir mesa
        </Link>
      </div>
      {m.status !== "finished" && (
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
          <input name="referee_1" defaultValue={m.referee_1 ?? ""} placeholder="1.er árbitro" className={`${inputCls} w-36`} />
          <input name="referee_2" defaultValue={m.referee_2 ?? ""} placeholder="2.º árbitro" className={`${inputCls} w-36`} />
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
      )}
    </div>
  );
}
