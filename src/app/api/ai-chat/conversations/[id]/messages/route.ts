import { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase/admin'
import { generalChat, ChatAttachment, KnowledgeBaseDoc, KnowledgeBaseLink } from '@/lib/anthropic/general-chat'

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
  const { id: conversationId } = await props.params
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  const supabase = buildSupabase(token)

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await req.json()
  const content: string = body.content
  const attachments: ChatAttachment[] = body.attachments ?? []
  const restrictToContext: boolean = body.useExternalKnowledge === false

  if (!content?.trim()) {
    return Response.json({ error: 'Mensagem não pode estar vazia' }, { status: 400 })
  }

  // Verify the conversation belongs to this user (RLS handles it, but explicit check for cleaner error)
  const { data: conv, error: convError } = await supabase
    .from('ai_chat_conversations')
    .select('id, title')
    .eq('id', conversationId)
    .single()

  if (convError || !conv) {
    return Response.json({ error: 'Conversa não encontrada' }, { status: 404 })
  }

  // Fetch conversation history, knowledge base docs and links in parallel
  const admin = createAdminClient()
  const [historyResult, kbResult, linksResult] = await Promise.all([
    supabase
      .from('ai_chat_messages')
      .select('role, content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true }),
    admin
      .from('reference_documents')
      .select('name, version, content')
      .not('content', 'is', null)
      .order('created_at', { ascending: true })
      .limit(30),
    admin
      .from('reference_links')
      .select('name, url, content')
      .not('content', 'is', null)
      .order('created_at', { ascending: true })
      .limit(20),
  ])

  const historyMessages = (historyResult.data ?? []).map(m => ({
    role: m.role as 'user' | 'assistant',
    content: m.content as string,
  }))

  const knowledgeBaseDocs: KnowledgeBaseDoc[] = (kbResult.data ?? [])
    .filter(d => d.content && d.name)
    .map(d => ({
      name: d.name as string,
      version: d.version as string | null | undefined,
      content: (d.content as string).substring(0, 3000),
    }))

  const knowledgeBaseLinks: KnowledgeBaseLink[] = (linksResult.data ?? [])
    .filter(l => l.content && l.name)
    .map(l => ({
      name: l.name as string,
      url: l.url as string,
      content: (l.content as string).substring(0, 3000),
    }))

  // Call the AI
  let aiResponse: string
  try {
    aiResponse = await generalChat(historyMessages, content, attachments, restrictToContext, knowledgeBaseDocs, knowledgeBaseLinks)
  } catch (err) {
    console.error('[ai-chat/messages]', err)
    return Response.json({ error: 'Erro ao processar mensagem com a IA' }, { status: 500 })
  }

  // Persist user message
  const attachmentsMeta = attachments.map(a => ({
    name: a.name,
    type: a.type,
    mediaType: a.mediaType,
    // do not persist full base64/large content
    hasContent: !!a.content,
  }))

  const { data: savedMessages, error: insertError } = await supabase
    .from('ai_chat_messages')
    .insert([
      { conversation_id: conversationId, role: 'user', content, attachments: attachmentsMeta },
      { conversation_id: conversationId, role: 'assistant', content: aiResponse, attachments: [] },
    ])
    .select('id, conversation_id, role, content, attachments, created_at')

  if (insertError) {
    return Response.json({ error: insertError.message }, { status: 500 })
  }

  // Auto-update conversation title from first user message
  if (historyMessages.length === 0 && conv.title === 'Nova conversa') {
    const autoTitle = content.length > 60 ? content.slice(0, 57) + '...' : content
    await supabase
      .from('ai_chat_conversations')
      .update({ title: autoTitle })
      .eq('id', conversationId)
  }

  const [userMsg, assistantMsg] = savedMessages ?? []
  return Response.json({ userMessage: userMsg, assistantMessage: assistantMsg }, { status: 201 })
}
