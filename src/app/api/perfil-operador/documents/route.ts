import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthedUser } from '@/lib/perfil-operador/auth'
import { extractDocumentText } from '@/lib/perfil-operador/extract-text'

/**
 * POST — registra um documento já enviado ao Supabase Storage pelo cliente
 * (bucket "perfil-operador-uploads"). Baixa o arquivo, extrai o texto uma
 * única vez e grava tudo no banco, pronto para ser vinculado a itens.
 */
export async function POST(req: NextRequest) {
  const user = await getAuthedUser(req)
  if (!user) return Response.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const elaborationId = String(body.elaboration_id ?? '')
  const tipo           = body.tipo === 'evidencia' ? 'evidencia' : body.tipo === 'politica' ? 'politica' : null
  const filePath        = String(body.file_path ?? '')
  const filename        = String(body.filename ?? '')
  const fileSize         = Number.isFinite(body.file_size) ? Number(body.file_size) : null

  if (!elaborationId || !tipo || !filePath || !filename) {
    return Response.json({ error: 'Dados incompletos para registrar o documento.' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: elaboration } = await admin
    .from('perfil_operador_elaborations')
    .select('id')
    .eq('id', elaborationId)
    .eq('user_id', user.id)
    .single()
  if (!elaboration) return Response.json({ error: 'Elaboração não encontrada.' }, { status: 404 })

  // Path precisa começar com userId/elaborationId/ (política RLS + convenção de limpeza)
  if (!filePath.startsWith(`${user.id}/${elaborationId}/`)) {
    return Response.json({ error: 'Caminho de arquivo inválido.' }, { status: 400 })
  }

  const { data: blob, error: dlErr } = await admin.storage.from('perfil-operador-uploads').download(filePath)
  if (dlErr || !blob) {
    console.error('[perfil-operador/documents POST] download', dlErr)
    return Response.json({ error: 'Não foi possível ler o arquivo enviado.' }, { status: 500 })
  }

  const buffer      = Buffer.from(await blob.arrayBuffer())
  const contentText = await extractDocumentText(buffer, filename)

  const { data: doc, error } = await admin
    .from('perfil_operador_documents')
    .insert({
      elaboration_id: elaborationId,
      tipo,
      filename,
      file_path: filePath,
      file_size: fileSize,
      content_text: contentText,
    })
    .select()
    .single()

  if (error) {
    console.error('[perfil-operador/documents POST] insert', error)
    return Response.json({ error: 'Erro ao registrar documento.' }, { status: 500 })
  }

  return Response.json({
    document: doc,
    extracted: !!contentText,
    warning: contentText ? undefined : 'Não foi possível extrair texto deste arquivo — ele ficará disponível apenas para visualização.',
  })
}
