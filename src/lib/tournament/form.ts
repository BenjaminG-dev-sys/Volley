// "Forma" reciente de un equipo: sus últimos resultados, del más antiguo al más reciente.

export interface FormMatch {
  home: string;
  away: string;
  scheduledAt: string | null;
  homeSets: number;
  awaySets: number;
}

export type FormResult = "G" | "P";

/** Últimos `n` resultados de `teamId` (G = ganó, P = perdió), en orden cronológico. */
export function recentForm(teamId: string, matches: FormMatch[], n = 5): FormResult[] {
  return matches
    .filter((m) => m.home === teamId || m.away === teamId)
    .sort((a, b) => (a.scheduledAt ?? "").localeCompare(b.scheduledAt ?? ""))
    .slice(-n)
    .map((m) => {
      const mine = m.home === teamId ? m.homeSets : m.awaySets;
      const theirs = m.home === teamId ? m.awaySets : m.homeSets;
      return mine > theirs ? "G" : "P";
    });
}
