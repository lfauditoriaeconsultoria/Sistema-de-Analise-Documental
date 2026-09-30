import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthedUser } from '@/lib/perfil-operador/auth'
import { SelectedOeaItem } from '@/types/perfil-operador'

/** GET — lista as elaborações do usuário autenticado (página hub) */
export async function GET(req: NextRequest) {
  const user = await getAuthedUser(req)
  if (!user) return Response.json({ error: 'Não autorizado' }, { status: 401 })

  const admin = createAdminClient()

  const { data: elaborations, error } = await admin
    .from('perfil_operador_elaborations')
    .select('*, items:perfil_operador_items(id, criteria_number, criteria_name, status)')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })

  if (error) {
    console.error('[perfil-operador/elaborations GET]', error)
    return Response.json({ error: 'Erro ao buscar elaborações.' }, { status: 500 })
  }

  return Response.json({ elaborations: elaborations ?? [] })
}

/** POST — cria uma nova elaboração já com os itens selecionados no passo 1 */
export async function POST(req: NextRequest) {
  const user = await getAuthedUser(req)
  if (!user) return Response.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const cliente = String(body.cliente ?? '').trim()
  const items   = Array.isArray(body.items) ? (body.items as SelectedOeaItem[]) : []

  if (!cliente)     return Response.json({ error: 'Informe o nome do cliente.' }, { status: 400 })
  if (!items.length) return Response.json({ error: 'Selecione ao menos um item.' }, { status: 400 })

  const admin = createAdminClient()

  const { data: elaboration, error: elabErr } = await admin
    .from('perfil_operador_elaborations')
    .insert({ user_id: user.id, cliente, status: 'documentos' })
    .select()
    .single()

  if (elabErr || !elaboration) {
    console.error('[perfil-operador/elaborations POST] elaboration', elabErr)
    return Response.json({ error: 'Erro ao criar elaboração.' }, { status: 500 })
  }

  const rows = items.map(it => ({
    elaboration_id:   elaboration.id,
    criteria_number:  it.criteria_number,
    criteria_name:    it.criteria_name,
    oea_item_id:      it.oea_item_id,
    item_number:      it.item_number,
    item_description: it.item_description,
  }))

  const { error: itemsErr } = await admin.from('perfil_operador_items').insert(rows)

  if (itemsErr) {
    console.error('[perfil-operador/elaborations POST] items', itemsErr)
    // Remove a elaboração órfã para não deixar lixo sem itens
    await admin.from('perfil_operador_elaborations').delete().eq('id', elaboration.id)
    return Response.json({ error: 'Erro ao salvar os itens selecionados.' }, { status: 500 })
  }

  return Response.json({ id: elaboration.id })
}
