-- ═══════════════════════════════════════════════════════════════════════════
-- Migração: histórico de avaliações de evidências (Etapa 2)
-- Executar no SQL Editor do Supabase antes de usar a funcionalidade.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Tabela de histórico ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.evaluate_history (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  criterio    text,
  cliente     text,
  filename    text        NOT NULL,
  items_count integer     NOT NULL DEFAULT 0,
  nc_count    integer     NOT NULL DEFAULT 0,
  file_path   text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ── RLS ──────────────────────────────────────────────────────────────────
ALTER TABLE public.evaluate_history ENABLE ROW LEVEL SECURITY;

-- Colaboradores veem apenas os próprios registros
CREATE POLICY "own_evaluate_history" ON public.evaluate_history
  FOR ALL USING (auth.uid() = user_id);

-- ── Storage: bucket para planilhas preenchidas ────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'evaluations',
  'evaluations',
  false,
  52428800,  -- 50 MB
  ARRAY['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
)
ON CONFLICT (id) DO NOTHING;

-- Usuário pode fazer upload/download/delete dos próprios arquivos
CREATE POLICY "own_evaluations_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'evaluations' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "own_evaluations_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'evaluations' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "own_evaluations_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'evaluations' AND (storage.foldername(name))[1] = auth.uid()::text);
