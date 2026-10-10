// Posiciones FIVB: índice 0..5 = posiciones I..VI.
// Delanteros: II, III, IV (índices 1, 2, 3). Zagueros: I, V, VI (índices 0, 4, 5).

export const POSITION_LABELS = ["I", "II", "III", "IV", "V", "VI"] as const;

export const BACK_ROW = [0, 4, 5] as const;
export const FRONT_ROW = [1, 2, 3] as const;

export const isBackRow = (index: number) => index === 0 || index === 4 || index === 5;

/**
 * Rotación en sentido horario al recuperar el saque:
 * el jugador de II pasa a I (y saca), I pasa a VI, VI a V, V a IV, IV a III, III a II.
 */
export function rotate(positions: number[]): number[] {
  return positions.map((_, i) => positions[(i + 1) % 6]);
}

/** Índice de la posición V: si el líbero está ahí, al rotar pasaría a delantera (IV). */
export const LIBERO_EXIT_INDEX = 4;
