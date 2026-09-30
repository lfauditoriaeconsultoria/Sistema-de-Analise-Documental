import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthedUser } from '@/lib/perfil-operador/auth'

type Params = { params: Promise<{ itemId: string }> }

/** PUT — substitui o conjunto de documentos vinculados a este item */
export async function PUT(req: NextRequest, { params }: Params) {
  const { itemId } = await params
  const user = await getAuthedUser(req)
  if (!user) return Response.json({ error: 'Não autorizado' }, { status: 401 })

  const admin = createAdminClient()

  const { data: item } = await admin.from('perfil_operador_items').select('*').eq('id', itemId).single()
  if (!item) return Response.json({ error: 'Item não encontrado.' }, { status: 404 })
  const { data: elaboration } = await admin
    .from('perfil_operador_elaborations')
    .select('id')
    .eq('id', item.elaboration_id)
    .eq('user_id', user.id)
    .single()
  if (!elaboration) return Response.json({ error: 'Item não encontrado.' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const documentIds = Array.isArray(body.document_ids) ? (body.document_ids as string[]) : []

  if (documentIds.length) {
    const { data: validDocs } = await admin
      .from('perfil_operador_documents')
      .select('id')
      .eq('elaboration_id', item.elaboration_id)
      .in('id', documentIds)
    const validIds = new Set((validDocs ?? []).map(d => d.id))
    if (validIds.size !== documentIds.length) {
      return Response.json({ error: 'Um ou mais documentos informados são inválidos.' }, { status: 400 })
    }
  }

  const { error: delErr } = await admin.from('perfil_operador_document_items').delete().eq('item_id', itemId)
  if (delErr) return Response.json({ error: 'Erro ao atualizar vínculos.' }, { status: 500 })

  if (documentIds.length) {
    const rows = documentIds.map(document_id => ({ document_id, item_id: itemId }))
    const { error: insErr } = await admin.from('perfil_operador_document_items').insert(rows)
    if (insErr) return Response.json({ error: 'Erro ao atualizar vínculos.' }, { status: 500 })
  }

  return Response.json({ ok: true, document_ids: documentIds })
}
