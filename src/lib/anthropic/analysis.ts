import { getAnthropicClient } from './client'
import { ReferenceDocument, Theme, Subtopic, OeaCriteria, OeaItem, CompliancePoint, ImprovementSuggestion, ComplianceLevel, Report } from '@/types'

export interface PromptResponse {
  prompt: string
  response: string
}

export interface AnalysisResult {
  overall_compliance: ComplianceLevel
  compliance_score: number
  summary: string
  criteria_used: string
  prompt_responses: PromptResponse[]
  conforming_points: CompliancePoint[]
  partial_points: CompliancePoint[]
  non_conforming_points: CompliancePoint[]
  improvement_suggestions: ImprovementSuggestion[]
  conclusion: string
  raw_analysis: string
}

export type DocumentInput =
  | { type: 'text'; content: string }
  | { type: 'image'; base64: string; mediaType: string }

export interface AnalysisReferenceLink {
  name: string
  url: string
  content: string
}

export interface AdequacyProposal {
  reference: string
  original: string
  proposed: string
  justification: string
  lgpd_basis: string
}

export interface AdequacyResult {
  proposals: AdequacyProposal[]
}

export const ADEQUACY_RAW_PREFIX = '__ADEQUACY__'

function buildAdequacySystemPrompt(
  referenceDocs: ReferenceDocument[],
  referenceLinks: AnalysisReferenceLink[] = [],
  restrictToContext?: boolean,
): string {
  const refContext = referenceDocs.length > 0
    ? referenceDocs.map(d => {
        const label = d.version ? `${d.name} (${d.version})` : d.name
        return `### ${label}\n${d.content?.substring(0, 4000) ?? '(sem conteúdo extraído)'}`
      }).join('\n\n')
    : 'Nenhum documento de referência cadastrado para LGPD.'

  const linksSection = referenceLinks.length > 0
    ? `\n\n## Links de Referência Externos\nConteúdos extraídos de páginas web selecionadas para esta análise:\n\n${referenceLinks.map(l => `### ${l.name} (${l.url})\n${l.content.substring(0, 4000)}`).join('\n\n')}`
    : ''

  const restrictionSection = restrictToContext
    ? `\n## ⚠️ MODO RESTRITO — Apenas Base de Conhecimento Fornecida\nIMPORTANTE: Baseie-se EXCLUSIVAMENTE nos materiais de referência listados acima. Não utilize conhecimento externo de treinamento não fornecido explicitamente.\n`
    : ''

  return `Você é um especialista sênior em LGPD (Lei Geral de Proteção de Dados — Lei nº 13.709/2018) da LF Auditoria e Consultoria.

## Sua Missão
Analisar o documento fornecido e identificar APENAS as cláusulas/seções que necessitam de adequação à LGPD, propondo uma reescrita objetiva para cada uma.
${restrictionSection}
## Materiais de Referência Cadastrados
${refContext}
${linksSection}

## Instruções
1. Leia o documento identificando cláusulas com problemas de conformidade LGPD
2. Para cada cláusula problemática: registre a referência, um trecho representativo do texto original (máx. 400 caracteres), o texto proposto (completo e adequado) e a justificativa em 1-2 frases
3. Fundamente cada proposta no artigo/inciso específico da LGPD
4. CRÍTICO: O JSON deve estar COMPLETO e válido. Se estiver próximo do limite, feche o array e o JSON corretamente antes de parar.

## Formato de Resposta
Responda SOMENTE com este JSON válido, sem texto adicional:
{
  "proposals": [
    {
      "reference": "<identificação da cláusula/seção>",
      "original": "<trecho representativo — máx. 400 caracteres>",
      "proposed": "<texto proposto completo e adequado à LGPD>",
      "justification": "<motivo da alteração em 1-2 frases>",
      "lgpd_basis": "<art. X, § Y da LGPD>"
    }
  ]
}

Use linguagem formal e profissional em português brasileiro.`
}

