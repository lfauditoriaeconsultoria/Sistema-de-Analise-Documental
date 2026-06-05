-- ============================================================
-- Fix RLS: substituir auth.role() = 'authenticated'
-- por TO authenticated USING (true), que é mais confiável
-- Execute no SQL Editor do Supabase
-- ============================================================

-- Themes
DROP POLICY IF EXISTS "themes_select" ON public.themes;
CREATE POLICY "themes_select" ON public.themes
  FOR SELECT TO authenticated USING (true);

-- Subtopics
DROP POLICY IF EXISTS "subtopics_select" ON public.subtopics;
CREATE POLICY "subtopics_select" ON public.subtopics
  FOR SELECT TO authenticated USING (true);

-- Reference documents
DROP POLICY IF EXISTS "refdocs_select" ON public.reference_documents;
CREATE POLICY "refdocs_select" ON public.reference_documents
  FOR SELECT TO authenticated USING (true);

-- Reference prompts
DROP POLICY IF EXISTS "prompts_select" ON public.reference_prompts;
CREATE POLICY "prompts_select" ON public.reference_prompts
  FOR SELECT TO authenticated USING (true);
