import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthedUser } from '@/lib/perfil-operador/auth'

type Params = { params: Promise<{ docId: string }> }

async function loadOwnedDocument(admin: ReturnType<typeof createAdminClient>, docId: string, userId: string) {
  const { data: doc } = await admin.from('perfil_operador_documents').select('*').eq('id', docId).single()
  if (!doc) return null
  const { data: elaboration } = await admin
    .from('perfil_operador_elaborations')
    .select('id')
    .eq('id', doc.elaboration_id)
    .eq('user_id', userId)
    .single()
  return elaboration ? doc : null
}

/** GET — devolve uma URL assinada para visualizar o documento original */
export async function GET(req: NextRequest, { params }: Params) {
  const { docId } = await params
  const user = await getAuthedUser(req)
  if (!user) return Response.json({ error: 'Não autorizado' }, { status: 401 })

  const admin = createAdminClient()
  const doc = await loadOwnedDocument(admin, docId, user.id)
  if (!doc) return Response.json({ error: 'Documento não encontrado.' }, { status: 404 })

  const { data: signed, error } = await admin.storage
    .from('perfil-operador-uploads')
    .createSignedUrl(doc.file_path, 300)

  if (error || !signed) return Response.json({ error: 'Erro ao gerar link de visualização.' }, { status: 500 })
  return Response.json({ signedUrl: signed.signedUrl, filename: doc.filename })
}

/** DELETE — remove o documento (storage + linha + vínculos em cascata) */
export async function DELETE(req: NextRequest, { params }: Params) {
  const { docId } = await params
  const user = await getAuthedUser(req)
  if (!user) return Response.json({ error: 'Não autorizado' }, { status: 401 })

  const admin = createAdminClient()
  const doc = await loadOwnedDocument(admin, docId, user.id)
  if (!doc) return Response.json({ error: 'Documento não encontrado.' }, { status: 404 })

  await admin.storage.from('perfil-operador-uploads').remove([doc.file_path])

  const { error } = await admin.from('perfil_operador_documents').delete().eq('id', docId)
  if (error) return Response.json({ error: 'Erro ao remover documento.' }, { status: 500 })

  return Response.json({ ok: true })
}