function buildSystemPrompt(
  theme: Theme,
  subtopic: Subtopic | null,
  referenceDocs: ReferenceDocument[],
  customPrompts: Array<{ title: string; content: string }>,
  customThemeName?: string,
  customSubtopicName?: string,
  oeaCriteria?: OeaCriteria | null,
  oeaItem?: OeaItem | null,
  restrictToContext?: boolean,
  referenceLinks: AnalysisReferenceLink[] = [],
): string {
  const themeName = customThemeName || theme.name
  const subtopicName = customSubtopicName || subtopic?.name

  const refContext = referenceDocs.length > 0
    ? referenceDocs.map(d => {
        const label = d.version ? `${d.name} (${d.version})` : d.name
        return `### ${label}\n${d.content?.substring(0, 4000) ?? '(sem conteúdo extraído)'}`
      }).join('\n\n')
    : 'Nenhum documento de referência cadastrado para este tema/subtema.'

  const linksSection = referenceLinks.length > 0
    ? `\n\n## Links de Referência Externos\nConteúdos extraídos de páginas web selecionadas para esta análise:\n\n${referenceLinks.map(l => `### ${l.name} (${l.url})\n${l.content.substring(0, 4000)}`).join('\n\n')}`
    : ''

  const promptsSection = customPrompts.length > 0
    ? `\n## Instruções Específicas do Gestor\nAs instruções abaixo foram definidas pelo gestor para este tipo de análise. Responda a cada uma delas de forma objetiva com base no documento analisado.\n${customPrompts.map((p, i) => `### Instrução ${i + 1}: ${p.title}\n${p.content}`).join('\n\n')}\n`
    : ''

  let oeaFocusSection = ''
  if (oeaItem && oeaCriteria) {
    oeaFocusSection = `\n## Foco da Análise: OEA Critério ${oeaCriteria.number} - ${oeaCriteria.name} / Item ${oeaItem.item_number}\n**Requisito específico a avaliar:**\n${oeaItem.description}\n\nAnalise o documento com foco neste requisito específico do OEA (IN RFB Nº 2.154). Avalie se o documento comprova, demonstra ou está em conformidade com este item em particular.\n`
  } else if (oeaCriteria) {
    oeaFocusSection = `\n## Foco da Análise: OEA Critério ${oeaCriteria.number} - ${oeaCriteria.name}\n**Descrição do critério:**\n${oeaCriteria.description ?? ''}\n\nAnalise o documento com foco nos requisitos deste critério do OEA (IN RFB Nº 2.154).\n`
  }

  const restrictionSection = restrictToContext
    ? `\n## ⚠️ MODO RESTRITO — Apenas Base de Conhecimento Fornecida\nIMPORTANTE: Nesta análise, baseie-se EXCLUSIVAMENTE nos materiais de referência listados acima e no conteúdo do documento do cliente. Não utilize conhecimento externo de treinamento (legislação, normas, regulamentos) que não esteja explicitamente presente nos materiais fornecidos. Quando um item não puder ser avaliado por falta de referência, registre: "Informação não disponível na base de conhecimento fornecida."\n`
    : ''

  return `Você é um especialista sênior em compliance e auditoria da LF Auditoria e Consultoria, com profundo conhecimento em ${themeName}${subtopicName ? ` - ${subtopicName}` : ''}.

## Sua missão
Analisar documentos de clientes com rigor técnico, identificando pontos de conformidade e não conformidade com base nos materiais de referência abaixo e nas normas aplicáveis.
${oeaFocusSection}
## Materiais de Referência Cadastrados
${refContext}
${linksSection}
${promptsSection}${restrictionSection}
## Instruções de Análise
1. Leia o documento do cliente atentamente
2. Responda objetivamente a cada instrução específica do gestor (se houver)
3. Compare item a item com os requisitos dos materiais de referência
4. Classifique cada ponto como: CONFORME, PARCIALMENTE CONFORME ou NÃO CONFORME
5. Justifique tecnicamente cada apontamento
6. Proponha sugestões de melhoria objetivas e acionáveis
7. Determine o grau geral de conformidade

## Formato de Resposta
Responda SEMPRE em JSON válido com a seguinte estrutura exata:
{
  "prompt_responses": [
    { "prompt": "<título/instrução do gestor>", "response": "<sua resposta objetiva sobre o documento em relação a essa instrução específica>" }
  ],
  "overall_compliance": "conforme" | "parcialmente_conforme" | "nao_conforme",
  "compliance_score": <número de 0 a 100>,
  "summary": "<resumo executivo do documento analisado, 3-5 frases>",
  "criteria_used": "<lista dos critérios e normas utilizados na avaliação>",
  "conforming_points": [
    { "item": "<item avaliado>", "description": "<justificativa>", "reference": "<norma/artigo de referência>" }
  ],
  "partial_points": [
    { "item": "<item avaliado>", "description": "<o que está parcialmente atendido e o que falta>", "reference": "<norma/artigo>" }
  ],
  "non_conforming_points": [
    { "item": "<item avaliado>", "description": "<justificativa da não conformidade>", "reference": "<norma/artigo>" }
  ],
  "improvement_suggestions": [
    { "priority": "alta" | "media" | "baixa", "item": "<ponto a melhorar>", "suggestion": "<ação recomendada objetiva>", "reference": "<norma/artigo>" }
  ],
  "conclusion": "<conclusão técnica completa da análise, incluindo recomendações gerais>"
}

Se não houver instruções específicas do gestor, retorne "prompt_responses" como array vazio [].
Seja criterioso, técnico e preciso. Use linguagem formal e profissional em português brasileiro.`
}

