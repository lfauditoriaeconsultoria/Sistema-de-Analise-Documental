-- ============================================================
-- LF Auditoria - Migration OEA Criteria
-- IN RFB Nº 2.154 - 22 critérios com todos os subitens
-- Execute no SQL Editor do Supabase
-- ============================================================

-- ── 1. Tabela de critérios OEA ─────────────────────────────

CREATE TABLE IF NOT EXISTS public.oea_criteria (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  number      integer     NOT NULL UNIQUE,
  name        text        NOT NULL,
  description text,
  category    text        NOT NULL CHECK (category IN ('geral', 'seguranca', 'conformidade')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.oea_criteria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "oea_criteria_select" ON public.oea_criteria
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "oea_criteria_write_admin" ON public.oea_criteria
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ── 2. Tabela de itens/subitens OEA ────────────────────────

CREATE TABLE IF NOT EXISTS public.oea_items (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  criteria_id  uuid        NOT NULL REFERENCES public.oea_criteria(id) ON DELETE CASCADE,
  item_number  text        NOT NULL,
  description  text        NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (criteria_id, item_number)
);

ALTER TABLE public.oea_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "oea_items_select" ON public.oea_items
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "oea_items_write_admin" ON public.oea_items
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ── 3. Estender reference_documents e reference_prompts ────

ALTER TABLE public.reference_documents
  ADD COLUMN IF NOT EXISTS oea_criteria_id uuid REFERENCES public.oea_criteria(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS oea_item_id     uuid REFERENCES public.oea_items(id)    ON DELETE SET NULL;

ALTER TABLE public.reference_prompts
  ADD COLUMN IF NOT EXISTS oea_criteria_id uuid REFERENCES public.oea_criteria(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS oea_item_id     uuid REFERENCES public.oea_items(id)    ON DELETE SET NULL;

-- ── 4. Estender analyses ────────────────────────────────────

ALTER TABLE public.analyses
  ADD COLUMN IF NOT EXISTS oea_criteria_id uuid REFERENCES public.oea_criteria(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS oea_item_id     uuid REFERENCES public.oea_items(id)    ON DELETE SET NULL;

-- ── 5. Seed: 22 critérios ───────────────────────────────────

INSERT INTO public.oea_criteria (number, name, description, category) VALUES
  (1,  'Admissibilidade',                                                     'Requisitos mínimos de elegibilidade para solicitar e manter a certificação OEA',                                                        'geral'),
  (2,  'Histórico de Cumprimento da Legislação Nacional',                     'Demonstração de histórico satisfatório de conformidade tributária, aduaneira e cambial',                                                 'geral'),
  (3,  'Viabilidade Financeira',                                              'Comprovação de solidez e capacidade financeira do operador',                                                                              'geral'),
  (4,  'Sistema Satisfatório de Gestão de Registros Comerciais',              'Controles de registros contábeis, fiscais e comerciais integrados e rastreáveis',                                                         'geral'),
  (5,  'Segurança da Informação',                                             'Proteção de sistemas, dados e infraestrutura de tecnologia da informação',                                                               'geral'),
  (6,  'Segurança dos Recursos Humanos',                                      'Processos de seleção, contratação, treinamento e controle de pessoal em funções sensíveis',                                              'geral'),
  (7,  'Cooperação e Comunicação',                                            'Fluxos de comunicação interna e cooperação com autoridades aduaneiras e de controle',                                                    'geral'),
  (8,  'Visão de Segurança, Avaliação de Riscos e Melhoria Contínua',        'Gestão estratégica de riscos de segurança, auditorias e processo de melhoria contínua',                                                  'seguranca'),
  (9,  'Segurança da Carga',                                                  'Procedimentos de segurança no manuseio, rastreio, armazenagem e movimentação de cargas',                                                 'seguranca'),
  (10, 'Segurança do Transporte',                                             'Controles de segurança nos meios, rotas e operações de transporte de mercadorias',                                                       'seguranca'),
  (11, 'Segurança Física das Instalações',                                    'Perímetros, pontos de acesso, vigilância e controles físicos das instalações operacionais',                                              'seguranca'),
  (12, 'Educação, Treinamento e Conscientização em Segurança',               'Programas de treinamento, capacitação e conscientização dos colaboradores em segurança aduaneira',                                        'seguranca'),
  (13, 'Gestão de Parceiros Comerciais',                                      'Verificação, qualificação e controle da cadeia de parceiros, fornecedores e transportadores',                                            'seguranca'),
  (14, 'Gestão de Crises e Recuperação de Incidentes',                       'Planos de continuidade de negócios e resposta a incidentes de segurança',                                                               'seguranca'),
  (15, 'Classificação Fiscal de Mercadorias',                                 'Correta aplicação da NCM e das regras de classificação tarifária nas operações',                                                         'conformidade'),
  (16, 'Origem das Mercadorias',                                              'Verificação, documentação e utilização correta dos certificados de origem',                                                              'conformidade'),
  (17, 'Aspectos Cambiais',                                                   'Cumprimento das normas cambiais aplicáveis às operações de importação e exportação',                                                     'conformidade'),
  (18, 'Base de Cálculo de Tributos Incidentes no Comércio Exterior',        'Declaração correta do valor aduaneiro e dos tributos incidentes nas operações',                                                          'conformidade'),
  (19, 'Imunidades, Isenções, Reduções de Alíquotas e Regimes Especiais',    'Utilização correta de benefícios fiscais e regimes aduaneiros especiais',                                                               'conformidade'),
  (20, 'Operações Indiretas, por Conta e Ordem e com Partes Relacionadas',   'Controle e documentação de operações triangulares, intercompany e por conta de terceiros',                                              'conformidade'),
  (21, 'Qualificação de Profissionais Ligados ao Comércio Exterior',         'Habilitação e capacitação contínua dos profissionais responsáveis pelas operações aduaneiras',                                           'conformidade'),
  (22, 'Gerenciamento de Riscos Aduaneiros',                                  'Identificação, monitoramento e reporte de riscos aduaneiros à alta administração',                                                      'conformidade')
ON CONFLICT (number) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category;

-- ── 6. Seed: itens por critério ─────────────────────────────
-- Descrições oficiais extraídas do Anexo II da IN RFB nº 2.154/2023.
-- O comando abaixo atualiza registros já existentes e insere os que ainda não existirem.

-- Critério 1 - Admissibilidade
INSERT INTO public.oea_items (criteria_id, item_number, description)
SELECT c.id, v.item_number, v.description
FROM public.oea_criteria c,
(VALUES
  ('1.1', 'O OEA deve possuir inscrição no Cadastro Nacional de Pessoas Jurídicas (CNPJ) e recolhimento de tributos federais há mais de 36 (trinta e seis) meses, exceto nos seguintes casos: - pessoa jurídica controlada ou coligada de empresa estrangeira certificada em programa compatível com o Programa Brasileiro de OEA em país de domicílio com o qual o Brasil possua Acordo de Reconhecimento Mútuo ARM; - empresas cujo quadro societário seja composto, majoritariamente, por pessoas jurídicas certificadas como OEA; - importadores ou exportadores que tenham registrado no mínimo 100 (cem) declarações de comércio exterior por mês de existência; - pessoa jurídica sucessora de uma empresa certificada como OEA, resultante de processo de transformação fusão, cisão ou incorporação.'),
  ('1.2', 'O OEA deve possuir atuação habitual como interveniente em atividade passível de certificação como OEA nos últimos 36 (trinta e seis) meses, exceto nos seguintes casos: - pessoa jurídica controlada ou coligada de empresa estrangeira certificada em programa compatível com o Programa Brasileiro de OEA em país de domicílio com o qual o Brasil possua Acordo de Reconhecimento Mútuo ARM; - empresas cujo quadro societário seja composto, majoritariamente, por pessoas jurídicas certificadas como OEA; - importadores ou exportadores que tenham registrado no mínimo 100 (cem) declarações de comércio exterior por mês de existência; ou - pessoa jurídica sucessora de uma empresa certificada como OEA, resultante de processo de transformação fusão, cisão ou incorporação.'),
  ('1.3', 'O OEA deve possuir autorização para operar em sua área de atuação, nos termos estabelecidos por órgão de controle específico ou entidade da Administração Pública competente, quando for o caso.'),
  ('1.4', 'O OEA deve cumprir os requisitos de regularidade fiscal perante a Fazenda Nacional para o fornecimento de Certidão Negativa de Débitos relativos a Créditos Tributários Federais e à Dívida Ativa da União (CND) ou Certidão Positiva com Efeitos de Negativa de Débitos relativos a Créditos Tributários Federais e à Dívida Ativa da União (CPEND).'),
  ('1.5', 'O OEA deve possuir adesão ao Domicílio Tributário Eletrônico (DTE).'),
  ('1.6', 'O OEA deve apresentar sua Escrituração Contábil em formato Digital (ECD).'),
  ('1.7', 'O OEA deve demonstrar comprometimento com os requisitos, princípios e normas do Programa, conforme obrigações do Termo de Compromisso constante do requerimento de certificação.')
) AS v(item_number, description)
WHERE c.number = 1
ON CONFLICT (criteria_id, item_number) DO UPDATE SET
  description = EXCLUDED.description;

-- Critério 2 - Histórico de Cumprimento da Legislação Nacional
INSERT INTO public.oea_items (criteria_id, item_number, description)
SELECT c.id, v.item_number, v.description
FROM public.oea_criteria c,
(VALUES
  ('2.1', 'O OEA deve manter um histórico de conformidade com a legislação nacional relacionada ao atendimento dos requisitos e critérios do Programa OEA durante os últimos 5 (cinco) anos. Para interveniente cuja inscrição no CNPJ tenha sido efetivada em período inferior a 5 (cinco) anos, a análise do histórico será realizada com base nas informações disponíveis. Incidentes, ocorrências e infrações que representem graves riscos à segurança da cadeia de suprimentos internacional ou à conformidade aduaneira e infrações de menor gravidade não devidamente tratadas podem impedir a certificação do requerente ou a permanência do OEA no Programa por um período de tempo determinado de no máximo 5 (cinco) anos, considerando a gravidade dos fatos e as ações corretivas eventualmente adotadas.'),
  ('2.2', 'O OEA deve adotar medidas destinadas a prevenir a recorrência de infrações à legislação nacional relacionada ao atendimento dos requisitos e critérios do Programa OEA.'),
  ('2.3', 'As pessoas físicas com poderes de administração deverão manter um histórico de conformidade com a legislação nacional relacionada ao atendimento dos requisitos e critérios do Programa OEA durante os últimos 5 (cinco) anos.')
) AS v(item_number, description)
WHERE c.number = 2
ON CONFLICT (criteria_id, item_number) DO UPDATE SET
  description = EXCLUDED.description;

-- Critério 3 - Viabilidade Financeira
INSERT INTO public.oea_items (criteria_id, item_number, description)
SELECT c.id, v.item_number, v.description
FROM public.oea_criteria c,
(VALUES
  ('3.1', 'O OEA deve estar em situação financeira sólida para cumprir com seus compromissos e manter os requisitos do Programa OEA, considerando as características específicas de seu modelo de negócios e atividade.')
) AS v(item_number, description)
WHERE c.number = 3
ON CONFLICT (criteria_id, item_number) DO UPDATE SET
  description = EXCLUDED.description;

-- Critério 4 - Sistema Satisfatório de Gestão de Registros Comerciais
INSERT INTO public.oea_items (criteria_id, item_number, description)
SELECT c.id, v.item_number, v.description
FROM public.oea_criteria c,
(VALUES
  ('4.1', 'O OEA deve manter sistemas de registros, incluindo um sistema corporativo, que permita à Aduana conduzir qualquer auditoria da movimentação das mercadorias e unidades de cargas, relacionadas tanto à importação quanto à exportação, quando requerida.'),
  ('4.2', 'O OEA deve manter sistema de controle de acesso aos registros internos.'),
  ('4.3', 'O OEA deve possuir procedimento formalizado para garantir que todas as informações de interesse aduaneiro nos documentos correspondentes às mercadorias e cargas sejam legíveis, completas, precisas, tempestivas e protegidas contra a troca, perda ou introdução de informações incorretas.'),
  ('4.4', 'Em caso de utilização de formulários ou qualquer outro documento em papel relacionado ao comércio exterior, recomenda-se a adoção de medidas de segurança e prevenção contra o uso não autorizado.'),
  ('4.5', 'O OEA deve arquivar adequadamente os registros para posterior disponibilização à Aduana, quando forem solicitados.'),
  ('4.6', 'O OEA deve manter e disponibilizar à Aduana procurações, licenças e documentos similares relevantes para as operações de importação e exportação, quando forem solicitados.')
) AS v(item_number, description)
WHERE c.number = 4
ON CONFLICT (criteria_id, item_number) DO UPDATE SET
  description = EXCLUDED.description;

-- Critério 5 - Segurança da Informação
INSERT INTO public.oea_items (criteria_id, item_number, description)
SELECT c.id, v.item_number, v.description
FROM public.oea_criteria c,
(VALUES
  ('5.1', 'O OEA deve possuir política e procedimentos formalizados de segurança cibernética para proteger os sistemas de tecnologia da informação (TI). Os procedimentos devem proteger os sistemas contra o acesso não autorizado e contra a adulteração, alteração ou exclusão de dados. A política de TI formalizada deve cobrir, no mínimo, todos os critérios individuais relacionados à segurança cibernética e prever medidas disciplinares para infratores.'),
  ('5.2', 'As políticas e procedimentos de segurança da informação devem ser revisados anualmente ou com mais frequência, conforme o risco ou as circunstâncias o exigirem. Após a revisão, as políticas e procedimentos devem ser atualizados, se necessário.'),
  ('5.3', 'O OEA deve possuir proteção de software e hardware contra programa malicioso (malware) e contra intrusão interna ou externa nos sistemas de computadores. O OEA deve assegurar-se de que seu software de segurança esteja atualizado. O OEA deve ter políticas e procedimentos para evitar ataques via engenharia social.'),
  ('5.4', 'Recomenda-se que a política de segurança da informação incentive o OEA a compartilhar suas informações sobre ameaças à segurança da informação e à segurança cibernética com o governo e com outros parceiros de negócios.'),
  ('5.5', 'O OEA deve possuir procedimentos formalizados e recursos de backup e restore para proteger os sistemas informatizados contra a perda de informações.'),
  ('5.6', 'Recomenda-se que o backup dos dados seja feito pelo menos uma vez por semana ou com mais frequência, se necessário, e que dados sensíveis e dados confidenciais sejam armazenados em formato criptografado.'),
  ('5.7', 'O OEA que utiliza sistemas de rede deve testar regularmente a segurança de sua infraestrutura de tecnologia da informação (TI). Se forem encontradas vulnerabilidades, as ações corretivas devem ser implementadas o mais rápido possível.'),
  ('5.8', 'O acesso do usuário deve ser restrito, com base na descrição do trabalho ou nas tarefas designadas, devendo ser revisado regularmente para garantir que o acesso a sistemas sensíveis se baseie nos requisitos do trabalho.'),
  ('5.9', 'O acesso do usuário aos sistemas de Tecnologia da Informação (TI) deve ocorrer mediante conta individual e deve ser protegido contra invasões por meio do uso de senhas fortes, frases secretas ou outras formas de autenticação. Se houver evidência ou suspeita de violação, a senha ou frase secreta deve ser imediatamente alterada.'),
  ('5.10', 'Se os usuários puderem se conectar remotamente a uma rede, devem ser utilizadas tecnologias seguras, como redes privadas virtuais (VPNs), para permitir que os funcionários acessem a intranet da empresa com segurança quando fora do escritório. Deve existir procedimento para impedir o acesso remoto de usuários não autorizados.'),
  ('5.11', 'Se os funcionários puderem utilizar dispositivos pessoais para realizar o trabalho da empresa, todos esses dispositivos devem submeter-se às políticas e procedimentos de segurança cibernética da empresa, incluindo atualizações regulares de segurança e a implementação de um método seguro para acessar a rede da empresa.'),
  ('5.12', 'Toda mídia, hardware ou outro equipamento de TI que contenha informações confidenciais sobre o processo de importação e exportação deve ser contabilizado através de inventários regulares. Quando descartados, devem ser adequadamente sanitizados e/ou destruídos, de acordo com as diretrizes apropriadas do setor.'),
  ('5.13', 'Recomenda-se que as políticas e procedimentos incluam medidas para prevenir o uso de produtos tecnológicos falsificados ou licenciados indevidamente.')
) AS v(item_number, description)
WHERE c.number = 5
ON CONFLICT (criteria_id, item_number) DO UPDATE SET
  description = EXCLUDED.description;

-- Critério 6 - Segurança dos Recursos Humanos
INSERT INTO public.oea_items (criteria_id, item_number, description)
SELECT c.id, v.item_number, v.description
FROM public.oea_criteria c,
(VALUES
  ('6.1', 'O OEA deve possuir procedimento formalizado para o processo de contratação de novos funcionários e para o acompanhamento periódico dos funcionários ocupantes de cargos sensíveis, na medida permitida pela legislação nacional.'),
  ('6.2', 'Recomenda-se que o OEA tome medidas necessárias ao recrutar novos funcionários para verificar se houve condenação anterior por crimes relacionados à segurança da cadeia de suprimentos, à aduana ou a outros delitos, levando em consideração os resultados das verificações de antecedentes, na medida permitida pela legislação nacional. Recomenda-se que o OEA conduza periodicamente ou conforme necessário, novas verificações no histórico e antecedentes dos funcionários que trabalham em cargos sensíveis. No caso de cargos sensíveis, recomenda-se que a verificação se estenda à força de trabalho temporária e aos contratados. Áreas de maior risco podem justificar a realização de investigações mais aprofundadas.'),
  ('6.3', 'O OEA deve validar informações de candidatos, como histórico e referências, antes da admissão, na medida permitida pela legislação nacional.'),
  ('6.4', 'Recomenda-se que o OEA estimule seus parceiros comerciais a levar em consideração os resultados das verificações de antecedentes, conforme permitido pela legislação nacional, na tomada de decisões de contratação.'),
  ('6.5', 'O OEA deve possuir procedimento formalizado para a identificação de funcionários e exigir que todos portem identificação emitida pela empresa, que os identifique individualmente e contenha o nome da organização. Quando aplicável, um sistema de controle de acesso deve ser implementado para fins de identificação e acesso de funcionários.'),
  ('6.6', 'O OEA deve possuir procedimento formalizado para remover rapidamente a identificação, o acesso às instalações e o acesso ao computador, à rede e aos sistemas informatizados para os funcionários cujo contrato de trabalho tenha sido rescindido.'),
  ('6.7', 'O OEA deve estabelecer um Código de Conduta dos Funcionários que defina comportamentos adequados. Sanções e procedimentos disciplinares devem ser incluídos no Código de Conduta. Os funcionários devem declarar por escrito que leram e entenderam o Código de Conduta e esse documento, devidamente assinado, deve ser mantido no arquivo do funcionário.'),
  ('6.8', 'Recomenda-se que o OEA estabeleça um canal ou mecanismo para que os funcionários relatem problemas relacionados à segurança ou à conformidade aduaneira, anonimamente. Caso uma denúncia seja recebida, recomenda-se que haja investigação e adoção de ações corretivas, se aplicável.')
) AS v(item_number, description)
WHERE c.number = 6
ON CONFLICT (criteria_id, item_number) DO UPDATE SET
  description = EXCLUDED.description;

-- Critério 7 - Cooperação e Comunicação
INSERT INTO public.oea_items (criteria_id, item_number, description)
SELECT c.id, v.item_number, v.description
FROM public.oea_criteria c,
(VALUES
  ('7.1', 'O OEA deve designar um funcionário do operador como ponto de contato com a RFB, facilmente contatável, que conheça os requisitos do Programa e com acesso a diversos setores da empresa para tratar da prestação das informações necessárias durante o processo de certificação como OEA, bem como das solicitações apresentadas por ambas as partes após a certificação. O OEA deve indicar outros funcionários para essa função, substituindo o ponto de contato designado em ausências programadas e não programadas. O Responsável Legal da empresa perante o CNPJ deve cadastrar no sistema OEA os funcionários designados como ponto de contato e seus substitutos.'),
  ('7.2', 'O OEA deve possuir procedimento formalizado para a comunicação de qualquer documentação de carga incomum ou suspeita ou sobre solicitações anormais de informações relativas a embarques. O procedimento deve conter os seguintes elementos: - A forma de notificação aos superiores hierárquicos responsáveis; - O protocolo de comunicação ao ponto de contato da RFB, aos órgãos e entidades da Administração Pública competentes e aos parceiros comerciais envolvidos; - A previsão de comunicação rápida às autoridades, se possível, antes da chegada da mercadoria; -A lista de contatos com nomes e telefones das pessoas que devem receber a comunicação. O procedimento deve ser revisado periodicamente para garantir que as informações de contato sejam precisas.'),
  ('7.3', 'O OEA deve possuir procedimento formalizado para a comunicação tempestiva quando for encontrada carga ilegal, suspeita ou não contabilizada. Essa carga deverá ser protegida, conforme apropriado. O procedimento deve conter os seguintes elementos: - A forma de notificação aos superiores hierárquicos responsáveis; - O protocolo de comunicação ao ponto de contato da RFB, aos órgãos e entidades da Administração Pública competentes e aos parceiros comerciais envolvidos; - A lista de contatos com nomes e telefones das pessoas que devem receber a comunicação. O procedimento deve ser revisado periodicamente para garantir que as informações de contato sejam precisas.'),
  ('7.4', 'Após tomar conhecimento de um incidente de segurança significativo, o OEA deve iniciar imediatamente suas próprias apurações. A apuração interna da empresa deve ser documentada, concluída o mais rápido possível e disponibilizada à Aduana ou a outros órgãos e entidades da Administração Pública competentes, mediante solicitação. A apuração do OEA não deve impedir ou interferir em investigações conhecidas, conduzidas por órgãos ou entidades da Administração Pública.'),
  ('7.5', 'Recomenda-se que o OEA se envolva em uma troca mútua de informações aberta e contínua com a Aduana, individualmente ou por meio do Fórum Consultivo, excluindo as informações sensíveis que não podem ser divulgadas, em razão de sigilo definido em lei ou outros impedimentos.')
) AS v(item_number, description)
WHERE c.number = 7
ON CONFLICT (criteria_id, item_number) DO UPDATE SET
  description = EXCLUDED.description;

-- Critério 8 - Visão de Segurança, Avaliação de Riscos e Melhoria Contínua
INSERT INTO public.oea_items (criteria_id, item_number, description)
SELECT c.id, v.item_number, v.description
FROM public.oea_criteria c,
(VALUES
  ('8.1', 'Recomenda-se que o OEA demonstre seu compromisso com a segurança da cadeia de suprimentos e com o Programa OEA por meio de uma declaração de apoio. Recomenda-se que o compromisso promova a importância de proteger a cadeia de suprimentos de atividades criminosas, como tráfico de drogas, terrorismo, tráfico de pessoas e contrabando. Recomenda-se que a declaração seja assinada por um funcionário da alta gestão e seja exibida em locais apropriados na empresa.'),
  ('8.2', 'O OEA deve possuir um programa de segurança da cadeia de suprimentos elaborado, apoiado e implementado por um procedimento de revisão escrito. O procedimento de revisão deve ser atualizado conforme necessário com base nas mudanças pertinentes nas operações do OEA e no nível de risco.'),
  ('8.3', 'Recomenda-se que o OEA reúna representantes de todos os departamentos relevantes em uma equipe multifuncional para estabelecer um programa robusto de segurança da cadeia de suprimentos. Recomenda-se que essas novas medidas de segurança sejam incluídas nos procedimentos de trabalho existentes na empresa, com o fim de criar uma estrutura mais sustentável e enfatizar que a segurança da cadeia de suprimentos é responsabilidade de todos.'),
  ('8.4', 'O OEA deve realizar regularmente avaliações dos riscos de segurança em suas operações e tomar medidas apropriadas para mitigar esses riscos. O OEA deve gerenciar e documentar o risco quantitativo em suas cadeias de suprimentos. Na avaliação dos riscos de segurança, o operador deve considerar os requisitos específicos para sua função na cadeia de suprimentos.'),
  ('8.5', 'Recomenda-se que a parte internacional da avaliação de riscos documente ou mapeie o movimento da carga do operador em toda a cadeia de suprimentos, do ponto de origem ao centro de distribuição no destino, incluindo pontos de parada da carga por longos períodos de tempo, o que a torna mais vulnerável. Recomenda-se que o mapeamento inclua todos os parceiros comerciais envolvidos direta e indiretamente na movimentação das mercadorias.'),
  ('8.6', 'O OEA deve registrar os resultados da avaliação, a resposta das partes responsáveis quanto à avaliação realizada e as recomendações para possíveis melhorias a serem incorporadas em um plano para o próximo período. As avaliações de risco devem ser revisadas anualmente, ou com maior frequência, conforme os fatores de risco determinarem.')
) AS v(item_number, description)
WHERE c.number = 8
ON CONFLICT (criteria_id, item_number) DO UPDATE SET
  description = EXCLUDED.description;

-- Critério 9 - Segurança da Carga
INSERT INTO public.oea_items (criteria_id, item_number, description)
SELECT c.id, v.item_number, v.description
FROM public.oea_criteria c,
(VALUES
  ('9.1', 'O OEA deve desenvolver e manter um programa de segurança, fazendo referência relevante aos requisitos e critérios do Programa OEA para preservar a integridade da carga sob sua custódia.'),
  ('9.2', 'O OEA deve possuir procedimentos formalizados que descrevam como os lacres de alta segurança são emitidos e controlados na instalação e durante o trânsito, de forma a manter a integridade da carga e dos meios de transporte sob sua responsabilidade. Os procedimentos devem fornecer as etapas a serem executadas quando um lacre for encontrado alterado, adulterado ou com número incorreto, incluindo a forma de documentar cada evento, os protocolos de comunicação com parceiros e a investigação do incidente. No caso de incidentes, as descobertas da investigação devem ser documentadas e ações corretivas devem ser implementadas o mais rápido possível. Os procedimentos devem incluir os seguintes elementos: Controle de acesso aos lacres: - Gerenciamento de lacres restrito ao pessoal autorizado; - Armazenamento seguro. Inventário, distribuição e rastreamento - Registro de emissão ou recebimento de novos lacres; - Rastreabilidade dos lacres; - Uso apropriado e legítimo dos lacres, garantindo que apenas pessoal treinado e designado distribua e afixe aos meios de transporte e Instrumentos de Transporte Internacional – ITI. Controle de lacres em trânsito:'),
  ('9.3', 'Os procedimentos formalizados relativos aos lacres de alta segurança devem ser mantidos no nível operacional local, para que sejam facilmente acessíveis e devem ser revisados pelo menos uma vez por ano ou atualizados com mais brevidade, conforme necessário.'),
  ('9.4', 'As cargas devem ser lacradas imediatamente após o carregamento, estufagem ou embalagem pela parte responsável (o OEA ou seus parceiros comerciais) com um lacre de alta segurança que atenda ou exceda a norma ISO 17.712 ou mais recente para lacres de alta segurança. Lacres certificados de cabo ou de pino e bucha são aceitos. Todos os lacres usados devem ser afixados de forma segura e adequada aos meios de transporte e Instrumentos de Transporte Internacional - ITI.'),
  ('9.5', 'Se o OEA mantiver inventário de lacres, deve documentar que os lacres de alta segurança que usa atendem ou excedem o padrão ISO 17712 mais atual.'),
  ('9.6', 'Se o OEA mantiver inventário de lacres, a gestão da empresa ou a supervisão de segurança deve realizar auditorias desses lacres, que incluem inventário periódico daqueles armazenados e reconciliação com os registros do inventário e documentos de remessa. Todas as auditorias devem ser documentadas. Como parte do processo geral de auditoria de lacres, supervisores, gerentes de armazém, fiel depositário ou empregados em função similar, devem verificar periodicamente os números dos lacres usados nos meios de transporte e Instrumentos de Transporte Internacional - ITI.'),
  ('9.7', 'Um processo de verificação de lacres deve ser seguido para garantir que todos os lacres de alta segurança tenham sido afixados adequadamente e estejam operando conforme projetado. O procedimento para a verificação de lacres é conhecido como processo VVTT (do inglês view, verify, tug, twist e turn): V - Visualizar o lacre e os mecanismos de travamento do contêiner, garantindo que eles estão íntegros; V - Verificar o número do lacre em relação aos documentos de remessa; T - Tracionar/puxar o lacre para garantir que ele esteja afixado corretamente;'),
  ('9.8', 'Como evidência documental de que o lacre foi corretamente instalado, recomenda-se que fotografias digitais sejam tiradas no ponto de estufagem. Sempre que possível, recomenda-se que essas imagens sejam encaminhadas eletronicamente para o destino para verificação.'),
  ('9.9', 'Recomenda-se que os números dos lacres atribuídos às remessas sejam transmitidos ao destinatário antes da partida da carga.'),
  ('9.10', 'Recomenda-se que os números dos lacres sejam impressos eletronicamente no conhecimento de embarque ou em outros documentos de remessa.'),
  ('9.11', 'O OEA deve armazenar Instrumentos de Transporte Internacional - ITI e meios de transporte sob sua custódia em áreas seguras para evitar acessos não autorizados, que podem resultar em alteração em estruturas ou no comprometimento de lacres e portas. Deve existir procedimento formalizado para detectar e reportar a entrada não autorizada em áreas de armazenamento de carga e de meios de transporte.'),
  ('9.12', 'O OEA deve estabelecer procedimentos para gerenciar, proteger e controlar a carga: - nas áreas de armazenamento; - durante a remoção das áreas de armazenamento; - ao carregar ou descarregar de um meio de transporte e durante o seu transporte.'),
  ('9.13', 'Recomenda-se que operadores portuários e aeroportuários instituam procedimentos para verificar rotineiramente as áreas de armazenamento para carga ou contêineres. Recomenda-se que os recipientes vazios sejam verificados para garantir que estão vazios e sem compartimentos falsos.'),
  ('9.14', 'Quando a carga ficar em espera para transbordo, carregamento ou descarregamento, à noite ou por um longo período, devem ser tomadas medidas adicionais para proteção contra o acesso não autorizado.'),
  ('9.15', 'O OEA deve possuir procedimento formalizado para a realização de inspeções de segurança.'),
  ('9.16', 'O OEA deve assegurar-se de que as inspeções de segurança sejam realizadas em todos os meios de transporte e Instrumentos de Transporte Internacional - ITI antes do carregamento / estufagem / embalagem. Uma inspeção de sete pontos em todos os contêineres vazios e dispositivos de carga unitária (ULD) e uma inspeção de oito pontos deve ser realizada em todos os contêineres refrigerados vazios e ULDs:'),
  ('9.17', 'A inspeção de segurança dos meios de transporte e dos Instrumentos de Transporte Internacional - ITI deve ser registrada em um checklist (lista de verificação). Recomenda-se que o checklist dos meios de transporte e dos Instrumentos de Transporte Internacional - ITI contenha: - Número, identificação e/ou placas dos meios de transporte e dos Instrumentos de Transporte Internacional - ITI; - Data da inspeção; - Hora da inspeção; - Nome do funcionário responsável pela inspeção; e - Áreas específicas dos meios de transporte e dos Instrumentos de Transporte Internacional - ITI que foram inspecionadas.'),
  ('9.18', 'Recomenda-se que o carregamento ou estufagem da carga nos meios de transporte e nos Instrumentos de Transporte Internacional - ITI seja supervisionado por um gerente de segurança ou outra pessoa designada.'),
  ('9.19', 'O OEA deve possuir procedimento formalizado para a detecção de pragas visíveis.'),
  ('9.20', 'O OEA deve assegurar-se que inspeções para detecção de contaminação por pragas visíveis sejam realizadas em todos os meios de transporte e Instrumentos de Transporte Internacional - ITI antes do carregamento / estufagem / embalagem.'),
  ('9.21', 'O OEA deve possuir procedimento formalizado para prevenir a contaminação visível por pragas em pallets, embalagens e suportes de madeira, e para prevenir a sua utilização com ausência ou irregularidade da marca IPPC, com a finalidade de manter a conformidade com os regulamentos sobre embalagens de madeira (WPM - Wood Packaging Materials) em toda a cadeia de suprimentos. As medidas relacionadas ao WPM devem atender às Normas Internacionais para Medidas Fitossanitárias adotadas no âmbito da Convenção Internacional de Proteção de Plantas (IPPC), em especial a NIMF n° 15 (ISPM 15), e à legislação brasileira.'),
  ('9.22', 'Áreas de expedição ou estufagem de carga e áreas adjacentes devem ser inspecionadas regularmente para assegurar que estejam livres de contaminação visível por pragas.'),
  ('9.23', 'O OEA deve identificar o transportador que coleta ou entrega a carga e os meios de transporte correspondentes. O OEA deve exigir identificação com foto dos motoristas que entregam ou recebem carga e também deve identificar os respectivos veículos, antes que a carga seja recebida ou liberada.'),
  ('9.24', 'O OEA deve manter um registro de retirada da carga para anotar os dados dos motoristas e de seus veículos ao coletar a carga. Recomenda-se que o registro de retirada de carga tenha os seguintes itens registrados: - Nome do motorista; - Data e horário de chegada; - Empregador; - Placa do caminhão; - Placa da carreta/cavalo; - Horário de partida; - O número do lacre afixado na remessa no momento da partida. O registro de carga deve ser guardado em local seguro e o acesso dos motoristas não deve ser permitido.'),
  ('9.25', 'O OEA deve possuir procedimento formalizado para, sempre que cabível, comparar a carga com sua descrição nos documentos ou informações eletrônicas a serem submetidas à Aduana.'),
  ('9.26', 'O remetente ou seu agente deve assegurar-se de que os conhecimentos de embarque e manifestos reflitam com precisão as informações fornecidas ao transportador, e os transportadores devem exercer a devida diligência para garantir que esses documentos sejam precisos.'),
  ('9.27', 'O OEA deve revisar as informações inseridas nos documentos de importação e exportação para identificar ou reconhecer remessas suspeitas de carga. As pessoas diretamente envolvidas nessa revisão devem ser treinadas sobre como identificar informações nos documentos de remessa que possam indicar uma carga suspeita. Os funcionários das transportadoras devem ser treinados para revisar os documentos de remessa e outros documentos, a fim de identificar ou reconhecer cargas suspeitas, tais como: - Originadas ou destinadas a locais incomuns; - Pagas em dinheiro ou cheque visado; - Uso de rotas não usuais; - Práticas incomuns de remessa ou recebimento; - Informações vagas, generalizadas ou falta de informações. Recomenda-se que o OEA leve em consideração a Lista de Indicadores de Atividades Relacionadas à Lavagem de Dinheiro, ao Financiamento a Terrorismo e a Outras Atividades Criminosas.'),
  ('9.28', 'Todas as faltas, excedentes e outras discrepâncias ou anomalias significativas relacionadas à carga devem ser investigadas, resolvidas e registradas.'),
  ('9.29', 'Os dados nos conhecimentos de embarque (Bill of Lading - BL) informados à RFB devem mostrar a primeira localização ou instalação onde o transportador tomou posse da carga destinada ao Brasil.')
) AS v(item_number, description)
WHERE c.number = 9
ON CONFLICT (criteria_id, item_number) DO UPDATE SET
  description = EXCLUDED.description;

-- Critério 10 - Segurança do Transporte
INSERT INTO public.oea_items (criteria_id, item_number, description)
SELECT c.id, v.item_number, v.description
FROM public.oea_criteria c,
(VALUES
  ('10.1', 'O OEA deve assegurar-se, na medida e no escopo de sua competência e responsabilidade, de que todos os meios de transporte e Instrumentos de Transporte Internacional - ITI utilizados dentro de sua cadeia de suprimentos possam ser efetivamente protegidos. A estrutura externa dos meios de transporte deve ter resistência razoável a tentativas de remoção de alguma parte que permita acesso à carga. As portas, maçanetas, hastes, ferrolhos, rebites, suportes e todas as outras partes do mecanismo de travamento de um contêiner devem ser totalmente inspecionados para detectar adulteração e quaisquer inconsistências da estrutura antes da fixação de qualquer dispositivo de segurança.'),
  ('10.2', 'O OEA deve garantir a segurança dos meios de transporte quando deixados sem supervisão do motorista e verificar se há violações de segurança no retorno.'),
  ('10.3', 'O OEA deve garantir, na extensão e no alcance de sua competência e responsabilidade, que todos os operadores de meios de transporte sejam treinados para manter a segurança do transporte e da carga em todos os momentos em que estejam sob sua custódia.'),
  ('10.4', 'Recomenda-se que o OEA trabalhe com seus transportadores para rastrear os meios de transporte desde a origem até o destino final. Recomenda-se que requisitos específicos para rastreamento, geração de relatórios e compartilhamento de dados sejam incorporados aos contratos assinados com esses prestadores de serviço ou a outros instrumentos acordados.'),
  ('10.5', 'Recomenda-se que, sempre que possível, os remetentes tenham acesso ao sistema de monitoramento da frota por GPS de suas transportadoras, para que possam rastrear o movimento de suas remessas.'),
  ('10.6', 'O transportador deve rastrear os meios de transporte, utilizando um GPS ou tecnologia equivalente, em todas as operações que envolvam cargas de importação ou para exportação.'),
  ('10.7', 'Recomenda-se que, para remessas terrestres próximas de fronteiras, uma política de “não paradas” seja implementada, de forma a evitar paradas não programadas.'),
  ('10.8', 'Recomenda-se que a transportadora notifique a hora prevista de chegada, o nome do motorista e a placa do caminhão. Recomenda-se que, sempre que possível, o OEA permita entregas e retiradas somente com hora marcada.'),
  ('10.9', 'As transportadoras devem ter sistemas ou procedimentos formalizados para responder a desvios de rota significativos e chegadas tardias à área de carregamento, pontos de transferência ou destino final. Os motoristas devem notificar o departamento apropriado da transportadora sobre quaisquer atrasos significativos na rota devido ao clima, tráfego ou reencaminhamento.'),
  ('10.10', 'O OEA deve comunicar à Aduana, aos parceiros comerciais que possam ser afetados e a quaisquer outros órgãos e entidades da Administração Pública relevantes, qualquer ameaça possível ou detectada, incidente real ou suspeito, relativos à segurança da cadeia de suprimentos e, ainda, violação ou suspeita de violação de meios de transporte.'),
  ('10.11', 'Recomenda-se que todas as inspeções de segurança dos meios de transporte sejam realizadas em uma área de acesso controlado e, se disponível, monitoradas por um sistema de CFTV.'),
  ('10.12', 'Recomenda-se que, com base em análise de risco, a liderança de transporte do OEA conduza buscas aleatórias nos meios de transporte e nos Instrumentos de Transporte Internacional - ITI após a realização das inspeções de segurança. As buscas devem ser feitas periodicamente e com maior frequência de acordo com o risco. Quando realizadas, recomenda-se que as buscas aleatórias sejam conduzidas sem aviso, para que não se tornem previsíveis. Recomenda-se que as buscas sejam realizadas em vários locais onde o transporte esteja mais exposto a ameaças, como no pátio da transportadora, após o caminhão ter sido carregado e a caminho da fronteira.'),
  ('10.13', 'Recomenda-se que a lista de verificação (checklist) dos meios de transporte e dos Instrumentos de Transporte Internacional - ITI faça parte do pacote de documentos de embarque. Recomenda-se que o consignatário receba o pacote de documentos de embarque antes de receber a mercadoria.')
) AS v(item_number, description)
WHERE c.number = 10
ON CONFLICT (criteria_id, item_number) DO UPDATE SET
  description = EXCLUDED.description;

-- Critério 11 - Segurança Física das Instalações
INSERT INTO public.oea_items (criteria_id, item_number, description)
SELECT c.id, v.item_number, v.description
FROM public.oea_criteria c,
(VALUES
  ('11.1', 'O OEA deve implementar medidas e procedimentos de segurança para proteger edifícios, pátios e escritórios, bem como monitorar e controlar perímetros externos e internos e proibir acesso não autorizado às instalações, meios de transporte e áreas de manuseio e armazenamento de carga, de acordo com seu modelo de negócio e análise de risco. Todas as instalações de manuseio e armazenamento de carga, incluindo pátios e escritórios devem ter barreiras físicas e/ou obstáculos que impeçam o acesso não autorizado.'),
  ('11.2', 'Os edifícios devem ser construídos com materiais que resistam à entrada ilegal.'),
  ('11.3', 'As janelas externas e internas, portões e cercas devem ser protegidos com dispositivos de travamento ou monitoramento de acesso.'),
  ('11.4', 'As barreiras ou cercas de perímetro devem incluir as áreas em torno das instalações de manuseio e armazenamento de carga destinada ao fluxo de comércio exterior. Com base no risco, barreiras ou cercas internas adicionais devem segregar os tipos de carga, como materiais domésticos, internacionais, de alto valor e/ou perigosos. As barreiras ou cercas devem ser inspecionadas regularmente.'),
  ('11.5', 'A integridade das estruturas deve ser mantida por inspeção periódica e, quando danos forem encontrados, reparos devem ser realizados o mais rápido possível.'),
  ('11.6', 'As áreas restritas devem ser claramente identificadas.'),
  ('11.7', 'Iluminação adequada deve ser fornecida dentro e fora da instalação, incluindo as seguintes áreas: entradas e saídas, áreas de manuseio e armazenamento de carga, barreiras, cercas e áreas de estacionamento.'),
  ('11.8', 'Portões pelos quais veículos ou pessoas entram ou saem devem ser tripulados, monitorados ou controlados de alguma forma. O OEA deve assegurar que os veículos que necessitam de acesso a áreas restritas sejam estacionados em áreas aprovadas e controladas e que os números de suas placas sejam fornecidos à Aduana mediante solicitação. Indivíduos e veículos podem estar sujeitos a revistas de acordo com as leis locais e trabalhistas.'),
  ('11.9', 'Recomenda-se que veículos particulares de passageiros sejam proibidos de estacionar em áreas adjacentes às áreas de manuseio e armazenamento de cargas e meios de transporte.'),
  ('11.10', 'O OEA deve garantir que apenas pessoas devidamente identificadas e autorizadas possam acessar as instalações.'),
  ('11.11', 'O OEA deve possuir procedimento formalizado para exigir identificação com foto e registrar a entrada de visitantes, parceiros, fornecedores e prestadores de serviço em todos os pontos de entrada. O procedimento também deve estabelecer como identificar, abordar, registrar e providenciar a remoção de pessoas não autorizadas ou não identificadas. Todos os funcionários devem estar familiarizados com o procedimento.'),
  ('11.12', 'Todos os visitantes e prestadores de serviços devem receber uma identificação temporária, que deverá ser exibida visivelmente o tempo todo durante a visita. Com base no risco, os visitantes devem ser acompanhados por um responsável. Deve ser mantido um cadastro para registrar os detalhes da visita, contendo pelo menos: - Data da visita; - Nome do visitante; - Verificação da identificação com foto; - Hora de chegada; - Responsável pela visita e - Hora da partida.'),
  ('11.13', 'O acesso às áreas de armazenamento de documentos ou cargas deve ser restrito, com base na descrição do trabalho ou nas funções atribuídas, e deve existir procedimento formalizado para lidar com pessoas não autorizadas ou não identificadas nessas áreas.'),
  ('11.14', 'Recomenda-se que os pacotes e correspondências que chegam sejam checados periodicamente para detectar materiais ilícitos, mercadoria não adquirida ou remetente desconhecido antes de serem admitidos.'),
  ('11.15', 'Recomenda-se que a entrega de mercadorias ao consignatário ou a outras pessoas que recebam a carga nas instalações do parceiro seja limitada a uma área monitorada específica.'),
  ('11.16', 'Deve haver sistemas de segurança apropriados, como sistemas de alarme contra roubo e/ou controle de acesso, com base em avaliação de riscos. Os sistemas de segurança devem ser utilizados para monitorar as instalações e evitar o acesso não autorizado a áreas sensíveis.'),
  ('11.17', 'Deve existir procedimento formalizado para controle de chaves e dispositivos de acesso.'),
  ('11.18', 'Deve haver políticas e procedimentos formalizados para reger o uso, manutenção e proteção da tecnologia de segurança utilizada para a segurança física. As políticas e procedimentos devem estipular: - Acesso limitado para pessoal autorizado aos locais onde a tecnologia é gerenciada e onde os equipamentos são mantidos; - Procedimentos para testar a tecnologia regularmente; - Que as inspeções incluam verificações de que todo o equipamento está funcionando corretamente e, se aplicável, que o equipamento está posicionado corretamente; - Que os resultados das inspeções e testes de desempenho sejam documentados; - Que as ações corretivas, caso necessárias, sejam implementadas o mais rápido possível e sejam documentadas; - Que os resultados documentados dessas inspeções sejam mantidos por tempo suficiente para fins de auditoria. Se uma estação central de monitoramento de terceiros (externa) for utilizada, o OEA deve ter procedimento formalizado estipulando: - funcionalidades críticas dos sistemas e protocolos de autenticação; - mudanças nos códigos de segurança; - adição ou remoção de usuários; - revisões de senhas, acessos e restrições. Os procedimentos devem ser revisados e atualizados anualmente, ou com mais frequência, conforme o risco ou as circunstâncias o exigirem.'),
  ('11.19', 'Toda a infraestrutura de tecnologia de segurança deve ser protegida fisicamente contra acesso não autorizado.'),
  ('11.20', 'Recomenda-se que os sistemas de tecnologia de segurança sejam dotados de uma fonte de energia alternativa que permita que continuem operando no caso de uma falha inesperada da energia direta.'),
  ('11.21', 'Recomenda-se que o OEA utilize recursos licenciados ou certificados ao considerar o projeto e a instalação da tecnologia dos sistemas de segurança e monitoramento.'),
  ('11.22', 'Caso sistemas de câmeras sejam instalados, recomenda- se que as câmeras monitorem as instalações e suas áreas sensíveis para impedir o acesso não autorizado. Recomenda-se que alarmes sejam usados para alertar uma empresa de acesso não autorizado a áreas sensíveis.'),
  ('11.23', 'Caso sistemas de câmeras sejam instalados, as câmeras devem ser posicionadas para cobrir as principais áreas das instalações que pertencem ao processo de importação e exportação. As câmeras devem ser programadas para gravar com qualidade de imagem adequada e devem gravar 24 horas por dia, 7 dias por semana.'),
  ('11.24', 'Caso sistemas de câmeras sejam instalados, recomenda- se que as câmeras tenham recurso de alarme ou notificação que sinalize uma condição de falha operacional.'),
  ('11.25', 'Caso sistemas de câmeras sejam instalados, análises periódicas e aleatórias das imagens das câmeras devem ser realizadas pela gerência, segurança ou pessoal designado para verificar se os procedimentos estão sendo seguidos adequadamente. Os resultados das revisões devem ser registrados para incluir as ações corretivas tomadas e devem ser mantidos por tempo suficiente para fins de auditoria.'),
  ('11.26', 'Caso sistemas de câmeras sejam instalados, as gravações que cobrem os principais processos de importação e exportação devem ser mantidas por tempo suficiente para que um embarque seja monitorado até o seu destino final e uma investigação possa ser concluída.'),
  ('11.27', 'Deve haver procedimento formalizado com as instruções de trabalho de guardas de segurança, caso esses profissionais sejam utilizados. O OEA deve verificar periodicamente a conformidade e adequação desse procedimento por meio de auditoria e revisão.'),
  ('11.28', 'Conforme necessário ou mediante solicitação, o OEA deve fornecer à Aduana acesso aos sistemas de monitoramento de segurança.')
) AS v(item_number, description)
WHERE c.number = 11
ON CONFLICT (criteria_id, item_number) DO UPDATE SET
  description = EXCLUDED.description;

-- Critério 12 - Educação, Treinamento e Conscientização em Segurança
INSERT INTO public.oea_items (criteria_id, item_number, description)
SELECT c.id, v.item_number, v.description
FROM public.oea_criteria c,
(VALUES
  ('12.1', 'O OEA deve estabelecer e manter um programa de treinamento sobre segurança para promover a conscientização sobre vulnerabilidades existentes nas instalações, no transporte da carga e em outros pontos da cadeia de suprimentos que podem ser exploradas para atividades criminosas. O programa de treinamento deve ser abrangente e cobrir todos os requisitos de segurança do Programa OEA e, quando possível, envidar esforços para educar seus parceiros comerciais. O treinamento de segurança deve ser fornecido aos funcionários, com base em suas funções e posição, em uma base regular, e funcionários recém-contratados devem receber treinamento como parte de sua orientação inicial. O pessoal em cargos sensíveis deve receber treinamento especializado adicional voltado para as responsabilidades da posição em que ocupa.'),
  ('12.2', 'O OEA deve fornecer material educativo e treinamento apropriado sobre identificação de carga potencialmente suspeita a todo o pessoal relevante envolvido na cadeia de suprimentos, como pessoal de segurança, manuseio de carga e pessoal de documentação de carga, bem como funcionários do transporte e do recebimento.'),
  ('12.3', 'Devem ser realizados treinamentos específicos para auxiliar os funcionários a manter a integridade da carga, reconhecendo possíveis ameaças internas à segurança e protegendo os controles de acesso.'),
  ('12.4', 'O OEA deve treinar os funcionários sobre os procedimentos para identificar e relatar incidentes de segurança e atividades suspeitas.'),
  ('12.5', 'Motoristas e outras pessoas que realizam inspeções de segurança nos meios de transporte e nos Instrumentos de Transporte Internacional - ITI vazios devem ser treinados nessas funções. O treinamento de inspeção deve incluir, pelo menos, os seguintes tópicos: - Inspeção de 7 pontos; - Inspeção de 17 pontos; - Sinais de compartimentos ocultos; - Mercadoria ilícita oculta em estruturas de contêineres ou veículos; - Sinais de contaminação por pragas. Treinamento de reciclagem deve ser realizado periodicamente ou conforme necessário, após um incidente de segurança ou ainda quando houver alteração nos procedimentos da empresa.'),
  ('12.6', 'De acordo com seu modelo de negócios, o OEA deve fornecer treinamento para a prevenção de contaminação visível por pragas. O treinamento deve incluir medidas de prevenção, requisitos regulamentares aplicáveis aos materiais de embalagem de madeira (WPM) e identificação de madeira visivelmente infestada.'),
  ('12.7', 'O OEA deve treinar os funcionários nas políticas e procedimentos da empresa em segurança cibernética, conforme aplicável e com base em suas funções. Deve ser incluído no treinamento um tópico sobre a necessidade de funcionários protegerem senhas e acesso aos computadores.'),
  ('12.8', 'Os funcionários que operam e gerenciam os sistemas de tecnologia de segurança devem ter recebido treinamento em suas áreas específicas. Experiência anterior com sistemas semelhantes é aceitável. O autotreinamento por meio de manuais operacionais e outros métodos é aceitável.'),
  ('12.9', 'Recomenda-se fornecer, anualmente, treinamento especializado aos funcionários designados para identificar os indicadores de alerta sobre lavagem de dinheiro e financiamento do terrorismo.'),
  ('12.10', 'O OEA deve manter evidências dos treinamentos realizados, como registros de treinamentos e listas de presença. Os registros de treinamento devem incluir a data do treinamento, a duração em horas-aula, os nomes dos participantes e os tópicos abordados.'),
  ('12.11', 'Recomenda-se que o OEA adote medidas para verificar se os treinamentos fornecidos atingiram seus objetivos.'),
  ('12.12', 'Mediante solicitação, o OEA deve familiarizar a Aduana com informações internas relevantes, sistemas e processos de segurança, inclusive com treinamentos apropriados em métodos de inspeção para todos os tipos de instalação, meios de transporte e operações comerciais que o OEA controla.')
) AS v(item_number, description)
WHERE c.number = 12
ON CONFLICT (criteria_id, item_number) DO UPDATE SET
  description = EXCLUDED.description;

-- Critério 13 - Gestão de Parceiros Comerciais
INSERT INTO public.oea_items (criteria_id, item_number, description)
SELECT c.id, v.item_number, v.description
FROM public.oea_criteria c,
(VALUES
  ('13.1', 'O OEA deve possuir procedimento formalizado para selecionar novos parceiros comerciais e para monitorar os parceiros atuais.'),
  ('13.2', 'O OEA deve validar informações relevantes relativas à outra parte contratante antes de firmar relações contratuais, inclusive no caso de partes terceirizadas, para garantir que os parceiros comerciais atendam aos critérios de segurança do Programa OEA.'),
  ('13.3', 'O procedimento de seleção de parceiros comerciais deve incluir verificações adicionais em listas públicas governamentais ou de organismos internacionais que relacionem empresas, entidades e pessoas que representam ameaça à segurança da cadeia de suprimentos. Na verificação em listas públicas, se for identificada alguma semelhança com os nomes pesquisados, a investigação deve ser aprofundada antes de prosseguir com a contratação. No caso de um embarque em que seja detectado que indivíduos ou entidades figurem nessas listas, o OEA deve informar o fato ao ponto de contato da RFB dentro de 24 horas antes da partida da carga.'),
  ('13.4', 'Recomenda-se que a verificação de indícios de atividades relacionadas à lavagem de dinheiro, ao financiamento a terrorismo e a outras atividades criminosas sejam consideradas no processo de seleção e de monitoramento de parceiros comerciais.'),
  ('13.5', 'Ao firmar acordos contratuais com um parceiro comercial, o OEA deve incentivar a outra parte a avaliar e aprimorar a segurança de sua cadeia de suprimentos e, na medida do possível para seu modelo de negócios, incluir as obrigações pertinentes nesses acordos contratuais.'),
  ('13.6', 'No processo de seleção do parceiro comercial, o OEA deve levar em consideração se o parceiro é certificado OEA no Brasil ou membro de um programa OEA reconhecido por Acordo de Reconhecimento Mútuo (ARM) firmado pelo Brasil. A certificação em um programa OEA aprovado é prova aceitável para atender aos requisitos do programa para parceiros comerciais. O operador deve obter evidências da certificação e continuar a monitorar esses parceiros de negócios para assegurar-se de que mantenham sua certificação.'),
  ('13.7', 'Recomenda-se que as avaliações de segurança dos parceiros comerciais sejam atualizadas anualmente ou com mais frequência, conforme o risco ou as circunstâncias o exigirem.'),
  ('13.8', 'Caso sejam identificadas falhas durante as avaliações de segurança, estas devem ser tratadas o mais rápido possível e as correções devem ser implementadas em tempo hábil, com comprovação por meio de evidência documental.'),
  ('13.9', 'Recomenda-se que o operador possua um programa de conformidade social que aborde, no mínimo, de que modo a empresa se assegura de que as mercadorias que estão sendo importadas ou exportadas não foram extraídas, produzidas ou fabricadas, total ou parcialmente, com formas proibidas de trabalho, ou seja, trabalho forçado, trabalho escravo ou trabalho infantil.')
) AS v(item_number, description)
WHERE c.number = 13
ON CONFLICT (criteria_id, item_number) DO UPDATE SET
  description = EXCLUDED.description;

-- Critério 14 - Gestão de Crises e Recuperação de Incidentes
INSERT INTO public.oea_items (criteria_id, item_number, description)
SELECT c.id, v.item_number, v.description
FROM public.oea_criteria c,
(VALUES
  ('14.1', 'O OEA deve desenvolver e documentar planos de contingência para situações de segurança emergencial e para desastres ou recuperação de incidentes terroristas. Quando aconselhável ou necessário, os planos de contingências podem ser elaborados em conjunto com as autoridades competentes.'),
  ('14.2', 'O OEA deve realizar treinamento periódico dos funcionários e testes dos planos de contingência.')
) AS v(item_number, description)
WHERE c.number = 14
ON CONFLICT (criteria_id, item_number) DO UPDATE SET
  description = EXCLUDED.description;

-- Critério 15 - Classificação Fiscal de Mercadorias
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
ON CONFLICT (criteria_id, item_number) DO UPDATE SET
  description = EXCLUDED.description;

-- Critério 16 - Origem das Mercadorias
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
ON CONFLICT (criteria_id, item_number) DO UPDATE SET
  description = EXCLUDED.description;

-- Critério 17 - Aspectos Cambiais
INSERT INTO public.oea_items (criteria_id, item_number, description)
SELECT c.id, v.item_number, v.description
FROM public.oea_criteria c,
(VALUES
  ('17.1', 'O OEA deve possuir procedimento formalizado para tratamento, registro e controle dos aspectos cambiais das operações aduaneiras: - o pagamento das importações; - o recebimento das exportações; e - o registro adequado de operações sem cobertura cambial. O procedimento deve assegurar ainda que a modalidade cambial de cada operação seja corretamente informada nas declarações aduaneiras e que sejam mantidos os registros dos contratos de câmbio correlacionados com suas respectivas declarações aduaneiras.'),
  ('17.2', 'O OEA deve revisar e atualizar periodicamente os procedimentos formalizados relativos aos aspectos cambiais das declarações aduaneiras.')
) AS v(item_number, description)
WHERE c.number = 17
ON CONFLICT (criteria_id, item_number) DO UPDATE SET
  description = EXCLUDED.description;

-- Critério 18 - Base de Cálculo de Tributos Incidentes no Comércio Exterior
INSERT INTO public.oea_items (criteria_id, item_number, description)
SELECT c.id, v.item_number, v.description
FROM public.oea_criteria c,
(VALUES
  ('18.1', 'O OEA deve possuir procedimento formalizado para a determinação da base de cálculo dos tributos informada nas declarações aduaneiras. O procedimento deverá incluir as etapas para a correta determinação do valor aduaneiro, conforme as disposições do Acordo de Valoração Aduaneira e legislação tributária vigente.'),
  ('18.2', 'O OEA deve revisar e atualizar periodicamente o procedimento formalizado para a determinação da base de cálculo dos tributos.')
) AS v(item_number, description)
WHERE c.number = 18
ON CONFLICT (criteria_id, item_number) DO UPDATE SET
  description = EXCLUDED.description;

-- Critério 19 - Imunidades, Isenções, Reduções de Alíquotas e Regimes Especiais
INSERT INTO public.oea_items (criteria_id, item_number, description)
SELECT c.id, v.item_number, v.description
FROM public.oea_criteria c,
(VALUES
  ('19.1', 'O OEA deve possuir procedimentos formalizados para que a execução das atividades de solicitação, fruição e extinção de benefícios fiscais, suspensões tributárias e imunidades ocorram de acordo com a legislação de regência.'),
  ('19.2', 'O OEA deve revisar e atualizar periodicamente os procedimentos formalizados para fruição de benefícios, suspensões tributárias e imunidades.')
) AS v(item_number, description)
WHERE c.number = 19
ON CONFLICT (criteria_id, item_number) DO UPDATE SET
  description = EXCLUDED.description;

-- Critério 20 - Operações Indiretas, por Conta e Ordem e com Partes Relacionadas
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
ON CONFLICT (criteria_id, item_number) DO UPDATE SET
  description = EXCLUDED.description;

-- Critério 21 - Qualificação de Profissionais Ligados ao Comércio Exterior
INSERT INTO public.oea_items (criteria_id, item_number, description)
SELECT c.id, v.item_number, v.description
FROM public.oea_criteria c,
(VALUES
  ('21.1', 'O OEA deve possuir política de qualificação de pessoal ligado a atividades relacionadas com o cumprimento da legislação aduaneira.'),
  ('21.2', 'A política de qualificação de pessoal deverá prever revisão anual das necessidades de treinamento. Caso ocorram alterações nas operações da organização ou na legislação aduaneira, a revisão deverá ser realizada em menor período.')
) AS v(item_number, description)
WHERE c.number = 21
ON CONFLICT (criteria_id, item_number) DO UPDATE SET
  description = EXCLUDED.description;

-- Critério 22 - Gerenciamento de Riscos Aduaneiros
INSERT INTO public.oea_items (criteria_id, item_number, description)
SELECT c.id, v.item_number, v.description
FROM public.oea_criteria c,
(VALUES
  ('22.1', 'O OEA deve possuir processo de gerenciamento de riscos que estabeleça ações destinadas a identificar, analisar, avaliar, priorizar, tratar e monitorar eventos com potencial impacto negativo no atendimento de requisitos dos critérios gerais e específicos para a modalidade OEA-Conformidade.'),
  ('22.2', 'O processo de gerenciamento de riscos deve prever que, no caso de erros e inconformidades encontrados, sejam realizadas ações corretivas. Tratamentos devem ser implementados para prevenir a recorrência de erros e incorrência em infrações.'),
  ('22.3', 'O processo de gerenciamento de riscos deverá ser revisado anualmente. Caso ocorram alterações no contexto interno ou externo, a revisão deverá ser realizada em menor período.')
) AS v(item_number, description)
WHERE c.number = 22
ON CONFLICT (criteria_id, item_number) DO UPDATE SET
  description = EXCLUDED.description;

