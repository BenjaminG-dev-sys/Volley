// Tipos del motor de planilla electrónica (reglas FIVB núcleo).
// El estado del partido nunca se guarda directamente: se deriva de la lista
// inmutable de eventos con `replay(setup, events)`.

import type { RuleSet } from "./rules";

export type Side = "A" | "B";

export const otherSide = (s: Side): Side => (s === "A" ? "B" : "A");

export interface RosterPlayer {
  number: number;
  name: string;
  libero?: boolean;
  captain?: boolean;
}

export interface MatchSetup {
  bestOf: 3 | 5;
  /** Puntos para ganar un set normal (25) y el set decisivo (15). */
  pointsPerSet?: number;
  pointsDecidingSet?: number;
  teams: Record<Side, { name: string; players: RosterPlayer[] }>;
  /** Reglamento (vóley FIVB si se omite). `bestOf` y los puntos de arriba tienen prioridad. */
  rules?: RuleSet;
}

export type SanctionKind =
  | "warning" // amonestación (amarilla)
  | "penalty" // castigo (roja): punto y saque al rival
  | "expulsion" // expulsión del set
  | "disqualification" // descalificación del partido
  | "delay"; // retraso: se resuelve en amonestación o castigo por retraso

export type ResolvedSanction =
  | Exclude<SanctionKind, "delay">
  | "delay_warning"
  | "delay_penalty";

/** Eventos tal como los produce la mesa de control. */
export type MatchEventInput =
  | { type: "coin_toss"; serving: Side; leftTeam: Side }
  | { type: "lineup"; team: Side; positions: number[]; liberos?: number[] }
  | { type: "point"; team: Side }
  | { type: "timeout"; team: Side }
  | { type: "substitution"; team: Side; out: number; in: number }
  | { type: "libero_in"; team: Side; libero: number; replaced: number }
  | { type: "libero_out"; team: Side }
  | { type: "sanction"; team: Side; kind: SanctionKind; player?: number | null }
  | { type: "undo" }
  /** Reabre un partido cerrado (corrección del staff): anula las firmas y vuelve a "terminado". */
  | { type: "reopen" }
  | { type: "close"; captainA: string; captainB: string; referee: string };

export type MatchEvent = MatchEventInput & { seq: number; ts?: string };

export type Phase =
  | "coin_toss" // falta el sorteo (inicio o set decisivo)
  | "lineups" // falta la formación inicial de uno o ambos equipos
  | "playing"
  | "finished" // partido terminado, falta cierre/firmas
  | "closed";

export interface SubPair {
  starter: number;
  sub: number;
  /** El titular ya regresó a la cancha: la pareja quedó cerrada. */
  returned: boolean;
}

export interface TeamSetState {
  /** Números de camiseta en posiciones I..VI (índice 0 = posición I = sacador). */
  positions: number[];
  starters: number[];
  liberos: number[];
  timeouts: number;
  substitutions: number;
  subPairs: SubPair[];
  /** Jugadores que ingresaron desde la banca en el set (sustituciones y líbero), en orden. */
  entered: number[];
  /** Líbero en cancha y el jugador al que reemplaza. */
  liberoOnCourt: { libero: number; replaced: number } | null;
  /** Índice de rally de la última entrada/salida del líbero (-1 = ninguna). */
  lastLiberoRally: number;
}

export interface Rally {
  winner: Side;
  server: Side;
  serverNumber: number;
  score: Record<Side, number>;
  /** Punto otorgado por sanción (castigo) en lugar de jugada. */
  bySanction?: boolean;
  /** Puntuación con cambio: el receptor ganó la jugada y solo recuperó el saque (sin punto). */
  sideout?: boolean;
}

export interface SetState {
  no: number;
  firstServer: Side;
  score: Record<Side, number>;
  teams: Record<Side, TeamSetState>;
  rallies: Rally[];
  winner: Side | null;
  /** Cambio de cancha del set decisivo (a los 8 puntos) ya realizado. */
  switchedAtEight: boolean;
}

export interface SanctionRecord {
  set: number;
  team: Side;
  kind: ResolvedSanction;
  player: number | null;
  score: Record<Side, number>;
}

export interface LogEntry {
  seq: number;
  set: number;
  text: string;
  score: Record<Side, number>;
}

export interface MatchState {
  phase: Phase;
  /** Reglamento efectivo del partido (no cambia durante el partido). */
  rules: RuleSet;
  bestOf: 3 | 5;
  setsWon: Record<Side, number>;
  sets: SetState[];
  /** Set en curso (1..5). */
  currentSet: number;
  serving: Side | null;
  /** Equipo ubicado a la izquierda de la mesa de control. */
  leftTeam: Side;
  pendingLineups: Partial<Record<Side, { positions: number[]; liberos: number[] }>>;
  /** Primer sacador del set decisivo, decidido por sorteo. */
  decidingToss: { serving: Side; leftTeam: Side } | null;
  sanctions: SanctionRecord[];
  /** Jugadores expulsados del set en curso / descalificados del partido. */
  expelled: Record<Side, number[]>;
  disqualified: Record<Side, number[]>;
  winner: Side | null;
  signatures: { captainA: string; captainB: string; referee: string } | null;
  /** Aviso puntual para la mesa (p. ej. cambio de cancha). */
  notice: string | null;
  log: LogEntry[];
  lastSeq: number;
}

export class RuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RuleError";
  }
}
