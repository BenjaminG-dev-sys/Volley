export const CATEGORIES = ["Sub-15", "Sub-17", "Sub-19", "Sub-21", "Mayores", "Master"] as const;
export type Category = (typeof CATEGORIES)[number];

export const BRANCHES = { femenino: "Femenino", masculino: "Masculino", mixto: "Mixto" } as const;
export type Branch = keyof typeof BRANCHES;

/** Edad máxima cumplida en el año de la temporada para cada categoría formativa. */
const MAX_AGE: Partial<Record<Category, number>> = {
  "Sub-15": 14,
  "Sub-17": 16,
  "Sub-19": 18,
  "Sub-21": 20,
};
const MASTER_MIN_AGE = 35;

/**
 * Verifica si una persona nacida en `birthDate` (YYYY-MM-DD) puede jugar la categoría
 * en la temporada `season`. Se usa la edad que cumple durante el año de la temporada.
 */
export function validateCategoryAge(category: Category, birthDate: string, season: number): string | null {
  const birthYear = Number(birthDate.slice(0, 4));
  if (!birthYear) return "Fecha de nacimiento inválida.";
  const age = season - birthYear;
  const max = MAX_AGE[category];
  if (max !== undefined && age > max) return `Supera la edad de ${category} (nacidos desde ${season - max}).`;
  if (category === "Master" && age < MASTER_MIN_AGE) return `Master requiere ${MASTER_MIN_AGE} años o más.`;
  return null;
}
