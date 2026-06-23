-- ============================================================
-- LF Auditoria - Migration OEA Critérios de Conformidade
-- Adiciona os critérios 15 a 22 da IN RFB Nº 2.154/2023
-- Execute no SQL Editor do Supabase caso só existam 14 critérios
-- ============================================================

-- Insere critérios 15-22 (ON CONFLICT garante idempotência)
INSERT INTO public.oea_criteria (number, name, description, category) VALUES
  (15, 'Classificação Fiscal de Mercadorias',                                 'Correta aplicação da NCM e das regras de classificação tarifária nas operações',                                                         'conformidade'),
  (16, 'Origem das Mercadorias',                                              'Verificação, documentação e utilização correta dos certificados de origem',                                                              'conformidade'),
  (17, 'Aspectos Cambiais',                                                   'Cumprimento das normas cambiais aplicáveis às operações de importação e exportação',                                                     'conformidade'),
  (18, 'Base de Cálculo de Tributos Incidentes no Comércio Exterior',        'Declaração correta do valor aduaneiro e dos tributos incidentes nas operações',                                                          'conformidade'),
  (19, 'Imunidades, Isenções, Reduções de Alíquotas e Regimes Especiais',    'Utilização correta de benefícios fiscais e regimes aduaneiros especiais',                                                               'conformidade'),
  (20, 'Operações Indiretas, por Conta e Ordem e com Partes Relacionadas',   'Controle e documentação de operações triangulares, intercompany e por conta de terceiros',                                              'conformidade'),
  (21, 'Qualificação de Profissionais Ligados ao Comércio Exterior',         'Habilitação e capacitação contínua dos profissionais responsáveis pelas operações aduaneiras',                                           'conformidade'),
  (22, 'Gerenciamento de Riscos Aduaneiros',                                  'Identificação, monitoramento e reporte de riscos aduaneiros à alta administração',                                                      'conformidade')
ON CONFLICT (number) DO UPDATE SET
  name        = EXCLUDED.name,
  description = EXCLUDED.description,
  category    = EXCLUDED.category;

-- ── Itens do Critério 15 ─────────────────────────────────────
INSERT INTO public.oea_items (criteria_id, item_number, description)
SELECT c.id, v.item_number, v.description
FROM public.oea_criteria c,
(VALUES
  ('15.1', 'O OEA deve possuir procedimento formalizado para descrever a mercadoria nas declarações aduaneiras com todas as informações necessárias à sua identificação e para enquadrá-la no código correto na Nomenclatura Comum do Mercosul.'),
  ('15.2', 'O OEA deve possuir procedimento formalizado para assegurar os controles adicionais relacionados à classificação fiscal da mercadoria, em especial: - a aplicação do tratamento administrativo, conforme a classificação fiscal da mercadoria; - a correta utilização de ex-tarifário, quando for o caso; - a correta utilização da Unidade de Medida Estatística determinada pela legislação; - a aplicação das medidas de defesa comercial, quando for o caso.'),
  ('15.3', 'O OEA deve possuir procedimento formalizado para assegurar que, em caso de dúvida ou divergência com a Aduana quanto à classificação fiscal de uma mercadoria, seja formulada consulta, nos termos da legislação vigente, no âmbito da Secretaria da Receita Federal do Brasil.'),
  ('15.4', 'O OEA deve assegurar que a descrição e a classificação das mercadorias constantes dos documentos fiscais e não fiscais e dos registros informatizados, sejam uniformes, permitindo a rastreabilidade dessas mercadorias.'),
  ('15.5', 'O OEA deve revisar e atualizar periodicamente os procedimentos formalizados relacionados aos requisitos deste critério.')
) AS v(item_number, description)
WHERE c.number = 15
ON CONFLICT (criteria_id, item_number) DO UPDATE SET description = EXCLUDED.description;

-- ── Itens do Critério 16 ─────────────────────────────────────
INSERT INTO public.oea_items (criteria_id, item_number, description)
SELECT c.id, v.item_number, v.description
FROM public.oea_criteria c,
(VALUES
  ('16.1', 'O OEA deve possuir procedimento formalizado para assegurar a correta aplicação de tratamentos tarifários preferenciais, em conformidade com a legislação aplicável. O procedimento deve assegurar ainda a correta utilização de certificados de origem das mercadorias importadas.'),
  ('16.2', 'O OEA deve possuir procedimento formalizado para assegurar a correta aplicação das medidas de defesa comercial vigentes, em conformidade com a legislação aplicável.'),
  ('16.3', 'O OEA deve possuir procedimento formalizado para certificação de origem de mercadorias a exportar, em conformidade com a legislação aplicável.'),
  ('16.4', 'O OEA deve revisar e atualizar periodicamente os procedimentos formalizados relativos às regras de origem preferenciais e não preferenciais.')
) AS v(item_number, description)
WHERE c.number = 16
ON CONFLICT (criteria_id, item_number) DO UPDATE SET description = EXCLUDED.description;

