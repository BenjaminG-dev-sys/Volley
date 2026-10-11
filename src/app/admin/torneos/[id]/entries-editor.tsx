"use client";

import { useState, useTransition } from "react";
import { Button, TeamDot } from "@/components/ui";
import type { Team } from "@/lib/types";
import { setEntries } from "../../actions";

export function EntriesEditor({ tournamentId, teams, selected, locked }: { tournamentId: string; teams: Team[]; selected: string[]; locked: boolean }) {
  const [ids, setIds] = useState(selected);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  return (
    <div className="space-y-3 p-4">
      <div className="grid gap-2 sm:grid-cols-2">
        {teams.map((t) => (
          <label key={t.id} className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm">
            <input
              type="checkbox"
              disabled={locked}
              checked={ids.includes(t.id)}
              onChange={(e) => {
                setSaved(false);
                setIds((x) => (e.target.checked ? [...x, t.id] : x.filter((y) => y !== t.id)));
              }}
            />
            <TeamDot color={t.color_primary} /> {t.short_name}
            <span className="truncate text-xs text-muted">{t.city}</span>
          </label>
        ))}
      </div>
      {locked ? (
        <p className="text-xs text-muted">La inscripción se bloquea cuando ya hay partidos jugados.</p>
      ) : (
        <Button
          disabled={pending}
          onClick={() =>
            start(async () => {
              await setEntries(tournamentId, ids);
              setSaved(true);
            })
          }
        >
          {pending ? "Guardando…" : `Guardar inscripción (${ids.length})`}
        </Button>
      )}
      {saved && <span className="ml-3 text-sm text-ok">Inscripción guardada.</span>}
    </div>
  );
}
