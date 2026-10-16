// Reglamentos como datos: el motor de planilla aplica el `RuleSet` del partido.
// Vóley (FIVB) y Ecuavóley comparten el modelo de eventos; cambian conteos y puntuación.

import { POSITION_LABELS } from "./rotation";
import type { MatchSetup } from "./types";

export type Sport = "voley" | "ecuavoley";

/**
 * `rally`: cada jugada suma punto (vóley moderno).
 * `sideout`: solo suma quien saca; si gana el receptor, solo recupera el saque ("cambio").
 */
export type Scoring = "rally" | "sideout";

export interface RuleSet {
  sport: Sport;
  bestOf: 3 | 5;
  pointsPerSet: number;
  pointsDecidingSet: number;
  scoring: Scoring;
  /** Jugadores en cancha por equipo. */
  playersOnCourt: 6 | 3;
  /** Rotación horaria al recuperar el saque. */
  rotation: boolean;
  /** Máximo de líberos registrables (0 = el modo no usa líbero). */
  liberos: number;
  timeoutsPerSet: number;
  /** El tiempo solo lo puede pedir el equipo que tiene el saque. */
  timeoutsOnlyServing: boolean;
  maxSubstitutions: number;
  /** `fivb`: titular ↔ suplente, una vuelta por set. `free`: cualquier suplente por cualquiera en cancha. */
  substitutionModel: "fivb" | "free";
  /** Nombre de cada posición de la formación (índice 0 = sacador). */
  positionLabels: string[];
}

export const VOLEY_FIVB: RuleSet = {
  sport: "voley",
  bestOf: 5,
  pointsPerSet: 25,
  pointsDecidingSet: 15,
  scoring: "rally",
  playersOnCourt: 6,
  rotation: true,
  liberos: 2,
  timeoutsPerSet: 2,
  timeoutsOnlyServing: false,
  maxSubstitutions: 6,
  substitutionModel: "fivb",
  positionLabels: [...POSITION_LABELS],
};

/** Ecuavóley tradicional: 3 por equipo, sets a 15 con cambio de saque, al mejor de 3. */
export const ECUAVOLEY: RuleSet = {
  sport: "ecuavoley",
  bestOf: 3,
  pointsPerSet: 15,
  pointsDecidingSet: 15,
  scoring: "sideout",
  playersOnCourt: 3,
  rotation: false,
  liberos: 0,
  timeoutsPerSet: 2,
  timeoutsOnlyServing: true,
  maxSubstitutions: 6,
  substitutionModel: "free",
  positionLabels: ["Servidor", "Colocador", "Volador"],
};

/** Ajustes que un torneo puede cambiar respecto del preset de su deporte. */
export type RuleOverrides = Partial<
  Pick<RuleSet, "bestOf" | "pointsPerSet" | "pointsDecidingSet" | "scoring" | "timeoutsPerSet" | "timeoutsOnlyServing" | "maxSubstitutions">
>;

/** Reglamentos disponibles al crear un torneo. */
export const RULE_PRESETS = {
  voley_fivb: { label: "Vóley FIVB · al mejor de 5", sport: "voley", bestOf: 5, overrides: {} },
  voley_fivb_3: { label: "Vóley FIVB · al mejor de 3", sport: "voley", bestOf: 3, overrides: {} },
  ecuavoley_15: { label: "Ecuavóley · sets a 15 con cambio", sport: "ecuavoley", bestOf: 3, overrides: {} },
  ecuavoley_12: { label: "Ecuavóley barrial · sets a 12 con cambio", sport: "ecuavoley", bestOf: 3, overrides: { pointsPerSet: 12, pointsDecidingSet: 12 } },
  ecuavoley_10: { label: "Ecuavóley costa · sets a 10 con cambio", sport: "ecuavoley", bestOf: 3, overrides: { pointsPerSet: 10, pointsDecidingSet: 10 } },
  ecuavoley_rally: { label: "Ecuavóley · sets a 15, punto directo", sport: "ecuavoley", bestOf: 3, overrides: { scoring: "rally", timeoutsOnlyServing: false } },
} as const satisfies Record<string, { label: string; sport: Sport; bestOf: 3 | 5; overrides: RuleOverrides }>;

export type RulePresetId = keyof typeof RULE_PRESETS;

export const SPORT_LABEL: Record<Sport, string> = { voley: "Vóley", ecuavoley: "Ecuavóley" };

/** Posiciones de la nómina por deporte (valores de `players.position`). */
export const SPORT_POSITIONS: Record<Sport, readonly string[]> = {
  voley: ["armador", "opuesto", "central", "punta"],
  ecuavoley: ["servidor", "colocador", "volador"],
};

/** Límites de nómina por deporte (iguales a `enforce_roster_limits` en la base). */
export const ROSTER_LIMITS: Record<Sport, { players: number; liberos: number }> = {
  voley: { players: 14, liberos: 2 },
  ecuavoley: { players: 7, liberos: 0 },
};

const clampInt = (v: unknown, min: number, max: number) =>
  typeof v === "number" && Number.isInteger(v) && v >= min && v <= max ? v : undefined;

/** Reglamento efectivo de un torneo: preset del deporte + ajustes válidos (los inválidos se ignoran). */
export function resolveRules(sport: Sport, overrides?: RuleOverrides | null, bestOf?: number): RuleSet {
  const base = sport === "ecuavoley" ? ECUAVOLEY : VOLEY_FIVB;
  const o = overrides ?? {};
  const bo = bestOf ?? o.bestOf;
  return {
    ...base,
    bestOf: bo === 3 || bo === 5 ? bo : base.bestOf,
    pointsPerSet: clampInt(o.pointsPerSet, 5, 50) ?? base.pointsPerSet,
    pointsDecidingSet: clampInt(o.pointsDecidingSet, 5, 50) ?? base.pointsDecidingSet,
    scoring: o.scoring === "rally" || o.scoring === "sideout" ? o.scoring : base.scoring,
    timeoutsPerSet: clampInt(o.timeoutsPerSet, 0, 5) ?? base.timeoutsPerSet,
    timeoutsOnlyServing: typeof o.timeoutsOnlyServing === "boolean" ? o.timeoutsOnlyServing : base.timeoutsOnlyServing,
    maxSubstitutions: clampInt(o.maxSubstitutions, 0, 20) ?? base.maxSubstitutions,
  };
}

/** Reglamento de un partido. Sin `rules` explícitas es vóley FIVB (compatibilidad). */
export function rulesOf(setup: MatchSetup): RuleSet {
  const base = setup.rules ?? VOLEY_FIVB;
  return {
    ...base,
    bestOf: setup.bestOf,
    pointsPerSet: setup.pointsPerSet ?? base.pointsPerSet,
    pointsDecidingSet: setup.pointsDecidingSet ?? base.pointsDecidingSet,
  };
}

/** Descripción breve del reglamento para encabezados y planillas. */
export function describeRules(r: RuleSet): string {
  const sets = r.pointsPerSet === r.pointsDecidingSet ? `sets a ${r.pointsPerSet}` : `sets a ${r.pointsPerSet}, decisivo a ${r.pointsDecidingSet}`;
  return `${SPORT_LABEL[r.sport]} · al mejor de ${r.bestOf} · ${sets}${r.scoring === "sideout" ? " · con cambio de saque" : ""}`;
}
