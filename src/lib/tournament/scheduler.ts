export interface Fixture {
  round: number;
  home: string;
  away: string;
}

/**
 * Calendario todos contra todos por el método del círculo.
 * Con número impar de equipos se agrega un "descanso" (el equipo libre esa jornada no juega).
 * Alterna local/visitante para equilibrar las localías.
 */
export function roundRobin(teamIds: string[]): Fixture[] {
  const BYE = "__bye__";
  const teams = teamIds.length % 2 === 0 ? [...teamIds] : [...teamIds, BYE];
  const n = teams.length;
  const fixtures: Fixture[] = [];
  const rotating = teams.slice(1);

  for (let r = 0; r < n - 1; r++) {
    const circle = [teams[0], ...rotating];
    for (let i = 0; i < n / 2; i++) {
      const a = circle[i];
      const b = circle[n - 1 - i];
      if (a === BYE || b === BYE) continue;
      const flip = (r + i) % 2 === 1;
      fixtures.push({ round: r + 1, home: flip ? b : a, away: flip ? a : b });
    }
    rotating.unshift(rotating.pop()!);
  }
  return fixtures;
}

/** Reparte equipos en grupos por sembrado en serpentina (1-A, 2-B, 3-B, 4-A...). */
export function snakeGroups(teamIds: string[], groupCount: number): string[][] {
  const groups: string[][] = Array.from({ length: groupCount }, () => []);
  teamIds.forEach((id, i) => {
    const row = Math.floor(i / groupCount);
    const col = i % groupCount;
    groups[row % 2 === 0 ? col : groupCount - 1 - col].push(id);
  });
  return groups;
}

export const groupLabel = (i: number) => String.fromCharCode(65 + i);

/** Semifinales cruzadas para dos grupos: 1A–2B y 1B–2A. */
export function crossSemis(groupA: string[], groupB: string[]): Fixture[] {
  return [
    { round: 1, home: groupA[0], away: groupB[1] },
    { round: 1, home: groupB[0], away: groupA[1] },
  ];
}

export interface ScheduleRow {
  stage: "group" | "league";
  group_label: string | null;
  round: number;
  home_team_id: string;
  away_team_id: string;
  venue_id: string | null;
  scheduled_at: string;
}

/**
 * Calendario completo listo para `replace_schedule`: grupos en serpentina, todos contra todos por grupo,
 * una jornada cada `daysBetweenRounds` días y partidos cada `slotHours` horas desde `startMs`.
 */
export function buildSchedule(opts: {
  teamIds: string[];
  groupCount: number;
  startMs: number;
  venueId: string | null;
  daysBetweenRounds?: number;
  slotHours?: number;
}): { groups: { team_id: string; group_label: string | null }[]; matches: ScheduleRow[] } {
  const groupCount = Math.max(1, Math.min(opts.groupCount, Math.floor(opts.teamIds.length / 2) || 1));
  const multi = groupCount > 1;
  const groups = snakeGroups(opts.teamIds, groupCount);
  const days = opts.daysBetweenRounds ?? 7;
  const slotMs = (opts.slotHours ?? 2) * 3600_000;
  const slots = new Map<number, number>();
  const matches = groups.flatMap((g, gi) =>
    roundRobin(g).map((fx) => {
      const slot = slots.get(fx.round) ?? 0;
      slots.set(fx.round, slot + 1);
      return {
        stage: multi ? ("group" as const) : ("league" as const),
        group_label: multi ? groupLabel(gi) : null,
        round: fx.round,
        home_team_id: fx.home,
        away_team_id: fx.away,
        venue_id: opts.venueId,
        scheduled_at: new Date(opts.startMs + (fx.round - 1) * days * 86400_000 + slot * slotMs).toISOString(),
      };
    }),
  );
  return {
    groups: groups.flatMap((g, gi) => g.map((team_id) => ({ team_id, group_label: multi ? groupLabel(gi) : null }))),
    matches,
  };
}
