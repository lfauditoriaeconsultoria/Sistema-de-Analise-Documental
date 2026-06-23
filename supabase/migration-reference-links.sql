-- ============================================================
-- LF Auditoria - Migration Reference Links
-- Links externos cadastrados na Base de Conhecimento
-- Execute no SQL Editor do Supabase
-- ============================================================

CREATE TABLE IF NOT EXISTS public.reference_links (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  url         text        NOT NULL,
  description text,
  content     text,
  uploaded_by uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.reference_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reference_links_select" ON public.reference_links
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "reference_links_write_admin" ON public.reference_links
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );
