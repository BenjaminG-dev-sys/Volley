"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Court } from "@/components/court";
import { Scoreboard } from "@/components/scoreboard";
import { Badge, Card, CardHeader, Empty, LinkButton, LiveBadge } from "@/components/ui";
import type { MatchBundle } from "@/lib/data";
import { fmtDateTime } from "@/lib/format";
import { buildSetup, rowToEvent } from "@/lib/match";
import { currentSet, replay, type MatchEvent } from "@/lib/scoresheet";
import { fetchMatchEvents, subscribeMatch } from "@/lib/sync/match-channel";
import { mergeRows, skipsAhead } from "@/lib/sync/rows";
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

  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  useEffect(() => {
    let alive = true;
    let resyncing = false;
    // Relee la planilla completa: los mensajes emitidos durante un corte no se reenvían.
    const resync = async () => {
      if (resyncing) return;
      resyncing = true;
      try {
        const server = await fetchMatchEvents(match.id);
        if (alive) setRows((prev) => mergeRows(prev, server as Row[]));
      } catch {
        // Se reintenta en la próxima reconexión o en el próximo hueco detectado.
      } finally {
        resyncing = false;
      }
    };
    const unsubscribe = subscribeMatch(match.id, {
      onEvent: (row) => {
        const gap = skipsAhead(rowsRef.current, row.seq);
        setRows((prev) => mergeRows(prev, [row as Row]));
        if (gap) void resync();
      },
      onConnect: () => {
        setConnected(true);
        void resync();
      },
      onDisconnect: () => setConnected(false),
    });
    return () => {
      alive = false;
      unsubscribe();
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
        <div className="rounded-xl bg-sun px-4 py-3 text-center font-display text-lg font-bold uppercase text-black">{state.notice}</div>
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