export async function analyzeDocument(
  input: DocumentInput,
  documentName: string,
  theme: Theme,
  subtopic: Subtopic | null,
  referenceDocs: ReferenceDocument[],
  customPrompts: Array<{ title: string; content: string }> = [],
  customThemeName?: string,
  customSubtopicName?: string,
  oeaCriteria?: OeaCriteria | null,
  oeaItem?: OeaItem | null,
  restrictToContext?: boolean,
  referenceLinks: AnalysisReferenceLink[] = [],
  workType: 'report' | 'adequacy' = 'report',
): Promise<AnalysisResult> {
  const client = getAnthropicClient()

  // ── Adequacy proposal path ────────────────────────────────────────────────────
  if (workType === 'adequacy') {
    const systemPrompt = buildAdequacySystemPrompt(referenceDocs, referenceLinks, restrictToContext)
    type ContentBlock = { type: 'text'; text: string } | { type: 'image'; source: { type: 'base64'; media_type: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'; data: string } }
    const userContent: string | ContentBlock[] = input.type === 'image'
      ? [
          { type: 'image', source: { type: 'base64', media_type: (['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const).includes(input.mediaType as 'image/jpeg') ? input.mediaType as 'image/jpeg' : 'image/jpeg', data: input.base64 } },
          { type: 'text', text: `## Documento para Adequação à LGPD: "${documentName}"\n\nAnalise a imagem do documento acima conforme as instruções.` },
        ]
      : `## Documento para Adequação à LGPD: "${documentName}"\n\n${input.content.substring(0, 50000)}`

    type SysBlock = { type: 'text'; text: string; cache_control?: { type: 'ephemeral' } }
    const response = await client.messages.create(
      {
        model: 'claude-sonnet-4-6',
        max_tokens: 16000,
        system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }] as SysBlock[] as Parameters<typeof client.messages.create>[0]['system'],
        messages: [{ role: 'user', content: userContent as Parameters<typeof client.messages.create>[0]['messages'][0]['content'] }],
      },
      { headers: { 'anthropic-beta': 'prompt-caching-2024-07-31' } },
    )

    const firstBlock = response.content[0]
    const rawText = firstBlock?.type === 'text' ? firstBlock.text : ''
    if (!rawText) throw new Error('A IA não retornou conteúdo para a proposta de adequação.')
    if (response.stop_reason === 'max_tokens') {
      console.warn('[adequacy] resposta cortada em max_tokens — tentando parsear JSON parcial')
    }
    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error(`A IA não retornou um JSON válido para a proposta de adequação. Resposta recebida: ${rawText.substring(0, 200)}`)
    let parsed: AdequacyResult
    try {
      parsed = JSON.parse(jsonMatch[0])
    } catch (parseErr) {
      throw new Error(`Erro ao interpretar a resposta da IA: ${parseErr instanceof Error ? parseErr.message : 'JSON inválido'}`)
    }

    return {
      overall_compliance: 'parcialmente_conforme' as ComplianceLevel,
      compliance_score: 0,
      summary: '',
      criteria_used: 'LGPD — Lei nº 13.709/2018',
      prompt_responses: [],
      conforming_points: [],
      partial_points: [],
      non_conforming_points: [],
      improvement_suggestions: [],
      conclusion: '',
      raw_analysis: ADEQUACY_RAW_PREFIX + JSON.stringify(parsed),
    }
  }

  // ── Standard compliance report path ──────────────────────────────────────────
  const systemPrompt = buildSystemPrompt(theme, subtopic, referenceDocs, customPrompts, customThemeName, customSubtopicName, oeaCriteria, oeaItem, restrictToContext, referenceLinks)

  type ContentBlock =
    | { type: 'text'; text: string }
    | { type: 'image'; source: { type: 'base64'; media_type: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'; data: string } }

  let userContent: string | ContentBlock[]

  if (input.type === 'image') {
    const validMediaTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const
    type ValidMediaType = typeof validMediaTypes[number]
    const mediaType: ValidMediaType = validMediaTypes.includes(input.mediaType as ValidMediaType)
      ? (input.mediaType as ValidMediaType)
      : 'image/jpeg'

    userContent = [
      {
        type: 'image',
        source: { type: 'base64', media_type: mediaType, data: input.base64 },
      },
      {
        type: 'text',
        text: `## Documento para Análise: "${documentName}"\n\nAnalise a imagem do documento acima conforme as instruções.`,
      },
    ]
  } else {
    userContent = `## Documento para Análise: "${documentName}"\n\n${input.content.substring(0, 50000)}`
  }

  type SysBlock = { type: 'text'; text: string; cache_control?: { type: 'ephemeral' } }

  const response = await client.messages.create(
    {
      model: 'claude-sonnet-4-6',
      max_tokens: 16000,
      system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }] as SysBlock[] as Parameters<typeof client.messages.create>[0]['system'],
      messages: [{ role: 'user', content: userContent as Parameters<typeof client.messages.create>[0]['messages'][0]['content'] }],
    },
    { headers: { 'anthropic-beta': 'prompt-caching-2024-07-31' } },
  )

  const rawText = response.content[0].type === 'text' ? response.content[0].text : ''

  const jsonMatch = rawText.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('A IA não retornou um JSON válido na análise.')
  }

  const parsed = JSON.parse(jsonMatch[0])

  return {
    overall_compliance: parsed.overall_compliance ?? 'nao_conforme',
    compliance_score: Math.min(100, Math.max(0, parsed.compliance_score ?? 0)),
    summary: parsed.summary ?? '',
    criteria_used: parsed.criteria_used ?? '',
    prompt_responses: parsed.prompt_responses ?? [],
    conforming_points: parsed.conforming_points ?? [],
    partial_points: parsed.partial_points ?? [],
    non_conforming_points: parsed.non_conforming_points ?? [],
    improvement_suggestions: parsed.improvement_suggestions ?? [],
    conclusion: parsed.conclusion ?? '',
    raw_analysis: rawText,
  }
}

const REPORT_PATCH_PREFIX = 'REPORT_PATCH:'

export async function chatWithAnalysis(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  analysisContext: string,
  theme: Theme,
  subtopic: Subtopic | null,
  documentContent: string = '',
  documentImage?: { base64: string; mediaType: string } | null,
  currentReport?: Report | null,
): Promise<{ message: string; patch: Partial<Report> | null }> {
  const client = getAnthropicClient()

  const documentSection = documentContent.trim()
    ? `\n## Conteúdo Original do Documento Analisado\n${documentContent.substring(0, 50000)}\n`
    : documentImage
      ? '\n## Documento Original\nO documento enviado é uma imagem — consulte-a nas mensagens da conversa.\n'
      : ''

  const reportState = currentReport
    ? JSON.stringify({
        summary: currentReport.summary,
        conclusion: currentReport.conclusion,
        criteria_used: currentReport.criteria_used,
        overall_compliance: currentReport.overall_compliance,
        compliance_score: currentReport.compliance_score,
        conforming_points: currentReport.conforming_points,
        partial_points: currentReport.partial_points,
        non_conforming_points: currentReport.non_conforming_points,
        improvement_suggestions: currentReport.improvement_suggestions,
        prompt_responses: currentReport.prompt_responses,
      })
    : null

  const editSection = reportState
    ? `\n## Estado Atual do Relatório\n${reportState}\n
## Capacidade de Edição
Quando o colaborador solicitar alterações no relatório (remover apontamentos, alterar textos, adicionar sugestões, recalcular score etc.), você PODE editar o relatório diretamente.

Para aplicar edições, após a sua resposta de texto normal, adicione EXATAMENTE este bloco no final:

REPORT_PATCH:{"campo": valor}

Campos editáveis:
- "summary": resumo executivo (string)
- "conclusion": conclusão da análise (string)
- "criteria_used": critérios utilizados (string)
- "overall_compliance": "conforme" | "parcialmente_conforme" | "nao_conforme"
- "compliance_score": 0 a 100
- "conforming_points": [{item, description, reference}]
- "partial_points": [{item, description, reference}]
- "non_conforming_points": [{item, description, reference}]
- "improvement_suggestions": [{priority: "alta"|"media"|"baixa", item, suggestion, reference}]
- "prompt_responses": [{prompt, response}]

Inclua NO PATCH apenas os campos que precisam mudar — não copie campos que não foram alterados.
Quando NÃO houver edição, NÃO inclua o bloco REPORT_PATCH.\n`
    : ''

  const systemPrompt = `Você é um assistente especialista da LF Auditoria e Consultoria, auxiliando na análise de conformidade em ${theme.name}${subtopic ? ` - ${subtopic.name}` : ''}.

Você tem acesso ao documento original enviado pelo colaborador e ao relatório de análise gerado. Use ambos para responder com precisão às perguntas.
${documentSection}
## Relatório de Análise Gerado
${analysisContext}
${editSection}
Responda às perguntas do colaborador com base no documento e na análise, sendo claro, técnico e objetivo. Quando citar trechos do documento, indique que está referenciando o documento original. Use português brasileiro formal.`

  type TextBlock = { type: 'text'; text: string }
  type ImageBlock = { type: 'image'; source: { type: 'base64'; media_type: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'; data: string } }
  type MsgContent = string | Array<TextBlock | ImageBlock>
  type ChatMsg = { role: 'user' | 'assistant'; content: MsgContent }

  let conversationMessages: ChatMsg[] = messages

  // Prepend image as first context turn so the model can see the document in all subsequent turns
  if (documentImage) {
    const validMediaTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const
    const mediaType = validMediaTypes.includes(documentImage.mediaType as typeof validMediaTypes[number])
      ? (documentImage.mediaType as typeof validMediaTypes[number])
      : 'image/jpeg'

    conversationMessages = [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: documentImage.base64 },
          },
          { type: 'text', text: 'Este é o documento original enviado para análise. Consulte-o ao responder as perguntas.' },
        ],
      },
      {
        role: 'assistant',
        content: 'Entendido. Tenho acesso ao documento original e estou pronto para ajudar.',
      },
      ...messages,
    ]
  }

  type SysBlock2 = { type: 'text'; text: string; cache_control?: { type: 'ephemeral' } }

  const response = await client.messages.create(
    {
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }] as SysBlock2[] as Parameters<typeof client.messages.create>[0]['system'],
      messages: conversationMessages as Parameters<typeof client.messages.create>[0]['messages'],
    },
    { headers: { 'anthropic-beta': 'prompt-caching-2024-07-31' } },
  )

  const rawText = response.content[0].type === 'text' ? response.content[0].text : ''

  let message = rawText
  let patch: Partial<Report> | null = null

  const patchIndex = rawText.lastIndexOf(REPORT_PATCH_PREFIX)
  if (patchIndex !== -1) {
    const candidate = rawText.slice(patchIndex + REPORT_PATCH_PREFIX.length).trim()
    try {
      patch = JSON.parse(candidate)
      message = rawText.slice(0, patchIndex).trim()
    } catch {
      // malformed patch — return full text as message
    }
  }

  return { message, patch }
}
