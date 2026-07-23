import { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase/admin'
import { analyzeDocument, DocumentInput, AnalysisReferenceLink } from '@/lib/anthropic/analysis'
import { extractTextFromFile } from '@/lib/document-parser'
import { fetchUrlContent } from '@/lib/fetch-url-content'
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

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  const supabase = buildSupabase(token)
  const admin = createAdminClient()
  let createdAnalysisId: string | null = null

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return Response.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const themeId = formData.get('themeId') as string
    const subtopicId = formData.get('subtopicId') as string | null
    const clientName = formData.get('clientName') as string | null
    const customThemeName = formData.get('customThemeName') as string | null
    const customSubtopicName = formData.get('customSubtopicName') as string | null
    const activeRefDocIdsRaw = formData.get('activeRefDocIds') as string | null
    const customPromptsRaw = formData.get('customPrompts') as string | null

    if (!file || !themeId) {
      return Response.json({ error: 'Arquivo e tema são obrigatórios' }, { status: 400 })
    }

    const maxSize = 4 * 1024 * 1024
    if (file.size > maxSize) {
      return Response.json({ error: 'Arquivo muito grande. O limite é 4MB. Reduza o tamanho do PDF ou divida o documento.' }, { status: 413 })
    }

    const activeRefDocIds: string[] = activeRefDocIdsRaw ? JSON.parse(activeRefDocIdsRaw) : []
    const customPrompts: Array<{ title: string; content: string }> = customPromptsRaw ? JSON.parse(customPromptsRaw) : []
    const sessionDocsRaw = formData.get('sessionDocs') as string | null
    const sessionDocs: Array<{ name: string; file_type: string | null; content: string }> = sessionDocsRaw ? JSON.parse(sessionDocsRaw) : []
    const sessionLinksRaw = formData.get('sessionLinks') as string | null
    const sessionLinksInput: Array<{ name: string; url: string; content: string | null }> = sessionLinksRaw ? JSON.parse(sessionLinksRaw) : []
    const selectedOeaCriteriaId = formData.get('selectedOeaCriteriaId') as string | null
    const selectedOeaItemId = formData.get('selectedOeaItemId') as string | null
    const useExternalKnowledgeRaw = formData.get('useExternalKnowledge') as string | null
    const restrictToContext = useExternalKnowledgeRaw === 'false'
    const workType = (formData.get('workType') as string | null ?? 'report') as 'report' | 'adequacy'

    // Admin client para dados de configuração (themes, subtopics, reference_documents)
    const [{ data: theme }, { data: subtopic }, { data: oeaCriteriaData }, { data: oeaItemData }] = await Promise.all([
      admin.from('themes').select('*').eq('id', themeId).single(),
      subtopicId ? admin.from('subtopics').select('*').eq('id', subtopicId).single() : Promise.resolve({ data: null }),
      selectedOeaCriteriaId ? admin.from('oea_criteria').select('*').eq('id', selectedOeaCriteriaId).single() : Promise.resolve({ data: null }),
      selectedOeaItemId ? admin.from('oea_items').select('*').eq('id', selectedOeaItemId).single() : Promise.resolve({ data: null }),
    ])

    if (!theme) {
      return Response.json({ error: 'Tema não encontrado' }, { status: 404 })
    }

    // Determine input type: image vs extractable document
    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    const imageExts = ['jpg', 'jpeg', 'png', 'webp']
    const isImage = imageExts.includes(ext)

    let documentInput: DocumentInput
    if (isImage) {
      const buffer = await file.arrayBuffer()
      const base64 = Buffer.from(buffer).toString('base64')
      const mediaType = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`
      documentInput = { type: 'image', base64, mediaType }
    } else {
      const content = await extractTextFromFile(file)
      if (!content.trim()) {
        return Response.json({ error: 'Não foi possível extrair texto do documento' }, { status: 400 })
      }
      documentInput = { type: 'text', content }
    }

    // Admin client para reference_documents
    let refQuery = admin.from('reference_documents').select('*')
    if (activeRefDocIds.length > 0) {
      refQuery = refQuery.in('id', activeRefDocIds)
    } else {
      refQuery = refQuery.eq('theme_id', themeId)
      if (subtopicId) {
        refQuery = refQuery.or(`subtopic_id.eq.${subtopicId},subtopic_id.is.null`)
      }
      if (selectedOeaItemId) {
        refQuery = refQuery.or(`oea_item_id.eq.${selectedOeaItemId},oea_item_id.is.null`)
      } else if (selectedOeaCriteriaId) {
        refQuery = refQuery.or(`oea_criteria_id.eq.${selectedOeaCriteriaId},oea_criteria_id.is.null`)
      }
    }
    const { data: dbDocs } = await refQuery

    const referenceDocs: ReferenceDocument[] = [
      ...(dbDocs ?? []),
      ...sessionDocs.map(d => ({
        id: crypto.randomUUID(),
        theme_id: themeId,
        subtopic_id: null,
        name: d.name,
        description: null,
        file_path: null,
        file_type: d.file_type,
        file_size: null,
        content: d.content,
        uploaded_by: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as ReferenceDocument)),
    ]

    // Create analysis record
    const { data: analysis, error: insertError } = await supabase
      .from('analyses')
      .insert({
        user_id: user.id,
        theme_id: themeId,
        subtopic_id: subtopicId ?? null,
        oea_criteria_id: selectedOeaCriteriaId ?? null,
        oea_item_id: selectedOeaItemId ?? null,
        client_name: clientName ?? null,
        document_name: file.name,
        document_type: ext || 'unknown',
        document_content: documentInput.type === 'text' ? documentInput.content.substring(0, 100000) : null,
        status: 'processing',
        custom_theme_name: customThemeName ?? null,
        custom_subtopic_name: customSubtopicName ?? null,
      })
      .select()
      .single()

    if (insertError || !analysis) {
      console.error('[analyze] insert error:', insertError)
      return Response.json({ error: `Erro ao criar análise: ${insertError?.message ?? 'sem dados'}` }, { status: 500 })
    }

    createdAnalysisId = analysis.id

    // Upload image to storage so the chat assistant can reference the original document
    if (isImage) {
      const storagePath = `${user.id}/${analysis.id}.${ext}`
      const fileBuffer = documentInput.type === 'image'
        ? Buffer.from(documentInput.base64, 'base64')
        : Buffer.from(await file.arrayBuffer())
      const mediaType = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`
      const { error: storageError } = await admin.storage
        .from('analysis-images')
        .upload(storagePath, fileBuffer, { contentType: mediaType, upsert: false })
      if (!storageError) {
        await supabase.from('analyses').update({ document_path: storagePath }).eq('id', analysis.id)
      } else {
        console.error('[analyze] storage upload error:', storageError)
      }
    }

    // Resolve link content: try DB first for registered links, then fetch from URL
    let referenceLinks: AnalysisReferenceLink[] = []
    if (sessionLinksInput.length > 0) {
      const linksNeedingContent = sessionLinksInput.filter(l => !l.content)
      const urlsNeedingContent = linksNeedingContent.map(l => l.url)
      const dbContentMap = new Map<string, string>()

      if (urlsNeedingContent.length > 0) {
        const { data: dbLinks } = await admin
          .from('reference_links')
          .select('url, content')
          .in('url', urlsNeedingContent)
          .not('content', 'is', null)
        for (const row of dbLinks ?? []) {
          if (row.url && row.content) dbContentMap.set(row.url, row.content as string)
        }
      }

      referenceLinks = (
        await Promise.all(
          sessionLinksInput.map(async (l) => {
            const content = l.content ?? dbContentMap.get(l.url) ?? await fetchUrlContent(l.url).catch(() => null)
            if (!content) return null
            return { name: l.name, url: l.url, content }
          })
        )
      ).filter((l): l is AnalysisReferenceLink => l !== null)
    }

    const result = await analyzeDocument(
      documentInput,
      file.name,
      theme as Theme,
      subtopic as Subtopic | null,
      (referenceDocs ?? []) as ReferenceDocument[],
      customPrompts,
      customThemeName ?? undefined,
      customSubtopicName ?? undefined,
      oeaCriteriaData as OeaCriteria | null,
      oeaItemData as OeaItem | null,
      restrictToContext,
      referenceLinks,
      workType,
    )

    const reportPayload: Record<string, unknown> = {
      analysis_id: analysis.id,
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

    let { error: reportError } = await supabase.from('reports').insert(reportPayload)

    // Fallback: retry without prompt_responses if column doesn't exist yet
    if (reportError) {
      const { prompt_responses: _pr, ...payloadWithoutPromptResponses } = reportPayload
      const fallback = await supabase.from('reports').insert(payloadWithoutPromptResponses)
      reportError = fallback.error
    }

    if (reportError) {
      console.error('[analyze] report insert error:', reportError)
      throw new Error(`Erro ao salvar relatório: ${reportError.message}`)
    }

    await supabase.from('analyses').update({ status: 'completed' }).eq('id', analysis.id)

    return Response.json({ analysisId: analysis.id, success: true })
  } catch (err: unknown) {
    console.error('[analyze]', err)
    if (createdAnalysisId) {
      await supabase
        .from('analyses')
        .update({ status: 'failed', error_message: err instanceof Error ? err.message : 'Erro desconhecido' })
        .eq('id', createdAnalysisId)
    }
    return Response.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 }
    )
  }
}
