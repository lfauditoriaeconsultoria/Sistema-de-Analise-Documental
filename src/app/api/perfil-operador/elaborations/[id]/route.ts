import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthedAdmin } from '@/lib/perfil-operador/auth'

type Params = { params: Promise<{ id: string }> }

/** Confere que a elaboração existe e pertence ao usuário — devolve a linha ou null */
async function loadOwnedElaboration(admin: ReturnType<typeof createAdminClient>, id: string, userId: string) {
  const { data } = await admin
    .from('perfil_operador_elaborations')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single()
  return data
}

/** GET — elaboração completa: itens, documentos e vínculos já montados */
export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params
  const user = await getAuthedAdmin(req)
  if (!user) return Response.json({ error: 'Não autorizado' }, { status: 401 })

  const admin = createAdminClient()
  const elaboration = await loadOwnedElaboration(admin, id, user.id)
  if (!elaboration) return Response.json({ error: 'Elaboração não encontrada.' }, { status: 404 })

  const [{ data: items, error: itemsErr }, { data: documents, error: docsErr }] = await Promise.all([
    admin.from('perfil_operador_items').select('*').eq('elaboration_id', id).order('criteria_number').order('item_number'),
    admin.from('perfil_operador_documents').select('*').eq('elaboration_id', id).order('created_at'),
  ])

  if (itemsErr || docsErr) {
    console.error('[perfil-operador/elaborations/[id] GET]', itemsErr ?? docsErr)
    return Response.json({ error: 'Erro ao buscar dados da elaboração.' }, { status: 500 })
  }

  const itemIds = (items ?? []).map(i => i.id)
  const docIds  = (documents ?? []).map(d => d.id)

  let links: { document_id: string; item_id: string }[] = []
  if (itemIds.length && docIds.length) {
    const { data } = await admin
      .from('perfil_operador_document_items')
      .select('document_id, item_id')
      .in('item_id', itemIds)
    links = data ?? []
  }

  const itemsWithDocs = (items ?? []).map(it => ({
    ...it,
    document_ids: links.filter(l => l.item_id === it.id).map(l => l.document_id),
  }))
  const documentsWithItems = (documents ?? []).map(doc => ({
    ...doc,
    item_ids: links.filter(l => l.document_id === doc.id).map(l => l.item_id),
  }))

  return Response.json({
    elaboration: { ...elaboration, items: itemsWithDocs, documents: documentsWithItems },
  })
}

/** PATCH — atualiza metadados da elaboração (cliente, status) */
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params
  const user = await getAuthedAdmin(req)
  if (!user) return Response.json({ error: 'Não autorizado' }, { status: 401 })

  const admin = createAdminClient()
  const elaboration = await loadOwnedElaboration(admin, id, user.id)
  if (!elaboration) return Response.json({ error: 'Elaboração não encontrada.' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const patch: Record<string, string> = {}
  if (typeof body.cliente === 'string') patch.cliente = body.cliente.trim()
  if (typeof body.status === 'string')  patch.status  = body.status

  if (!Object.keys(patch).length) return Response.json({ error: 'Nada para atualizar.' }, { status: 400 })

  const { error } = await admin.from('perfil_operador_elaborations').update(patch).eq('id', id)
  if (error) return Response.json({ error: 'Erro ao atualizar elaboração.' }, { status: 500 })

  return Response.json({ ok: true })
}

/** DELETE — remove a elaboração (cascade no banco) + limpa os arquivos no storage */
export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params
  const user = await getAuthedAdmin(req)
  if (!user) return Response.json({ error: 'Não autorizado' }, { status: 401 })

  const admin = createAdminClient()
  const elaboration = await loadOwnedElaboration(admin, id, user.id)
  if (!elaboration) return Response.json({ error: 'Elaboração não encontrada.' }, { status: 404 })

  // Limpa a pasta userId/elaborationId/ inteira no storage antes de apagar as linhas
  const prefix = `${user.id}/${id}`
  const { data: files } = await admin.storage.from('perfil-operador-uploads').list(prefix)
  if (files?.length) {
    await admin.storage.from('perfil-operador-uploads').remove(files.map(f => `${prefix}/${f.name}`))
  }

  const { error } = await admin.from('perfil_operador_elaborations').delete().eq('id', id)
  if (error) return Response.json({ error: 'Erro ao remover elaboração.' }, { status: 500 })

  return Response.json({ ok: true })
}
