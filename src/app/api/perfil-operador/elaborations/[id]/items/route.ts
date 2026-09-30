import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthedUser } from '@/lib/perfil-operador/auth'
import { SelectedOeaItem } from '@/types/perfil-operador'

type Params = { params: Promise<{ id: string }> }

/** POST — amplia a seleção de itens de uma elaboração já existente (ignora duplicados) */
export async function POST(req: NextRequest, { params }: Params) {
  const { id: elaborationId } = await params
  const user = await getAuthedUser(req)
  if (!user) return Response.json({ error: 'Não autorizado' }, { status: 401 })

  const admin = createAdminClient()
  const { data: elaboration } = await admin
    .from('perfil_operador_elaborations')
    .select('id')
    .eq('id', elaborationId)
    .eq('user_id', user.id)
    .single()
  if (!elaboration) return Response.json({ error: 'Elaboração não encontrada.' }, { status: 404 })

  const body  = await req.json().catch(() => ({}))
  const items = Array.isArray(body.items) ? (body.items as SelectedOeaItem[]) : []
  if (!items.length) return Response.json({ error: 'Nenhum item informado.' }, { status: 400 })

  const { data: existing } = await admin
    .from('perfil_operador_items')
    .select('criteria_number, item_number')
    .eq('elaboration_id', elaborationId)

  const existingKeys = new Set((existing ?? []).map(e => `${e.criteria_number}::${e.item_number}`))
  const newRows = items
    .filter(it => !existingKeys.has(`${it.criteria_number}::${it.item_number}`))
    .map(it => ({
      elaboration_id:   elaborationId,
      criteria_number:  it.criteria_number,
      criteria_name:    it.criteria_name,
      oea_item_id:      it.oea_item_id,
      item_number:      it.item_number,
      item_description: it.item_description,
    }))

  if (!newRows.length) return Response.json({ added: 0 })

  const { error } = await admin.from('perfil_operador_items').insert(newRows)
  if (error) {
    console.error('[perfil-operador items POST]', error)
    return Response.json({ error: 'Erro ao adicionar itens.' }, { status: 500 })
  }

  return Response.json({ added: newRows.length })
}
