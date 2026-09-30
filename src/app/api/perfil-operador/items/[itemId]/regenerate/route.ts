import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthedAdmin } from '@/lib/perfil-operador/auth'
import { generateItemAnswer, humanizeApiError } from '@/lib/perfil-operador/generate-item'

export const maxDuration = 60

type Params = { params: Promise<{ itemId: string }> }

/** POST — (re)gera a resposta de um único item, usando somente os documentos vinculados a ele */
export async function POST(req: NextRequest, { params }: Params) {
  const { itemId } = await params
  const user = await getAuthedAdmin(req)
  if (!user) return Response.json({ error: 'Não autorizado' }, { status: 401 })

  const admin = createAdminClient()

  const { data: item } = await admin.from('perfil_operador_items').select('*').eq('id', itemId).single()
  if (!item) return Response.json({ error: 'Item não encontrado.' }, { status: 404 })

  const { data: elaboration } = await admin
    .from('perfil_operador_elaborations')
    .select('*')
    .eq('id', item.elaboration_id)
    .eq('user_id', user.id)
    .single()
  if (!elaboration) return Response.json({ error: 'Item não encontrado.' }, { status: 404 })

  const body        = await req.json().catch(() => ({}))
  const instruction = typeof body.instruction === 'string' ? body.instruction : undefined

  const { data: links } = await admin
    .from('perfil_operador_document_items')
    .select('document_id')
    .eq('item_id', itemId)

  const docIds = (links ?? []).map(l => l.document_id)
  let documents: { tipo: string; filename: string; content_text: string | null }[] = []
  if (docIds.length) {
    const { data } = await admin
      .from('perfil_operador_documents')
      .select('tipo, filename, content_text')
      .in('id', docIds)
    documents = data ?? []
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await generateItemAnswer(client, elaboration.cliente, item, documents as any, instruction)

    const { data: updated, error } = await admin
      .from('perfil_operador_items')
      .update({
        resposta:        result.resposta,
        pendencias:      result.pendencias,
        status:          'gerado',
        error_message:   null,
        manually_edited: false,
        generated_at:    new Date().toISOString(),
      })
      .eq('id', itemId)
      .select()
      .single()

    if (error) {
      // A resposta foi gerada (e cobrada) mas não foi possível salvá-la — nunca falhar
      // silenciosamente aqui, senão o usuário paga pela geração e perde o resultado.
      console.error('[perfil-operador regenerate] FALHA AO SALVAR:', error)
      return Response.json({
        error: `Resposta gerada, mas houve falha ao salvar no banco: ${error.message}. Verifique se todas as migrations de supabase/migration-perfil-operador*.sql foram executadas.`,
      }, { status: 500 })
    }
    return Response.json({ item: updated })
  } catch (err) {
    console.error('[perfil-operador regenerate]', err)
    const msg = err instanceof Error ? humanizeApiError(err.message) : 'Erro ao gerar resposta.'
    const { error: saveErr } = await admin.from('perfil_operador_items').update({ status: 'erro', error_message: msg }).eq('id', itemId)
    if (saveErr) console.error('[perfil-operador regenerate] falha ao salvar status de erro:', saveErr)
    return Response.json({ error: msg }, { status: 500 })
  }
}
