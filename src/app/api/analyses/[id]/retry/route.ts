import { NextRequest, after } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase/admin'
import { analyzeDocument, DocumentInput } from '@/lib/anthropic/analysis'
import { Theme, Subtopic, ReferenceDocument, OeaCriteria, OeaItem } from '@/types'

export const maxDuration = 60

function buildSupabase(token?: string) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: { getAll: () => [], setAll: () => {} },
      global: token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
    }
  )
}

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  const supabase = buildSupabase(token)
  const admin = createAdminClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return Response.json({ error: 'Não autorizado' }, { status: 401 })
  }

  // Load the analysis (ownership check: user_id must match)
  const { data: analysis, error: analysisError } = await admin
    .from('analyses')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (analysisError || !analysis) {
    return Response.json({ error: 'Análise não encontrada' }, { status: 404 })
  }

  if (!analysis.document_content && !analysis.document_path) {
    return Response.json({ error: 'Dados do documento não disponíveis para reprocessamento' }, { status: 400 })
  }

  // Reconstruct documentInput from stored data
  let documentInput: DocumentInput
  if (analysis.document_path) {
    const ext = (analysis.document_type ?? 'jpg').toLowerCase()
    const { data: fileData, error: downloadError } = await admin.storage
      .from('analysis-images')
      .download(analysis.document_path)
    if (downloadError || !fileData) {
      return Response.json({ error: 'Não foi possível recuperar o documento para reprocessamento' }, { status: 500 })
    }
    const buffer = Buffer.from(await fileData.arrayBuffer())
    const base64 = buffer.toString('base64')
    const mediaTypeMap: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }
    const mediaType = mediaTypeMap[ext] ?? 'image/jpeg'
    documentInput = { type: 'image', base64, mediaType }
  } else {
    documentInput = { type: 'text', content: analysis.document_content as string }
  }

  // Load related DB entities in parallel
  const [
    { data: theme },
    { data: subtopic },
    { data: oeaCriteriaData },
    { data: oeaItemData },
  ] = await Promise.all([
    admin.from('themes').select('*').eq('id', analysis.theme_id).single(),
    analysis.subtopic_id
      ? admin.from('subtopics').select('*').eq('id', analysis.subtopic_id).single()
      : Promise.resolve({ data: null }),
    analysis.oea_criteria_id
      ? admin.from('oea_criteria').select('*, items:oea_items(*)').eq('id', analysis.oea_criteria_id).single()
      : Promise.resolve({ data: null }),
    analysis.oea_item_id
      ? admin.from('oea_items').select('*').eq('id', analysis.oea_item_id).single()
      : Promise.resolve({ data: null }),
  ])

  if (!theme) {
    return Response.json({ error: 'Tema não encontrado' }, { status: 404 })
  }

  // Fetch default reference docs
  let refQuery = admin.from('reference_documents').select('*').eq('theme_id', analysis.theme_id)
  if (analysis.subtopic_id) {
    refQuery = refQuery.or(`subtopic_id.eq.${analysis.subtopic_id},subtopic_id.is.null`)
  }
  if (analysis.oea_item_id) {
    refQuery = refQuery.or(`oea_item_id.eq.${analysis.oea_item_id},oea_item_id.is.null`)
  } else if (analysis.oea_criteria_id) {
    refQuery = refQuery.or(`oea_criteria_id.eq.${analysis.oea_criteria_id},oea_criteria_id.is.null`)
  }
  const { data: dbDocs } = await refQuery
  const referenceDocs: ReferenceDocument[] = (dbDocs ?? []) as ReferenceDocument[]

  // Fetch default prompts
  let promptQuery = admin.from('reference_prompts').select('*').eq('is_active', true).eq('theme_id', analysis.theme_id)
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
  const customPrompts = (dbPrompts ?? []).map((p: { title: string; content: string }) => ({ title: p.title, content: p.content }))

  // Reset status to processing so the polling component shows loading again
  await admin.from('analyses').update({ status: 'processing', error_message: null }).eq('id', id)

  const analysisId = id
  const documentName = analysis.document_name
  const customThemeName = analysis.custom_theme_name ?? undefined
  const customSubtopicName = analysis.custom_subtopic_name ?? undefined

  after(async () => {
    const adminBg = createAdminClient()
    try {
      const result = await analyzeDocument(
        documentInput,
        documentName,
        theme as Theme,
        subtopic as Subtopic | null,
        referenceDocs,
        customPrompts,
        customThemeName,
        customSubtopicName,
        oeaCriteriaData as OeaCriteria | null,
        oeaItemData as OeaItem | null,
        false,
        [],
        'report',
      )

      const reportPayload: Record<string, unknown> = {
        analysis_id: analysisId,
        overall_compliance: result.overall_compliance,
        compliance_score: result.compliance_score,
        summary: result.summary,
        criteria_used: result.criteria_used,
        prompt_responses: result.prompt_responses,
        conforming_points: result.conforming_points,
        partial_points: result.partial_points,
        non_conforming_points: result.non_conforming_points,
        improvement_suggestions: result.improvement_suggestions,
        conclusion: result.conclusion,
        raw_analysis: result.raw_analysis,
      }

      // Remove any previous failed report for this analysis before inserting
      await adminBg.from('reports').delete().eq('analysis_id', analysisId)

      let { error: reportError } = await adminBg.from('reports').insert(reportPayload)
      if (reportError) {
        const { prompt_responses: _pr, ...payloadWithoutPR } = reportPayload
        const fallback = await adminBg.from('reports').insert(payloadWithoutPR)
        reportError = fallback.error
      }
      if (reportError) throw new Error(`Erro ao salvar relatório: ${reportError.message}`)

      await adminBg.from('analyses').update({ status: 'completed' }).eq('id', analysisId)
    } catch (err: unknown) {
      console.error('[retry:background]', err)
      await adminBg.from('analyses').update({
        status: 'failed',
        error_message: err instanceof Error ? err.message : 'Erro desconhecido',
      }).eq('id', analysisId)
    }
  })

  return Response.json({ success: true })
}
