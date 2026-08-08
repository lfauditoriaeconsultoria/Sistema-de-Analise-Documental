import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

type Params = { params: Promise<{ id: string }> }

/** Retorna URL assinada para download de um checklist do histórico */
export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params

  // Verifica autenticação via cookies
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Não autorizado.' }, { status: 401 })

  const admin = createAdminClient()

  // Verifica se o usuário é admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  const isAdmin = profile?.role === 'admin'

  // Busca o registro — admin usa admin client (bypassa RLS), colaborador usa supabase (RLS ativa)
  const { data: checklist, error: fetchError } = isAdmin
    ? await admin.from('checklist_history').select('*').eq('id', id).single()
    : await supabase.from('checklist_history').select('*').eq('id', id).single()

  if (fetchError || !checklist) {
    return Response.json({ error: 'Checklist não encontrado ou sem permissão.' }, { status: 404 })
  }

  // Gera URL assinada (válida por 60 segundos)
  const { data: signed, error: signError } = await admin.storage
    .from('checklists')
    .createSignedUrl(checklist.file_path, 60)

  if (signError || !signed?.signedUrl) {
    console.error('[checklist/download] falha ao gerar URL assinada:', signError?.message)
    return Response.json({ error: 'Não foi possível gerar o link de download.' }, { status: 500 })
  }

  return Response.json({
    url:      signed.signedUrl,
    filename: checklist.filename,
  })
}

/** Exclui um checklist do histórico e do storage */
export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Não autorizado.' }, { status: 401 })

  const admin = createAdminClient()

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const isAdmin = profile?.role === 'admin'

  // Busca o registro para obter o file_path
  const { data: checklist } = isAdmin
    ? await admin.from('checklist_history').select('file_path, user_id').eq('id', id).single()
    : await supabase.from('checklist_history').select('file_path, user_id').eq('id', id).single()

  if (!checklist) return Response.json({ error: 'Não encontrado.' }, { status: 404 })

  // Remove do storage
  await admin.storage.from('checklists').remove([checklist.file_path])

  // Remove da tabela
  const { error } = isAdmin
    ? await admin.from('checklist_history').delete().eq('id', id)
    : await supabase.from('checklist_history').delete().eq('id', id)

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return new Response(null, { status: 204 })
}
