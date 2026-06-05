-- ============================================================
-- LF Auditoria - Storage bucket para imagens de análise
-- Execute no SQL Editor do Supabase
-- ============================================================

-- Criar bucket analysis-images (privado, max 25MB)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'analysis-images',
  'analysis-images',
  false,
  26214400,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Política: usuário faz upload somente na própria pasta
CREATE POLICY "Users can upload own analysis images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'analysis-images'
  AND (string_to_array(name, '/'))[1] = auth.uid()::text
);

-- Política: usuário lê somente seus arquivos
CREATE POLICY "Users can read own analysis images"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'analysis-images'
  AND (string_to_array(name, '/'))[1] = auth.uid()::text
);

-- Política: usuário deleta somente seus arquivos
CREATE POLICY "Users can delete own analysis images"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'analysis-images'
  AND (string_to_array(name, '/'))[1] = auth.uid()::text
);
