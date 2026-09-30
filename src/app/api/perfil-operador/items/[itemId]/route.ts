import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthedUser } from '@/lib/perfil-operador/auth'

type Params = { params: Promise<{ itemId: string }> }

/**
 * Confere posse do item — busca o item e depois confirma que a elaboração dona
 * pertence ao usuário (duas consultas simples, mais previsíveis que um filtro
 * aninhado do PostgREST sobre a relação embutida).
 */
async function loadOwnedItem(admin: ReturnType<typeof createAdminClient>, itemId: string, userId: string) {
  const { data: item } = await admin.from('perfil_operador_items').select('*').eq('id', itemId).single()
  if (!item) return null
  const { data: elaboration } = await admin
    .from('perfil_operador_elaborations')
    .select('id')
    .eq('id', item.elaboration_id)
    .eq('user_id', userId)
    .single()
  return elaboration ? item : null
}

/** PATCH — salva edição manual da resposta (marca manually_edited = true) */
export async function PATCH(req: NextRequest, { params }: Params) {
  const { itemId } = await params
  const user = await getAuthedUser(req)
  if (!user) return Response.json({ error: 'Não autorizado' }, { status: 401 })

  const admin = createAdminClient()
  const item = await loadOwnedItem(admin, itemId, user.id)
  if (!item) return Response.json({ error: 'Item não encontrado.' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  if (typeof body.resposta !== 'string') {
    return Response.json({ error: 'Informe o texto da resposta.' }, { status: 400 })
  }

  const { data: updated, error } = await admin
    .from('perfil_operador_items')
    .update({ resposta: body.resposta, manually_edited: true })
    .eq('id', itemId)
    .select()
    .single()

  if (error) return Response.json({ error: 'Erro ao salvar resposta.' }, { status: 500 })
  return Response.json({ item: updated })
}
