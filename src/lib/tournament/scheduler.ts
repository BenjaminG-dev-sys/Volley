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
