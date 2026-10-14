// Planilla oficial de un partido (pantalla e impresión). La usan la página pública y la impresión por jornada.
import { MatchStats } from "@/components/match-stats";
import { Badge, Card } from "@/components/ui";
import type { MatchBundle } from "@/lib/data";
import { fmtDateTime } from "@/lib/format";
import { buildSetup, rowToEvent } from "@/lib/match";
import { describeRules, replay, rulesOf, type MatchEvent, type MatchSetup, type SetState, type Side } from "@/lib/scoresheet";
import { STAGE_LABEL } from "@/lib/types";

const SANCTION: Record<string, string> = {
  warning: "Amonestación",
  penalty: "Castigo",
  expulsion: "Expulsión",
  disqualification: "Descalificación",
  delay_warning: "Amonest. retraso",
  delay_penalty: "Castigo retraso",
};

/** Planilla completa reconstruida desde los eventos. `withStats` agrega las estadísticas (no se imprimen). */
export function ScoresheetView({ bundle, withStats = true }: { bundle: MatchBundle; withStats?: boolean }) {
  const { match, tournament, home, away, venue } = bundle;
  const setup = buildSetup(tournament, home, away, bundle.homePlayers, bundle.awayPlayers);
  const events: MatchEvent[] = bundle.events.map(rowToEvent);
  const state = replay(setup, events);
  const sides: Side[] = ["A", "B"];
  const teamName = (s: Side) => (s === "A" ? home.name : away.name);

  return (
    <Card className="print-sheet space-y-5 p-5 text-sm sm:p-8">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-4">
        <div>
          <p className="eyebrow text-muted">Planilla oficial de juego · {setup.rules?.sport === "ecuavoley" ? "Ecuavóley" : "Reglas FIVB"}</p>
          <h1 className="display-m mt-2">
            {home.name} <span className="text-muted">vs</span> {away.name}
          </h1>
          <p className="text-muted">
            {tournament.name} · {STAGE_LABEL[match.stage]}
            {match.group_label ? ` ${match.group_label}` : ""} · {tournament.category}
          </p>
          <p className="eyebrow mt-1 text-muted">{describeRules(rulesOf(setup))}</p>
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
          <dt className="text-muted">Fecha</dt>
          <dd>{fmtDateTime(match.scheduled_at)}</dd>
          <dt className="text-muted">Sede</dt>
          <dd>{venue ? `${venue.name}, ${venue.city}` : "—"}</dd>
          <dt className="text-muted">1.er árbitro</dt>
          <dd>{match.referee_1 ?? "—"}</dd>
          <dt className="text-muted">2.º árbitro</dt>
          <dd>{match.referee_2 ?? "—"}</dd>
          <dt className="text-muted">Estado</dt>
          <dd>{state.phase === "closed" ? <Badge tone="ok">Cerrada y firmada</Badge> : <Badge tone="live">En curso</Badge>}</dd>
        </dl>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        {sides.map((s) => (
          <Roster key={s} title={`${s === "A" ? "Local" : "Visitante"}: ${teamName(s)}`} setup={setup} side={s} />
        ))}
      </section>

      {state.sets.map((set) => (
        <SetBlock key={set.no} set={set} setup={setup} teamName={teamName} />
      ))}
      {!state.sets.length && <p className="text-muted">El partido aún no ha comenzado.</p>}

      {withStats && (
        <div className="no-print">
          <MatchStats state={state} teams={{ A: { name: home.short_name, color: home.color_primary }, B: { name: away.short_name, color: away.color_primary } }} />
        </div>
      )}

      <section>
        <h2 className="mb-2 font-display text-base font-bold uppercase tracking-wide">Sanciones</h2>
        {state.sanctions.length ? (
          <table className="w-full text-xs">
            <thead className="text-left text-muted">
              <tr>
                <th className="py-1">Set</th>
                <th>Equipo</th>
                <th>Tipo</th>
                <th>Jugador</th>
                <th>Marcador</th>
              </tr>
            </thead>
            <tbody className="tabular">
              {state.sanctions.map((x, i) => (
                <tr key={i} className="border-t border-line">
                  <td className="py-1">{x.set}</td>
                  <td>{teamName(x.team)}</td>
                  <td>{SANCTION[x.kind]}</td>
                  <td>{x.player ?? "Equipo"}</td>
                  <td>
                    {x.score.A}-{x.score.B}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-xs text-muted">Sin sanciones.</p>
        )}
      </section>

      <section className="grid gap-4 border-t border-line pt-4 md:grid-cols-2">
        <div>
          <h2 className="mb-2 font-display text-base font-bold uppercase tracking-wide">Resultado</h2>
          <table className="tabular w-full text-sm">
            <thead className="text-left text-xs text-muted">
              <tr>
                <th className="py-1">Set</th>
                <th>{home.short_name}</th>
                <th>{away.short_name}</th>
              </tr>
            </thead>
            <tbody>
              {state.sets
                .filter((s) => s.winner)
                .map((s) => (
                  <tr key={s.no} className="border-t border-line">
                    <td className="py-1">{s.no}</td>
                    <td className={s.winner === "A" ? "font-bold" : ""}>{s.score.A}</td>
                    <td className={s.winner === "B" ? "font-bold" : ""}>{s.score.B}</td>
                  </tr>
                ))}
              <tr className="border-t-2 border-ink font-bold">
                <td className="py-1">Sets</td>
                <td>{state.setsWon.A}</td>
                <td>{state.setsWon.B}</td>
              </tr>
            </tbody>
          </table>
          {state.winner && (
            <p className="mt-2">
              Ganador: <strong>{teamName(state.winner)}</strong> ({state.setsWon[state.winner]}-{state.setsWon[state.winner === "A" ? "B" : "A"]})
            </p>
          )}
        </div>
        <div>
          <h2 className="mb-2 font-display text-base font-bold uppercase tracking-wide">Firmas</h2>
          <dl className="space-y-3 text-sm">
            {[
              [`Capitán(a) ${home.short_name}`, state.signatures?.captainA],
              [`Capitán(a) ${away.short_name}`, state.signatures?.captainB],
              ["1.er árbitro", state.signatures?.referee],
            ].map(([label, name]) => (
              <div key={label} className="border-b border-dashed border-line pb-1">
                <dt className="text-xs text-muted">{label}</dt>
                <dd className="min-h-5 font-medium italic">{name || ""}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
    </Card>
  );
}

function Roster({ title, setup, side }: { title: string; setup: MatchSetup; side: Side }) {
  return (
    <div>
      <h2 className="mb-2 font-display text-base font-bold uppercase tracking-wide">{title}</h2>
      <table className="w-full text-xs">
        <tbody className="tabular">
          {setup.teams[side].players.map((p) => (
            <tr key={p.number} className="border-t border-line">
              <td className="w-8 py-0.5 font-bold">{p.number}</td>
              <td>{p.name}</td>
              <td className="w-10 text-right">
                {p.libero && <Badge tone="accent">L</Badge>} {p.captain && <Badge tone="primary">C</Badge>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SetBlock({ set, setup, teamName }: { set: SetState; setup: MatchSetup; teamName: (s: Side) => string }) {
  const rules = rulesOf(setup);
  const target = set.no === setup.bestOf ? rules.pointsDecidingSet : rules.pointsPerSet;
  const maxPoints = Math.max(target, set.score.A, set.score.B);
  return (
    <section className="rounded-xl border border-line p-4">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-xl font-extrabold uppercase">Set {set.no}</h2>
        <span className="tabular font-display text-2xl font-extrabold">
          {set.score.A} - {set.score.B}
          {set.winner && <span className="ml-2 text-sm font-normal text-muted">gana {teamName(set.winner)}</span>}
        </span>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {(["A", "B"] as Side[]).map((s) => {
          const ts = set.teams[s];
          // Con cambio de saque, las jugadas ganadas sin saque no suman punto.
          const scored = set.rallies.filter((r) => r.winner === s && !r.sideout);
          const sideouts = set.rallies.filter((r) => r.winner === s && r.sideout).length;
          return (
            <div key={s} className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium">
                  {teamName(s)} {set.firstServer === s && <Badge tone="accent">Saque inicial</Badge>}
                </span>
                <span className="text-muted">
                  T: {ts.timeouts} · S: {ts.substitutions}
                  {rules.scoring === "sideout" && ` · Cambios: ${sideouts}`}
                </span>
              </div>
              <table className="tabular w-full text-center text-xs">
                <thead className="text-muted">
                  <tr>
                    {rules.positionLabels.map((p) => (
                      <th key={p} className="font-normal">
                        {p}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    {ts.starters.map((n, i) => (
                      <td key={i} className="border border-line py-1 font-bold">
                        {n}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    {ts.starters.map((n, i) => {
                      const pair = ts.subPairs.find((p) => p.starter === n);
                      return (
                        <td key={i} className="border border-line py-0.5 text-muted">
                          {pair ? `${pair.sub}${pair.returned ? "↺" : ""}` : ""}
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
              {/* Puntuación corrida: los puntos anotados se tachan en orden */}
              <div className="flex flex-wrap gap-0.5">
                {Array.from({ length: maxPoints }, (_, i) => {
                  const done = i < scored.length;
                  return (
                    <span
                      key={i}
                      className={`grid h-5 w-5 place-items-center rounded text-[10px] ${done ? "bg-ink text-bg" : "border border-line text-muted"}`}
                      title={done && scored[i].bySanction ? "Punto por castigo" : undefined}
                    >
                      {i + 1}
                    </span>
                  );
                })}
              </div>
              {ts.liberos.length > 0 && <p className="text-xs text-muted">Líbero(s): {ts.liberos.join(", ")}</p>}
            </div>
          );
        })}
      </div>
    </section>
  );
}
