-- Tabela de relatórios de auditoria OEA
CREATE TABLE IF NOT EXISTS audit_reports (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  empresa     TEXT NOT NULL DEFAULT '',
  criterio    TEXT NOT NULL DEFAULT '',
  emissao     TEXT NOT NULL DEFAULT '',
  report_data JSONB NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Atualiza updated_at automaticamente
CREATE OR REPLACE FUNCTION update_audit_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_reports_updated_at
  BEFORE UPDATE ON audit_reports
  FOR EACH ROW EXECUTE FUNCTION update_audit_reports_updated_at();

-- Row Level Security
ALTER TABLE audit_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_reports_select" ON audit_reports
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "audit_reports_insert" ON audit_reports
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "audit_reports_update" ON audit_reports
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "audit_reports_delete" ON audit_reports
  FOR DELETE USING (auth.uid() = user_id);

-- Índice para listagem por usuário
CREATE INDEX IF NOT EXISTS idx_audit_reports_user_created
  ON audit_reports(user_id, created_at DESC);
