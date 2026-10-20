// CSV mínimo (RFC 4180) y validación de nóminas importadas.

import { validateCedula } from "@/lib/tournament/cedula";
import { type Category, validateCategoryAge } from "@/lib/tournament/categories";

/** Separa un CSV en filas; acepta `,` o `;` (Excel en español) y comillas dobles. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const firstLine = src.split(/\r?\n/, 1)[0] ?? "";
  const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((x) => x.trim() !== "")) rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim() !== "")) rows.push(row);
  return rows;
}

/** CSV con BOM (para que Excel abra bien los acentos) y `;` como separador. */
export function toCsv(rows: (string | number | null | undefined)[][]): string {
  const esc = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + rows.map((r) => r.map(esc).join(";")).join("\r\n") + "\r\n";
}

export interface RosterRow {
  first_name: string;
  last_name: string;
  cedula: string;
  birth_date: string;
  number: number;
  position: string | null;
  is_libero: boolean;
  is_captain: boolean;
}

const norm = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z]/g, "");

const HEADERS: Record<string, keyof RosterRow> = {
  nombres: "first_name",
  nombre: "first_name",
  apellidos: "last_name",
  apellido: "last_name",
  cedula: "cedula",
  fechadenacimiento: "birth_date",
  nacimiento: "birth_date",
  numero: "number",
  dorsal: "number",
  posicion: "position",
  libero: "is_libero",
  capitan: "is_captain",
};

const COLUMN_LABEL: Record<string, string> = {
  first_name: "Nombres",
  last_name: "Apellidos",
  cedula: "Cédula",
  birth_date: "Fecha de nacimiento",
  number: "Número",
};

const yes = (v: string) => ["si", "sí", "x", "1", "true"].includes(v.trim().toLowerCase());

/** Fecha `AAAA-MM-DD` o `DD/MM/AAAA` → `AAAA-MM-DD`; null si no es válida. */
export function parseDate(v: string): string | null {
  const s = v.trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  let y: number, mo: number, d: number;
  if (m) [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  else if ((m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/))) [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  else return null;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return dt.toISOString().slice(0, 10);
}

/**
 * Valida una nómina en CSV con encabezados (Nombres; Apellidos; Cédula; Fecha de nacimiento; Número;
 * Posición; Líbero; Capitán). Devuelve las filas válidas y los errores por fila (1 = primera fila de datos).
 */
export function parseRoster(
  text: string,
  opts: { positions: readonly string[]; allowLibero: boolean; existingNumbers?: number[]; category?: Category; season?: number },
): { rows: RosterRow[]; errors: { line: number; message: string }[] } {
  const [header, ...data] = parseCsv(text);
  const errors: { line: number; message: string }[] = [];
  if (!header) return { rows: [], errors: [{ line: 0, message: "El archivo está vacío." }] };
  const cols = header.map((h) => HEADERS[norm(h)]);
  for (const req of ["first_name", "last_name", "cedula", "birth_date", "number"] as const)
    if (!cols.includes(req)) errors.push({ line: 0, message: `Falta la columna ${COLUMN_LABEL[req]}.` });
  if (errors.length) return { rows: [], errors };

  const rows: RosterRow[] = [];
  const numbers = new Set(opts.existingNumbers ?? []);
  const cedulas = new Set<string>();
  data.forEach((cells, i) => {
    const line = i + 1;
    const get = (k: keyof RosterRow) => (cells[cols.indexOf(k)] ?? "").trim();
    const problems: string[] = [];
    const cedula = get("cedula").replace(/\D/g, "");
    const cedErr = validateCedula(cedula);
    if (cedErr) problems.push(`cédula: ${cedErr}`);
    else if (cedulas.has(cedula)) problems.push("cédula repetida en el archivo");
    const birth = parseDate(get("birth_date"));
    if (!birth) problems.push("fecha de nacimiento inválida");
    else if (opts.category && opts.season) {
      const ageErr = validateCategoryAge(opts.category, birth, opts.season);
      if (ageErr) problems.push(ageErr);
    }
    const number = Number(get("number"));
    if (!Number.isInteger(number) || number < 1 || number > 99) problems.push("número fuera de 1–99");
    else if (numbers.has(number)) problems.push(`el número ${number} ya está usado`);
    const position = norm(get("position")) || null;
    if (position && !opts.positions.includes(position)) problems.push(`posición "${get("position")}" no válida`);
    const isLibero = get("is_libero") ? yes(get("is_libero")) : false;
    if (isLibero && !opts.allowLibero) problems.push("este deporte no usa líbero");
    if (!get("first_name") || !get("last_name")) problems.push("faltan nombres o apellidos");
    if (problems.length) {
      errors.push({ line, message: problems.join("; ") });
      return;
    }
    numbers.add(number);
    cedulas.add(cedula);
    rows.push({
      first_name: get("first_name"),
      last_name: get("last_name"),
      cedula,
      birth_date: birth!,
      number,
      position: isLibero ? "libero" : position,
      is_libero: isLibero,
      is_captain: get("is_captain") ? yes(get("is_captain")) : false,
    });
  });
  return { rows, errors };
}
