-- ============================================================
-- LF Auditoria - Migration v2
-- Execute no SQL Editor do Supabase
-- ============================================================

-- 1. Remove subtemas antigos OEA e LGPD (nova lista entra abaixo)
DELETE FROM public.subtopics
WHERE theme_id IN (SELECT id FROM public.themes WHERE name IN ('OEA', 'LGPD'));

-- 2. Adiciona tema "Outros" para temas personalizados
INSERT INTO public.themes (name, description, color, icon) VALUES
  ('Outros', 'Tema personalizado — especifique o tema ao iniciar a análise', '#64748B', 'file')
ON CONFLICT (name) DO NOTHING;

-- 3. Novos subtemas OEA (00 – 14)
INSERT INTO public.subtopics (theme_id, name, description)
SELECT t.id, s.name, s.description
FROM public.themes t,
(VALUES
  ('00 - Informações Gerais do Interveniente',    'Dados cadastrais, estrutura e natureza jurídica do interveniente'),
  ('01 - Admissibilidade',                         'Critérios de admissibilidade e elegibilidade para certificação OEA'),
  ('02 - Histórico de Cumprimento da Legislação Nacional', 'Histórico de conformidade tributária, aduaneira e regulatória'),
  ('03 - Viabilidade Financeira',                  'Capacidade e solidez financeira do operador'),
  ('04 - Sistema Satisfatório de Gestão de Registros Comerciais', 'Controles de registros contábeis, fiscais e comerciais'),
  ('05 - Segurança da Informação',                 'Proteção de sistemas, dados e infraestrutura de TI'),
  ('06 - Segurança dos Recursos Humanos',          'Processos de contratação, treinamento e controle de pessoal'),
  ('07 - Cooperação e Comunicação',                'Fluxos de comunicação interna e cooperação com autoridades'),
  ('08 - Visão de Segurança, Avaliação de Riscos e Melhoria', 'Gestão de riscos, auditorias e melhoria contínua'),
  ('09 - Segurança da Carga',                      'Procedimentos de segurança no manuseio e rastreio de cargas'),
  ('10 - Segurança do Transporte',                 'Controles de segurança nos meios e rotas de transporte'),
  ('11 - Segurança Física das Instalações',        'Perímetros, acessos e controles físicos das instalações'),
  ('12 - Educação, Treinamento e Conscientização', 'Programas de treinamento e conscientização em segurança'),
  ('13 - Gestão de Parceiros Comerciais',          'Verificação e controle da cadeia de parceiros e fornecedores'),
  ('14 - Gestão de Crises e Recuperação de Incidentes', 'Planos de contingência e resposta a incidentes')
) AS s(name, description)
WHERE t.name = 'OEA'
ON CONFLICT DO NOTHING;

-- 4. Novos subtemas LGPD
INSERT INTO public.subtopics (theme_id, name, description)
SELECT t.id, s.name, s.description
FROM public.themes t,
(VALUES
  ('Contratos de Clientes',     'Análise de conformidade LGPD em contratos firmados com clientes'),
  ('Contratos de Fornecedores', 'Análise de conformidade LGPD em contratos firmados com fornecedores'),
  ('Contratos de Trabalho',     'Análise de conformidade LGPD em contratos e documentos trabalhistas')
) AS s(name, description)
WHERE t.name = 'LGPD'
ON CONFLICT DO NOTHING;

-- 5. Adiciona colunas de personalização na tabela analyses
ALTER TABLE public.analyses
  ADD COLUMN IF NOT EXISTS custom_theme_name text,
  ADD COLUMN IF NOT EXISTS custom_subtopic_name text;

-- 6. Tabela de prompts / textos auxiliares configurados pelo admin
CREATE TABLE IF NOT EXISTS public.reference_prompts (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  theme_id     uuid        REFERENCES public.themes(id) ON DELETE CASCADE,
  subtopic_id  uuid        REFERENCES public.subtopics(id) ON DELETE SET NULL,
  title        text        NOT NULL,
  content      text        NOT NULL,
  is_active    boolean     NOT NULL DEFAULT true,
  created_by   uuid        REFERENCES public.profiles(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- 7. RLS para reference_prompts
ALTER TABLE public.reference_prompts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prompts_select" ON public.reference_prompts
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "prompts_write_admin" ON public.reference_prompts
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );
