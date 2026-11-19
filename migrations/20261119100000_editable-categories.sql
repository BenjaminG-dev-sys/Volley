CREATE TABLE IF NOT EXISTS public.categories (
  name text PRIMARY KEY CHECK (length(btrim(name)) BETWEEN 1 AND 40),
  min_age int CHECK (min_age BETWEEN 1 AND 99),
  max_age int CHECK (max_age BETWEEN 1 AND 99),
  sort int NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (min_age IS NULL OR max_age IS NULL OR min_age <= max_age)
);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.categories TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.categories TO authenticated;

DROP POLICY IF EXISTS categories_read ON public.categories;
CREATE POLICY categories_read ON public.categories FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS categories_staff ON public.categories;
CREATE POLICY categories_staff ON public.categories FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

ALTER TABLE public.tournaments DROP CONSTRAINT IF EXISTS tournaments_category_check;

INSERT INTO public.categories (name, min_age, max_age, sort) VALUES
  ('Sub-15', NULL, 14, 10),
  ('Sub-17', NULL, 16, 20),
  ('Sub-18', NULL, 18, 25),
  ('Sub-19', NULL, 18, 30),
  ('Sub-21', NULL, 20, 40),
  ('Mayores', NULL, NULL, 50),
  ('Senior', NULL, NULL, 60),
  ('Master', 35, NULL, 70),
  ('Master 45', 45, NULL, 80)
ON CONFLICT (name) DO NOTHING;

NOTIFY pgrst, 'reload schema';
