import { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase/admin'
import { chatWithAnalysis } from '@/lib/anthropic/analysis'
import { Theme, Subtopic } from '@/types'

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: { getAll: () => [], setAll: () => {} },
        global: token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
      }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'Não autorizado' }, { status: 401 })

    const body = await req.json()
    const { analysisId, messages, analysisContext, documentContent, themeId, subtopicId, currentReport } = body

    if (!analysisId || !messages || !themeId) {
      return Response.json({ error: 'Parâmetros inválidos' }, { status: 400 })
    }

    const admin = createAdminClient()
    const [{ data: theme }, { data: subtopic }, { data: analysisRecord }] = await Promise.all([
      supabase.from('themes').select('*').eq('id', themeId).single(),
      subtopicId ? supabase.from('subtopics').select('*').eq('id', subtopicId).single() : Promise.resolve({ data: null }),
      supabase.from('analyses').select('document_path, document_type').eq('id', analysisId).single(),
    ])

    if (!theme) return Response.json({ error: 'Tema não encontrado' }, { status: 404 })

    // Load image from storage if this analysis used an image document
    let documentImage: { base64: string; mediaType: string } | null = null
    const imagePath = analysisRecord?.document_path
    if (imagePath) {
      const { data: imageBlob } = await admin.storage.from('analysis-images').download(imagePath)
      if (imageBlob) {
        const buffer = Buffer.from(await imageBlob.arrayBuffer())
        const ext = imagePath.split('.').pop()?.toLowerCase() ?? 'jpeg'
        documentImage = {
          base64: buffer.toString('base64'),
          mediaType: ext === 'jpg' ? 'image/jpeg' : `image/${ext}`,
        }
      }
    }

    const { message, patch } = await chatWithAnalysis(
      messages,
      analysisContext ?? '',
      theme as Theme,
      subtopic as Subtopic | null,
      documentContent ?? '',
      documentImage,
      currentReport ?? null,
    )

    // Save chat messages
    await supabase.from('chat_messages').insert([
      { analysis_id: analysisId, role: 'user', content: messages[messages.length - 1].content },
      { analysis_id: analysisId, role: 'assistant', content: message },
    ])

    return Response.json({ response: message, patch })
  } catch (err: unknown) {
    console.error('[chat]', err)
    return Response.json({ error: 'Erro interno' }, { status: 500 })
  }
}
