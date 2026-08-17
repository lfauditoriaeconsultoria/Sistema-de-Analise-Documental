-- ================================================================
-- Bucket para upload direto de documentos (contorna limite 4.5 MB do Vercel)
-- Os arquivos são enviados pelo browser diretamente ao Supabase Storage,
-- sem passar pela API do Vercel. Após o processamento o servidor os deleta.
-- ================================================================
-- EXECUTE NO SUPABASE SQL EDITOR ANTES DE USAR A FUNCIONALIDADE

-- 1. Cria o bucket (privado, 20 MB por arquivo)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'checklist-uploads',
  'checklist-uploads',
  false,
  20971520,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'text/plain',
    'text/markdown',
    'text/csv'
  ]
)
on conflict (id) do nothing;

-- 2. Habilita RLS no bucket
alter table storage.objects enable row level security;

-- 3. Usuário autenticado pode fazer upload na própria pasta (userId/arquivo)
create policy "checklist_uploads_insert"
on storage.objects for insert
with check (
  bucket_id = 'checklist-uploads'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- 4. Usuário pode ler seus próprios arquivos
create policy "checklist_uploads_select"
on storage.objects for select
using (
  bucket_id = 'checklist-uploads'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- 5. Usuário pode deletar seus próprios arquivos (limpeza opcional)
create policy "checklist_uploads_delete"
on storage.objects for delete
using (
  bucket_id = 'checklist-uploads'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);
-- Nota: o service_role (servidor) ignora RLS por padrão e pode ler/deletar tudo
