import "server-only";

import { serverClient } from "@/lib/insforge/server";
import { DEFAULT_CATEGORIES, type CategoryDef } from "./categories";

const SCHEMA_SQL = [
  `CREATE TABLE IF NOT EXISTS public.categories (
    name text PRIMARY KEY CHECK (length(btrim(name)) BETWEEN 1 AND 40),
    min_age int CHECK (min_age BETWEEN 1 AND 99),
    max_age int CHECK (max_age BETWEEN 1 AND 99),
    sort int NOT NULL DEFAULT 100,
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK (min_age IS NULL OR max_age IS NULL OR min_age <= max_age)
  )`,
  `ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY`,
  `GRANT SELECT ON public.categories TO anon, authenticated`,
  `GRANT INSERT, UPDATE, DELETE ON public.categories TO authenticated`,
  `DROP POLICY IF EXISTS categories_read ON public.categories`,
  `CREATE POLICY categories_read ON public.categories FOR SELECT TO anon, authenticated USING (true)`,
  `DROP POLICY IF EXISTS categories_staff ON public.categories`,
  `CREATE POLICY categories_staff ON public.categories FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff())`,
  `ALTER TABLE public.tournaments DROP CONSTRAINT IF EXISTS tournaments_category_check`,
  `INSERT INTO public.categories (name, min_age, max_age, sort) VALUES ${DEFAULT_CATEGORIES.map(
    (c) => `('${c.name.replace(/'/g, "''")}', ${c.min_age ?? "NULL"}, ${c.max_age ?? "NULL"}, ${c.sort ?? 100})`,
  ).join(", ")} ON CONFLICT (name) DO NOTHING`,
  `NOTIFY pgrst, 'reload schema'`,
];

let ensuring: Promise<boolean> | null = null;

async function runSchema(): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_INSFORGE_URL;
  const key = process.env.INSFORGE_API_KEY;
  if (!url || !key) return false;
  for (const query of SCHEMA_SQL) {
    const res = await fetch(`${url}/api/database/advance/rawsql`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ query }),
      cache: "no-store",
    });
    if (!res.ok) {
      console.error("categorías: no se pudo preparar la tabla", res.status, await res.text());
      return false;
    }
  }
  await new Promise((r) => setTimeout(r, 800));
  return true;
}

export function ensureCategoriesSchema(): Promise<boolean> {
  if (!ensuring) ensuring = runSchema().then((ok) => (ok ? ok : ((ensuring = null), false)));
  return ensuring;
}

const missingTable = (msg: string) => /categories|relation|schema cache|does not exist|not found/i.test(msg);

async function query() {
  const db = (await serverClient()).database;
  return db.from("categories").select("name, min_age, max_age, sort").order("sort").order("name");
}

export async function listCategories(): Promise<{ list: CategoryDef[]; stored: boolean }> {
  let { data, error } = await query();
  if (error && missingTable(error.message) && (await ensureCategoriesSchema())) ({ data, error } = await query());
  if (error || !data) return { list: DEFAULT_CATEGORIES, stored: false };
  return { list: data as CategoryDef[], stored: true };
}
