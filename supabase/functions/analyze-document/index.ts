// Supabase Edge Function — runs on Deno, independent of Vercel timeouts.
// Called by /api/analyze with { analysisId, workType } right after the DB insert.
// Loads all data from DB, calls Anthropic, saves the report.
// @ts-nocheck — Deno globals and npm: imports are not available in tsc

import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
}

// ── Utility: fix literal newlines/tabs inside JSON string values ─────────────
function fixJsonString(raw: string): string {
  let inString = false, escaped = false, result = ''
  for (const char of raw) {
    if (escaped) { result += char; escaped = false; continue }
    if (char === '\\') { escaped = true; result += char; continue }
    if (char === '"') { inString = !inString; result += char; continue }
    if (inString) {
      if (char === '\n') { result += '\\n'; continue }
      if (char === '\r') { result += '\\r'; continue }
      if (char === '\t') { result += '\\t'; continue }
    }
    result += char
  }
  return result
}

// ── Prompt builders (mirrors analysis.ts logic) ──────────────────────────────
function buildAdequacyPrompt(referenceDocs: any[], referenceLinks: any[], restrictToContext: boolean): string {
  const refContext = referenceDocs.length > 0
    ? referenceDocs.map((d: any) => {
        const label = d.version ? `${d.name} (${d.version})` : d.name
        return `### ${label}\n${(d.content ?? '(sem conteúdo extraído)').substring(0, 4000)}`
      }).join('\n\n')
    : 'Nenhum documento de referência cadastrado para LGPD.'

  const linksSection = referenceLinks.length > 0
    ? `\n\n## Links de Referência Externos\n${referenceLinks.map((l: any) => `### ${l.name} (${l.url})\n${l.content.substring(0, 4000)}`).join('\n\n')}`
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

function buildReportPrompt(
  theme: any,
  subtopic: any,
  referenceDocs: any[],
  customPrompts: Array<{ title: string; content: string }>,
  customThemeName: string | undefined,
  customSubtopicName: string | undefined,
  oeaCriteria: any,
  oeaItem: any,
  restrictToContext: boolean,
  oeaCriteriaList: any[],
): string {
  const themeName = customThemeName || theme.name
  const subtopicName = customSubtopicName || subtopic?.name

  const refContext = referenceDocs.length > 0
    ? referenceDocs.map((d: any) => {
        const label = d.version ? `${d.name} (${d.version})` : d.name
        return `### ${label}\n${(d.content ?? '(sem conteúdo extraído)').substring(0, 4000)}`
      }).join('\n\n')
    : 'Nenhum documento de referência cadastrado para este tema/subtema.'

  const promptsSection = customPrompts.length > 0
    ? `\n## Instruções Específicas do Gestor\n${customPrompts.map((p, i) => `### Instrução ${i + 1}: ${p.title}\n${p.content}`).join('\n\n')}\n`
    : ''

  const REF_OEA = 'IN RFB Nº 2.318 de 26/03/2026 e Portaria COANA Nº 187 de 02/04/2026'
  let oeaFocusSection = ''
  if (oeaCriteriaList && oeaCriteriaList.length > 1) {
    const lines = oeaCriteriaList.map((c: any) => `- **Critério ${c.number} - ${c.name}**: ${c.description ?? ''}`).join('\n')
    oeaFocusSection = `\n## Foco da Análise: Múltiplos Critérios OEA (${REF_OEA})\nAnalise o documento avaliando a conformidade com TODOS os critérios listados abaixo:\n${lines}\n`
  } else if (oeaItem && oeaCriteria) {
    oeaFocusSection = `\n## Foco da Análise: OEA Critério ${oeaCriteria.number} - ${oeaCriteria.name} / Item ${oeaItem.item_number}\n**Requisito específico a avaliar:**\n${oeaItem.description}\n\nAnalise o documento com foco neste requisito específico do OEA (${REF_OEA}).\n`
  } else if (oeaCriteria) {
    oeaFocusSection = `\n## Foco da Análise: OEA Critério ${oeaCriteria.number} - ${oeaCriteria.name}\n**Descrição do critério:**\n${oeaCriteria.description ?? ''}\n\nAnalise o documento com foco nos requisitos deste critério do OEA (${REF_OEA}).\n`
  }

  const restrictionSection = restrictToContext
    ? `\n## ⚠️ MODO RESTRITO — Apenas Base de Conhecimento Fornecida\nIMPORTANTE: Nesta análise, baseie-se EXCLUSIVAMENTE nos materiais de referência listados acima e no conteúdo do documento do cliente. Não utilize conhecimento externo de treinamento que não esteja explicitamente presente nos materiais fornecidos.\n`
    : ''

  return `Você é um especialista sênior em compliance e auditoria da LF Auditoria e Consultoria, com profundo conhecimento em ${themeName}${subtopicName ? ` - ${subtopicName}` : ''}.

## Sua missão
Analisar documentos de clientes com rigor técnico, identificando pontos de conformidade e não conformidade com base nos materiais de referência abaixo e nas normas aplicáveis.
${oeaFocusSection}
## Materiais de Referência Cadastrados
${refContext}
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
    { "prompt": "<título/instrução do gestor>", "response": "<sua resposta objetiva>" }
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

// ── Main handler ─────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')!

  // Verify caller is trusted (service role key)
  const auth = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (auth !== serviceKey) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
  }

  const { analysisId, workType = 'report' } = await req.json()
  if (!analysisId) {
    return new Response(JSON.stringify({ error: 'analysisId obrigatório' }), { status: 400, headers: corsHeaders })
  }

  const db = createClient(supabaseUrl, serviceKey)

  try {
    // 1. Load the analysis record
    const { data: analysis, error: analysisErr } = await db
      .from('analyses')
      .select('*')
      .eq('id', analysisId)
      .single()

    if (analysisErr || !analysis) {
      throw new Error(`Análise não encontrada: ${analysisErr?.message}`)
    }

    // Skip if already handled by another process (e.g. after() also ran)
    if (analysis.status !== 'processing') {
      return new Response(JSON.stringify({ skip: true, status: analysis.status }), { headers: corsHeaders })
    }

    if (!analysis.document_content && !analysis.document_path) {
      throw new Error('Dados do documento não encontrados para reprocessamento')
    }

    // 2. Reconstruct document input
    let documentInput: { type: 'text'; content: string } | { type: 'image'; base64: string; mediaType: string }

    if (analysis.document_path) {
      const ext = (analysis.document_type ?? 'jpg').toLowerCase()
      const { data: fileData, error: dlErr } = await db.storage
        .from('analysis-images')
        .download(analysis.document_path)
      if (dlErr || !fileData) throw new Error('Falha ao baixar imagem do Storage')

      const buf = await fileData.arrayBuffer()
      const bytes = new Uint8Array(buf)
      let binary = ''
      for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
      const base64 = btoa(binary)
      const mediaTypeMap: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }
      documentInput = { type: 'image', base64, mediaType: mediaTypeMap[ext] ?? 'image/jpeg' }
    } else {
      documentInput = { type: 'text', content: analysis.document_content as string }
    }

    // 3. Load related entities in parallel
    const [
      { data: theme },
      { data: subtopic },
      { data: oeaCriteria },
      { data: oeaItem },
    ] = await Promise.all([
      db.from('themes').select('*').eq('id', analysis.theme_id).single(),
      analysis.subtopic_id
        ? db.from('subtopics').select('*').eq('id', analysis.subtopic_id).single()
        : Promise.resolve({ data: null }),
      analysis.oea_criteria_id
        ? db.from('oea_criteria').select('*, items:oea_items(*)').eq('id', analysis.oea_criteria_id).single()
        : Promise.resolve({ data: null }),
      analysis.oea_item_id
        ? db.from('oea_items').select('*').eq('id', analysis.oea_item_id).single()
        : Promise.resolve({ data: null }),
    ])

    if (!theme) throw new Error('Tema não encontrado')

    // 4. Load reference docs
    let refQuery = db.from('reference_documents').select('*').eq('theme_id', analysis.theme_id)
    if (analysis.subtopic_id) refQuery = refQuery.or(`subtopic_id.eq.${analysis.subtopic_id},subtopic_id.is.null`)
    if (analysis.oea_item_id) {
      refQuery = refQuery.or(`oea_item_id.eq.${analysis.oea_item_id},oea_item_id.is.null`)
    } else if (analysis.oea_criteria_id) {
      refQuery = refQuery.or(`oea_criteria_id.eq.${analysis.oea_criteria_id},oea_criteria_id.is.null`)
    }
    const { data: referenceDocs } = await refQuery

    // 5. Load default prompts
    let promptQuery = db.from('reference_prompts').select('*').eq('is_active', true).eq('theme_id', analysis.theme_id)
    if (analysis.subtopic_id) {
      promptQuery = promptQuery.or(`subtopic_id.eq.${analysis.subtopic_id},subtopic_id.is.null`)
    } else {
      promptQuery = promptQuery.is('subtopic_id', null)
    }
    if (analysis.oea_item_id) {
      promptQuery = promptQuery.or(`oea_item_id.eq.${analysis.oea_item_id},oea_item_id.is.null`)
    } else if (analysis.oea_criteria_id) {
      promptQuery = promptQuery.or(`oea_criteria_id.eq.${analysis.oea_criteria_id},oea_criteria_id.is.null`)
    }
    const { data: dbPrompts } = await promptQuery
    const customPrompts = (dbPrompts ?? []).map((p: any) => ({ title: p.title, content: p.content }))

    // 6. Build system prompt
    const isAdequacy = workType === 'adequacy'
    const systemPrompt = isAdequacy
      ? buildAdequacyPrompt(referenceDocs ?? [], [], false)
      : buildReportPrompt(theme, subtopic, referenceDocs ?? [], customPrompts, analysis.custom_theme_name ?? undefined, analysis.custom_subtopic_name ?? undefined, oeaCriteria, oeaItem, false, [])

    // 7. Build user message content
    const documentName = analysis.document_name
    let userContent: any
    if (documentInput.type === 'image') {
      const validMediaTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
      const mt = validMediaTypes.includes(documentInput.mediaType) ? documentInput.mediaType : 'image/jpeg'
      userContent = [
        { type: 'image', source: { type: 'base64', media_type: mt, data: documentInput.base64 } },
        { type: 'text', text: `## Documento para Análise: "${documentName}"\n\nAnalise a imagem do documento acima conforme as instruções.` },
      ]
    } else {
      const prefix = isAdequacy ? 'Adequação à LGPD' : 'Análise'
      userContent = `## Documento para ${prefix}: "${documentName}"\n\n${documentInput.content.substring(0, 50000)}`
    }

    // 8. Call Anthropic API
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'prompt-caching-2024-07-31',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 16000,
        system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: userContent }],
      }),
    })

    if (!anthropicRes.ok) {
      const errBody = await anthropicRes.text()
      throw new Error(`Anthropic API error ${anthropicRes.status}: ${errBody.substring(0, 200)}`)
    }

    const anthropicData = await anthropicRes.json()
    const rawText: string = anthropicData.content?.[0]?.text ?? ''
    if (!rawText) throw new Error('Anthropic não retornou conteúdo')

    // 9. Parse JSON response
    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('Resposta da IA sem JSON válido')

    let parsed: any
    try { parsed = JSON.parse(jsonMatch[0]) }
    catch { parsed = JSON.parse(fixJsonString(jsonMatch[0])) }

    // 10. Build report payload
    const reportPayload: Record<string, any> = isAdequacy
      ? {
          analysis_id: analysisId,
          overall_compliance: 'parcialmente_conforme',
          compliance_score: 0,
          summary: '',
          criteria_used: 'LGPD — Lei nº 13.709/2018',
          prompt_responses: [],
          conforming_points: [],
          partial_points: [],
          non_conforming_points: [],
          improvement_suggestions: [],
          conclusion: '',
          raw_analysis: '__ADEQUACY__' + JSON.stringify(parsed),
        }
      : {
          analysis_id: analysisId,
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

    // 11. Remove any previous (failed) report and insert the new one
    await db.from('reports').delete().eq('analysis_id', analysisId)
    let { error: reportErr } = await db.from('reports').insert(reportPayload)
    if (reportErr) {
      const { prompt_responses: _pr, ...fallback } = reportPayload
      const res2 = await db.from('reports').insert(fallback)
      reportErr = res2.error
    }
    if (reportErr) throw new Error(`Erro ao salvar relatório: ${reportErr.message}`)

    await db.from('analyses').update({ status: 'completed' }).eq('id', analysisId)

    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders })

  } catch (err: any) {
    console.error('[analyze-document]', err)
    const msg = err?.message ?? 'Erro desconhecido'
    await db.from('analyses').update({ status: 'failed', error_message: msg }).eq('id', analysisId).catch(() => {})
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: corsHeaders })
  }
})
