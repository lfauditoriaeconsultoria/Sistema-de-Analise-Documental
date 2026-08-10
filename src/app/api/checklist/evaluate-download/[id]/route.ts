import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

type Params = { params: Promise<{ id: string }> }

/* ── GET: gera URL assinada (60 s) para download ── */
export async function GET(_req: Request, { params }: Params) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Não autenticado.' }, { status: 401 })

  const admin = createAdminClient()

  // Confirma que o registro existe e pertence ao usuário (ou é admin)
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const isAdmin = profile?.role === 'admin'

  const { data: record } = await admin
    .from('evaluate_history')
    .select('file_path, filename, user_id')
    .eq('id', id)
    .single()

  if (!record) return Response.json({ error: 'Avaliação não encontrada.' }, { status: 404 })
  if (!isAdmin && record.user_id !== user.id) return Response.json({ error: 'Acesso negado.' }, { status: 403 })

  const { data: signed, error } = await admin.storage
    .from('evaluations')
    .createSignedUrl(record.file_path, 60)

  if (error || !signed?.signedUrl) {
    return Response.json({ error: 'Não foi possível gerar o link de download.' }, { status: 500 })
  }

  return Response.json({ url: signed.signedUrl, filename: record.filename })
}

/* ── DELETE: remove o arquivo do storage e o registro do banco ── */
export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Não autenticado.' }, { status: 401 })

  const admin = createAdminClient()

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const isAdmin = profile?.role === 'admin'

  const { data: record } = await admin
    .from('evaluate_history')
    .select('file_path, user_id')
    .eq('id', id)
    .single()

  if (!record) return Response.json({ error: 'Avaliação não encontrada.' }, { status: 404 })
  if (!isAdmin && record.user_id !== user.id) return Response.json({ error: 'Acesso negado.' }, { status: 403 })

  await admin.storage.from('evaluations').remove([record.file_path])
  await admin.from('evaluate_history').delete().eq('id', id)

  return new Response(null, { status: 204 })
}
