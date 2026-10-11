"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Court } from "@/components/court";
import { Scoreboard } from "@/components/scoreboard";
import { Badge, Card, CardHeader, Empty, LinkButton, LiveBadge } from "@/components/ui";
import type { MatchBundle } from "@/lib/data";
import { fmtDateTime } from "@/lib/format";
import { insforge } from "@/lib/insforge/client";
import { buildSetup, rowToEvent } from "@/lib/match";
import { currentSet, replay, type MatchEvent } from "@/lib/scoresheet";
import { STAGE_LABEL } from "@/lib/types";

type Row = Pick<MatchBundle["events"][number], "seq" | "type" | "payload" | "created_at">;

export function LiveView({ bundle }: { bundle: MatchBundle }) {
  const { match, tournament, home, away, venue } = bundle;
  const setup = useMemo(
    () => buildSetup(tournament.best_of, home, away, bundle.homePlayers, bundle.awayPlayers),
    [tournament.best_of, home, away, bundle.homePlayers, bundle.awayPlayers],
  );
  const [rows, setRows] = useState<Row[]>(bundle.events);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const rt = insforge().realtime;
    const channel = `match:${match.id}`;
    const onEvent = (msg: Row & { meta?: { channel?: string } }) => {
      // InsForge antepone "realtime:" al nombre del canal en meta.channel.
      if (msg.meta?.channel && msg.meta.channel.replace(/^realtime:/, "") !== channel) return;
      setRows((prev) => (prev.some((r) => r.seq === msg.seq) ? prev : [...prev, msg].sort((a, b) => a.seq - b.seq)));
    };
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    rt.on("event", onEvent);
    rt.on("connect", onConnect);
    rt.on("disconnect", onDisconnect);
    rt.subscribe(channel).then((r) => setConnected(Boolean(r.ok))).catch(() => setConnected(false));
    return () => {
      rt.off("event", onEvent);
      rt.off("connect", onConnect);
      rt.off("disconnect", onDisconnect);
      rt.unsubscribe(channel);
    };
  }, [match.id]);

  const events: MatchEvent[] = useMemo(() => rows.map(rowToEvent), [rows]);
  const state = useMemo(() => replay(setup, events), [setup, events]);
  const set = currentSet(state);
  const teams = { A: { name: setup.teams.A.name, color: home.color_primary }, B: { name: setup.teams.B.name, color: away.color_primary } };
  const isLive = state.phase !== "closed" && rows.length > 0;
  const ticker = [...state.log].reverse().slice(0, 40);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted">
          <Link href={`/torneos/${tournament.id}`} className="font-medium text-ink hover:underline">
            {tournament.name}
          </Link>{" "}
          · {STAGE_LABEL[match.stage]}
          {match.group_label ? ` ${match.group_label}` : ""} · {fmtDateTime(match.scheduled_at)}
          {venue ? ` · ${venue.name}, ${venue.city}` : ""}
        </div>
        <div className="flex items-center gap-2">
          {isLive ? <LiveBadge /> : state.phase === "closed" ? <Badge tone="ok">Finalizado</Badge> : <Badge>Programado</Badge>}
          <Badge tone={connected ? "ok" : "neutral"}>{connected ? "Conectado en tiempo real" : "Conectando…"}</Badge>
          <LinkButton variant="secondary" href={`/partidos/${match.id}/planilla`}>
            Ver planilla
          </LinkButton>
        </div>
      </div>

      <Scoreboard state={state} teams={teams} />

      {state.notice && (
        <div className="rounded-xl bg-accent/15 px-4 py-3 text-center font-display text-lg font-semibold">{state.notice}</div>
      )}

      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <Card className="p-4">
          <h2 className="mb-3 font-semibold">Rotación en cancha</h2>
          {set ? (
            <Court
              left={{
                side: state.leftTeam,
                name: teams[state.leftTeam].name,
                color: teams[state.leftTeam].color,
                positions: set.teams[state.leftTeam].positions,
                libero: set.teams[state.leftTeam].liberoOnCourt?.libero,
                serving: state.serving === state.leftTeam,
              }}
              right={{
                side: state.leftTeam === "A" ? "B" : "A",
                name: teams[state.leftTeam === "A" ? "B" : "A"].name,
                color: teams[state.leftTeam === "A" ? "B" : "A"].color,
                positions: set.teams[state.leftTeam === "A" ? "B" : "A"].positions,
                libero: set.teams[state.leftTeam === "A" ? "B" : "A"].liberoOnCourt?.libero,
                serving: state.serving === (state.leftTeam === "A" ? "B" : "A"),
              }}
            />
          ) : (
            <Empty>{state.phase === "closed" || state.phase === "finished" ? "Partido terminado." : "El set aún no comienza."}</Empty>
          )}
        </Card>
        <Card className="flex max-h-[520px] flex-col">
          <CardHeader title="Jugada a jugada" />
          <ol className="flex-1 divide-y divide-line overflow-y-auto text-sm">
            {ticker.map((l, i) => (
              <li key={`${l.seq}-${i}`} className="flex items-center justify-between gap-3 px-4 py-2">
                <span>{l.text}</span>
                <span className="tabular shrink-0 text-xs text-muted">
                  S{l.set} · {l.score.A}-{l.score.B}
                </span>
              </li>
            ))}
            {!ticker.length && <Empty>Aún no hay jugadas registradas.</Empty>}
          </ol>
        </Card>
      </div>
    </div>
  );
}
