-- ============================================================
-- LF Auditoria - Migration: histórico de checklists gerados
-- Execute no SQL Editor do Supabase (ordem: tabela → bucket → policies)
-- ============================================================

-- ── 1. Tabela de histórico ──────────────────────────────────

CREATE TABLE IF NOT EXISTS public.checklist_history (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  cliente     text        NOT NULL,
  criterio    text        NOT NULL,
  filename    text        NOT NULL,
  items_count integer     NOT NULL DEFAULT 0,
  file_path   text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.checklist_history ENABLE ROW LEVEL SECURITY;

-- Colaborador vê e exclui somente os próprios registros
CREATE POLICY "checklist_history_select_own" ON public.checklist_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "checklist_history_insert" ON public.checklist_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "checklist_history_delete_own" ON public.checklist_history
  FOR DELETE USING (auth.uid() = user_id);

-- Admin pode ver e excluir tudo (usado via service_role no backend)
-- (o admin client bypassa RLS automaticamente com service_role key)

CREATE INDEX IF NOT EXISTS idx_checklist_history_user_created
  ON public.checklist_history(user_id, created_at DESC);

-- ── 2. Storage bucket ──────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'checklists',
  'checklists',
  false,
  52428800,  -- 50 MB
  ARRAY['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
)
ON CONFLICT (id) DO NOTHING;

-- ── 3. Storage policies ────────────────────────────────────
-- O backend usa service_role (admin client) para upload/download,
-- então essas policies cobrem acessos diretos futuros.

CREATE POLICY "checklists_upload_own" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'checklists'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "checklists_read_own" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'checklists'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "checklists_delete_own" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'checklists'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
