-- ============================================================
-- LF Auditoria - Migration OEA Subtopics de Conformidade
-- Adiciona os subtemas 15 a 22 na tabela subtopics para o OEA
-- Execute no SQL Editor do Supabase
-- ============================================================

-- Usa o ID do tema OEA para inserir os subtemas faltantes
INSERT INTO public.subtopics (theme_id, name, description, is_active)
SELECT
  t.id,
  v.name,
  v.description,
  true
FROM public.themes t,
(VALUES
  ('15 - Classificação Fiscal de Mercadorias',   'Correta aplicação da NCM e das regras de classificação tarifária nas operações'),
  ('16 - Origem das Mercadorias',                'Verificação, documentação e utilização correta dos certificados de origem'),
  ('17 - Aspectos Cambiais',                     'Cumprimento das normas cambiais aplicáveis às operações de importação e exportação'),
  ('18 - Base de Cálculo de Tributos',           'Declaração correta do valor aduaneiro e dos tributos incidentes nas operações'),
  ('19 - Imunidades, Isenções e Regimes Especiais', 'Utilização correta de benefícios fiscais e regimes aduaneiros especiais'),
  ('20 - Operações Indiretas e Partes Relacionadas', 'Controle e documentação de operações triangulares, intercompany e por conta de terceiros'),
  ('21 - Qualificação de Profissionais',         'Habilitação e capacitação contínua dos profissionais de comércio exterior'),
  ('22 - Gerenciamento de Riscos Aduaneiros',    'Identificação, monitoramento e reporte de riscos aduaneiros à alta administração')
) AS v(name, description)
WHERE t.name = 'OEA'
  AND NOT EXISTS (
    SELECT 1 FROM public.subtopics s
    WHERE s.theme_id = t.id
      AND s.name = v.name
  );
