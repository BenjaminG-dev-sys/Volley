ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;
GRANT UPDATE (display_name, role, must_change_password) ON public.profiles TO authenticated;
