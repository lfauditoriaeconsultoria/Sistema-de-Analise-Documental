-- Adiciona campo de versão aos documentos de referência
ALTER TABLE reference_documents
  ADD COLUMN IF NOT EXISTS version TEXT;
