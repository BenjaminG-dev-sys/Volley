"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Court } from "@/components/court";
import { MatchStats } from "@/components/match-stats";
import { Scoreboard } from "@/components/scoreboard";
import { Badge, Button, Card, CardHeader, Empty, LinkButton, LiveBadge, cx } from "@/components/ui";
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
    () => buildSetup(tournament, home, away, bundle.homePlayers, bundle.awayPlayers),
    [tournament, home, away, bundle.homePlayers, bundle.awayPlayers],
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
  const right = state.leftTeam === "A" ? "B" : "A";
  const courtTeam = (side: "A" | "B") => ({
    side,
    name: teams[side].name,
    color: teams[side].color,
    positions: set!.teams[side].positions,
    libero: set!.teams[side].liberoOnCourt?.libero,
    serving: state.serving === side,
  });

  const stage = useRef<HTMLDivElement>(null);
  const fullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void stage.current?.requestFullscreen?.();
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="eyebrow mb-2 text-muted">
            <Link href={`/torneos/${tournament.id}`} className="underline-anim">
              {tournament.name}
            </Link>{" "}
            · {STAGE_LABEL[match.stage]}
            {match.group_label ? ` ${match.group_label}` : ""}
          </p>
          <h1 className="display-m">
            {home.short_name} <span className="text-muted">vs</span> {away.short_name}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {fmtDateTime(match.scheduled_at)}
            {venue ? ` · ${venue.name}, ${venue.city}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isLive ? <LiveBadge /> : state.phase === "closed" ? <Badge tone="ok">Finalizado</Badge> : <Badge>Programado</Badge>}
          <span className="flex items-center gap-1.5 text-xs text-muted" title={connected ? "Conectado en tiempo real" : "Conectando…"}>
            <span className={cx("h-2 w-2 rounded-full", connected ? "bg-ok" : "bg-line")} />
            {connected ? "Tiempo real" : "Conectando…"}
          </span>
          <Button variant="secondary" onClick={fullscreen}>
            Pantalla completa
          </Button>
          <LinkButton variant="secondary" href={`/partidos/${match.id}/planilla`}>
            Ver planilla
          </LinkButton>
        </div>
      </div>

      <div ref={stage} className="scoreboard-stage space-y-4">
        <Scoreboard state={state} teams={teams} size="big" />
        {state.notice && (
          <div className="rounded-2xl bg-sun px-4 py-3 text-center font-display text-xl font-extrabold uppercase text-black">{state.notice}</div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <Card className="p-4 sm:p-5">
          <h2 className="mb-4 font-display text-lg font-bold uppercase tracking-wide">{state.rules.rotation ? "Rotación en cancha" : "En cancha"}</h2>
          {set ? (
            <Court left={courtTeam(state.leftTeam)} right={courtTeam(right)} labels={state.rules.positionLabels} />
          ) : (
            <Empty>{state.phase === "closed" || state.phase === "finished" ? "Partido terminado." : "El set aún no comienza."}</Empty>
          )}
        </Card>
        <Card className="flex max-h-[560px] flex-col overflow-hidden">
          <CardHeader title="Jugada a jugada" />
          <ol className="flex-1 divide-y divide-line overflow-y-auto text-sm">
            {ticker.map((l, i) => (
              <li key={`${l.seq}-${i}`} className={cx("flex items-center justify-between gap-3 px-4 py-2.5 sm:px-5", i === 0 && "bg-surface-2 font-semibold")}>
                <span>{l.text}</span>
                <span className="tabular shrink-0 font-display text-sm font-bold">
                  <span className="mr-1 text-muted">S{l.set}</span>
                  {l.score.A}-{l.score.B}
                </span>
              </li>
            ))}
            {!ticker.length && <Empty>Aún no hay jugadas registradas.</Empty>}
          </ol>
        </Card>
      </div>

      <MatchStats state={state} teams={teams} />
    </div>
  );
}
