import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthedAdmin } from '@/lib/perfil-operador/auth'

type Params = { params: Promise<{ docId: string }> }

/** PUT — substitui o conjunto de itens vinculados a este documento */
export async function PUT(req: NextRequest, { params }: Params) {
  const { docId } = await params
  const user = await getAuthedAdmin(req)
  if (!user) return Response.json({ error: 'Não autorizado' }, { status: 401 })

  const admin = createAdminClient()

  const { data: doc } = await admin.from('perfil_operador_documents').select('*').eq('id', docId).single()
  if (!doc) return Response.json({ error: 'Documento não encontrado.' }, { status: 404 })
  const { data: elaboration } = await admin
    .from('perfil_operador_elaborations')
    .select('id')
    .eq('id', doc.elaboration_id)
    .eq('user_id', user.id)
    .single()
  if (!elaboration) return Response.json({ error: 'Documento não encontrado.' }, { status: 404 })

  const body    = await req.json().catch(() => ({}))
  const itemIds = Array.isArray(body.item_ids) ? (body.item_ids as string[]) : []

  // Confere que todos os itens pertencem à mesma elaboração (evita vínculo cruzado indevido)
  if (itemIds.length) {
    const { data: validItems } = await admin
      .from('perfil_operador_items')
      .select('id')
      .eq('elaboration_id', doc.elaboration_id)
      .in('id', itemIds)
    const validIds = new Set((validItems ?? []).map(i => i.id))
    if (validIds.size !== itemIds.length) {
      return Response.json({ error: 'Um ou mais itens informados são inválidos.' }, { status: 400 })
    }
  }

  const { error: delErr } = await admin.from('perfil_operador_document_items').delete().eq('document_id', docId)
  if (delErr) return Response.json({ error: 'Erro ao atualizar vínculos.' }, { status: 500 })

  if (itemIds.length) {
    const rows = itemIds.map(item_id => ({ document_id: docId, item_id }))
    const { error: insErr } = await admin.from('perfil_operador_document_items').insert(rows)
    if (insErr) return Response.json({ error: 'Erro ao atualizar vínculos.' }, { status: 500 })
  }

  return Response.json({ ok: true, item_ids: itemIds })
}