-- ── Itens do Critério 17 ─────────────────────────────────────
INSERT INTO public.oea_items (criteria_id, item_number, description)
SELECT c.id, v.item_number, v.description
FROM public.oea_criteria c,
(VALUES
  ('17.1', 'O OEA deve possuir procedimento formalizado para tratamento, registro e controle dos aspectos cambiais das operações aduaneiras: - o pagamento das importações; - o recebimento das exportações; e - o registro adequado de operações sem cobertura cambial. O procedimento deve assegurar ainda que a modalidade cambial de cada operação seja corretamente informada nas declarações aduaneiras e que sejam mantidos os registros dos contratos de câmbio correlacionados com suas respectivas declarações aduaneiras.'),
  ('17.2', 'O OEA deve revisar e atualizar periodicamente os procedimentos formalizados relativos aos aspectos cambiais das declarações aduaneiras.')
) AS v(item_number, description)
WHERE c.number = 17
ON CONFLICT (criteria_id, item_number) DO UPDATE SET description = EXCLUDED.description;

-- ── Itens do Critério 18 ─────────────────────────────────────
INSERT INTO public.oea_items (criteria_id, item_number, description)
SELECT c.id, v.item_number, v.description
FROM public.oea_criteria c,
(VALUES
  ('18.1', 'O OEA deve possuir procedimento formalizado para a determinação da base de cálculo dos tributos informada nas declarações aduaneiras. O procedimento deverá incluir as etapas para a correta determinação do valor aduaneiro, conforme as disposições do Acordo de Valoração Aduaneira e legislação tributária vigente.'),
  ('18.2', 'O OEA deve revisar e atualizar periodicamente o procedimento formalizado para a determinação da base de cálculo dos tributos.')
) AS v(item_number, description)
WHERE c.number = 18
ON CONFLICT (criteria_id, item_number) DO UPDATE SET description = EXCLUDED.description;

-- ── Itens do Critério 19 ─────────────────────────────────────
INSERT INTO public.oea_items (criteria_id, item_number, description)
SELECT c.id, v.item_number, v.description
FROM public.oea_criteria c,
(VALUES
  ('19.1', 'O OEA deve possuir procedimentos formalizados para que a execução das atividades de solicitação, fruição e extinção de benefícios fiscais, suspensões tributárias e imunidades ocorram de acordo com a legislação de regência.'),
  ('19.2', 'O OEA deve revisar e atualizar periodicamente os procedimentos formalizados para fruição de benefícios, suspensões tributárias e imunidades.')
) AS v(item_number, description)
WHERE c.number = 19
ON CONFLICT (criteria_id, item_number) DO UPDATE SET description = EXCLUDED.description;

-- ── Itens do Critério 20 ─────────────────────────────────────
INSERT INTO public.oea_items (criteria_id, item_number, description)
SELECT c.id, v.item_number, v.description
FROM public.oea_criteria c,
(VALUES
  ('20.1', 'O OEA deve possuir procedimento formalizado para assegurar que a aquisição de mercadorias de origem estrangeira no mercado interno não configure importação por encomenda ou por conta e ordem, sem a correta prestação de informações sobre importador e adquirente nas declarações aduaneiras.'),
  ('20.2', 'O OEA deve possuir procedimento formalizado para venda, no mercado interno, de mercadorias importadas. O procedimento deve conter regras que assegurem que a venda, no mercado interno, de mercadorias importadas, não configure importação por encomenda ou por conta e ordem ou, caso configure, que a operação seja corretamente declarada.'),
  ('20.3', 'O OEA deve possuir procedimento formalizado para assegurar que as operações de exportação por conta e ordem cumpram a legislação aplicável.'),
  ('20.4', 'O OEA deve revisar e atualizar periodicamente os procedimentos formalizados para a realização das operações indiretas.')
) AS v(item_number, description)
WHERE c.number = 20
ON CONFLICT (criteria_id, item_number) DO UPDATE SET description = EXCLUDED.description;

-- ── Itens do Critério 21 ─────────────────────────────────────
INSERT INTO public.oea_items (criteria_id, item_number, description)
SELECT c.id, v.item_number, v.description
FROM public.oea_criteria c,
(VALUES
  ('21.1', 'O OEA deve possuir política de qualificação de pessoal ligado a atividades relacionadas com o cumprimento da legislação aduaneira.'),
  ('21.2', 'A política de qualificação de pessoal deverá prever revisão anual das necessidades de treinamento. Caso ocorram alterações nas operações da organização ou na legislação aduaneira, a revisão deverá ser realizada em menor período.')
) AS v(item_number, description)
WHERE c.number = 21
ON CONFLICT (criteria_id, item_number) DO UPDATE SET description = EXCLUDED.description;

-- ── Itens do Critério 22 ─────────────────────────────────────
INSERT INTO public.oea_items (criteria_id, item_number, description)
SELECT c.id, v.item_number, v.description
FROM public.oea_criteria c,
(VALUES
  ('22.1', 'O OEA deve possuir processo de gerenciamento de riscos que estabeleça ações destinadas a identificar, analisar, avaliar, priorizar, tratar e monitorar eventos com potencial impacto negativo no atendimento de requisitos dos critérios gerais e específicos para a modalidade OEA-Conformidade.'),
  ('22.2', 'O processo de gerenciamento de riscos deve prever que, no caso de erros e inconformidades encontrados, sejam realizadas ações corretivas. Tratamentos devem ser implementados para prevenir a recorrência de erros e incorrência em infrações.'),
  ('22.3', 'O processo de gerenciamento de riscos deverá ser revisado anualmente. Caso ocorram alterações no contexto interno ou externo, a revisão deverá ser realizada em menor período.')
) AS v(item_number, description)
WHERE c.number = 22
ON CONFLICT (criteria_id, item_number) DO UPDATE SET description = EXCLUDED.description;
