export interface CategoryDef {
  name: string;
  min_age: number | null;
  max_age: number | null;
  sort?: number;
}

export const DEFAULT_CATEGORIES: CategoryDef[] = [
  { name: "Sub-15", min_age: null, max_age: 14, sort: 10 },
  { name: "Sub-17", min_age: null, max_age: 16, sort: 20 },
  { name: "Sub-18", min_age: null, max_age: 18, sort: 25 },
  { name: "Sub-19", min_age: null, max_age: 18, sort: 30 },
  { name: "Sub-21", min_age: null, max_age: 20, sort: 40 },
  { name: "Mayores", min_age: null, max_age: null, sort: 50 },
  { name: "Senior", min_age: null, max_age: null, sort: 60 },
  { name: "Master", min_age: 35, max_age: null, sort: 70 },
  { name: "Master 45", min_age: 45, max_age: null, sort: 80 },
];

export const BRANCHES = { femenino: "Femenino", masculino: "Masculino", mixto: "Mixto" } as const;
export type Branch = keyof typeof BRANCHES;

export function findCategory(category: string | CategoryDef, list: CategoryDef[] = DEFAULT_CATEGORIES): CategoryDef | null {
  if (typeof category !== "string") return category;
  const key = category.trim().toLowerCase();
  return list.find((c) => c.name.toLowerCase() === key) ?? null;
}

export function ageRuleText(c: CategoryDef, season?: number): string {
  const parts: string[] = [];
  if (c.max_age != null) parts.push(`hasta ${c.max_age} años${season ? ` (nacidos desde ${season - c.max_age})` : ""}`);
  if (c.min_age != null) parts.push(`desde ${c.min_age} años${season ? ` (nacidos hasta ${season - c.min_age})` : ""}`);
  return parts.length ? parts.join(" y ") : "sin límite de edad";
}

export function validateCategoryAge(
  category: string | CategoryDef,
  birthDate: string,
  season: number,
  list: CategoryDef[] = DEFAULT_CATEGORIES,
): string | null {
  const def = findCategory(category, list);
  if (!def) return null;
  const birthYear = Number(String(birthDate ?? "").slice(0, 4));
  if (!birthYear) return `${def.name} pide fecha de nacimiento.`;
  const age = season - birthYear;
  if (def.max_age != null && age > def.max_age)
    return `Supera la edad de ${def.name}: máximo ${def.max_age} años (nacidos desde ${season - def.max_age}).`;
  if (def.min_age != null && age < def.min_age)
    return `${def.name} requiere ${def.min_age} años o más (nacidos hasta ${season - def.min_age}).`;
  return null;
}

export function parseAge(v: string): number | null {
  const t = v.trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isInteger(n) || n < 1 || n > 99) throw new Error("La edad debe ser un número entre 1 y 99.");
  return n;
}
