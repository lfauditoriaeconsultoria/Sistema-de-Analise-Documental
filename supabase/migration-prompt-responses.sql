-- ============================================================
-- LF Auditoria - Adiciona coluna prompt_responses na tabela reports
-- Execute no SQL Editor do Supabase
-- ============================================================

ALTER TABLE reports
ADD COLUMN IF NOT EXISTS prompt_responses JSONB NOT NULL DEFAULT '[]'::jsonb;
