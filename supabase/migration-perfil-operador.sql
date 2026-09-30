-- ============================================================
-- LF Auditoria - Migration Módulo Perfil do Operador
-- Execute no SQL Editor do Supabase
-- ============================================================

-- ── 1. Elaborações (uma operação de trabalho) ───────────────

CREATE TABLE IF NOT EXISTS public.perfil_operador_elaborations (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  cliente     text        NOT NULL DEFAULT '',
  status      text        NOT NULL DEFAULT 'rascunho'
                CHECK (status IN ('rascunho', 'documentos', 'gerando', 'revisao', 'concluido')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.update_perfil_operador_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_perfil_operador_elaborations_updated_at ON public.perfil_operador_elaborations;
CREATE TRIGGER trg_perfil_operador_elaborations_updated_at
  BEFORE UPDATE ON public.perfil_operador_elaborations
  FOR EACH ROW EXECUTE FUNCTION public.update_perfil_operador_updated_at();

ALTER TABLE public.perfil_operador_elaborations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "po_elaborations_select" ON public.perfil_operador_elaborations
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "po_elaborations_insert" ON public.perfil_operador_elaborations
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "po_elaborations_update" ON public.perfil_operador_elaborations
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "po_elaborations_delete" ON public.perfil_operador_elaborations
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_po_elaborations_user_created
  ON public.perfil_operador_elaborations(user_id, created_at DESC);

-- ── 2. Itens selecionados dentro de uma elaboração ──────────

CREATE TABLE IF NOT EXISTS public.perfil_operador_items (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  elaboration_id    uuid        NOT NULL REFERENCES public.perfil_operador_elaborations(id) ON DELETE CASCADE,
  criteria_number   integer     NOT NULL,
  criteria_name     text        NOT NULL,
  oea_item_id       uuid        REFERENCES public.oea_items(id) ON DELETE SET NULL,
  item_number       text        NOT NULL,
  item_description  text        NOT NULL,
  resposta          text        NOT NULL DEFAULT '',
  pendencias        jsonb       NOT NULL DEFAULT '[]',
  status            text        NOT NULL DEFAULT 'pendente'
                      CHECK (status IN ('pendente', 'gerado', 'erro')),
  manually_edited   boolean     NOT NULL DEFAULT false,
  generated_at      timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (elaboration_id, criteria_number, item_number)
);

DROP TRIGGER IF EXISTS trg_perfil_operador_items_updated_at ON public.perfil_operador_items;
CREATE TRIGGER trg_perfil_operador_items_updated_at
  BEFORE UPDATE ON public.perfil_operador_items
  FOR EACH ROW EXECUTE FUNCTION public.update_perfil_operador_updated_at();

ALTER TABLE public.perfil_operador_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "po_items_select" ON public.perfil_operador_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.perfil_operador_elaborations e
            WHERE e.id = elaboration_id AND e.user_id = auth.uid())
  );
CREATE POLICY "po_items_insert" ON public.perfil_operador_items
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.perfil_operador_elaborations e
            WHERE e.id = elaboration_id AND e.user_id = auth.uid())
  );
CREATE POLICY "po_items_update" ON public.perfil_operador_items
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.perfil_operador_elaborations e
            WHERE e.id = elaboration_id AND e.user_id = auth.uid())
  );
CREATE POLICY "po_items_delete" ON public.perfil_operador_items
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.perfil_operador_elaborations e
            WHERE e.id = elaboration_id AND e.user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_po_items_elaboration ON public.perfil_operador_items(elaboration_id);

-- ── 3. Documentos enviados na elaboração ────────────────────

CREATE TABLE IF NOT EXISTS public.perfil_operador_documents (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  elaboration_id  uuid        NOT NULL REFERENCES public.perfil_operador_elaborations(id) ON DELETE CASCADE,
  tipo            text        NOT NULL CHECK (tipo IN ('politica', 'evidencia')),
  filename        text        NOT NULL,
  file_path       text        NOT NULL,
  file_size       integer,
  content_text    text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.perfil_operador_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "po_documents_select" ON public.perfil_operador_documents
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.perfil_operador_elaborations e
            WHERE e.id = elaboration_id AND e.user_id = auth.uid())
  );
CREATE POLICY "po_documents_insert" ON public.perfil_operador_documents
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.perfil_operador_elaborations e
            WHERE e.id = elaboration_id AND e.user_id = auth.uid())
  );
CREATE POLICY "po_documents_delete" ON public.perfil_operador_documents
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.perfil_operador_elaborations e
            WHERE e.id = elaboration_id AND e.user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_po_documents_elaboration ON public.perfil_operador_documents(elaboration_id);

-- ── 4. Vínculo N:N documento ↔ item ──────────────────────────

CREATE TABLE IF NOT EXISTS public.perfil_operador_document_items (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id  uuid        NOT NULL REFERENCES public.perfil_operador_documents(id) ON DELETE CASCADE,
  item_id      uuid        NOT NULL REFERENCES public.perfil_operador_items(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id, item_id)
);

ALTER TABLE public.perfil_operador_document_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "po_document_items_select" ON public.perfil_operador_document_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.perfil_operador_documents d
            JOIN public.perfil_operador_elaborations e ON e.id = d.elaboration_id
            WHERE d.id = document_id AND e.user_id = auth.uid())
  );
CREATE POLICY "po_document_items_insert" ON public.perfil_operador_document_items
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.perfil_operador_documents d
            JOIN public.perfil_operador_elaborations e ON e.id = d.elaboration_id
            WHERE d.id = document_id AND e.user_id = auth.uid())
  );
CREATE POLICY "po_document_items_delete" ON public.perfil_operador_document_items
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.perfil_operador_documents d
            JOIN public.perfil_operador_elaborations e ON e.id = d.elaboration_id
            WHERE d.id = document_id AND e.user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_po_doc_items_document ON public.perfil_operador_document_items(document_id);
CREATE INDEX IF NOT EXISTS idx_po_doc_items_item     ON public.perfil_operador_document_items(item_id);

-- ── 5. Storage bucket para os documentos da elaboração ──────
-- Diferente do "checklist-uploads" (temporário), este bucket é PERMANENTE:
-- os arquivos continuam disponíveis durante toda a vida da elaboração, para
-- reuso em vários itens e para "visualizar" o documento original depois.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'perfil-operador-uploads',
  'perfil-operador-uploads',
  false,
  20971520,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/png',
    'image/jpeg',
    'text/plain',
    'text/markdown',
    'text/csv'
  ]
)
on conflict (id) do nothing;

-- Caminho dos arquivos: {userId}/{elaborationId}/{uuid}-{filename}
-- (a 1ª pasta precisa ser o userId para bater com a política RLS abaixo)

create policy "po_uploads_insert"
on storage.objects for insert
with check (
  bucket_id = 'perfil-operador-uploads'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "po_uploads_select"
on storage.objects for select
using (
  bucket_id = 'perfil-operador-uploads'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "po_uploads_delete"
on storage.objects for delete
using (
  bucket_id = 'perfil-operador-uploads'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);
-- Nota: o service_role (servidor) ignora RLS por padrão e pode ler/deletar tudo.
