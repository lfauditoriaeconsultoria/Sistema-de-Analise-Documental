import { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

function buildSupabase(token?: string) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: { getAll: () => [], setAll: () => {} },
      global: token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
    }
  )
}

const IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20 MB

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  const supabase = buildSupabase(token)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Não autorizado' }, { status: 401 })

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return Response.json({ error: 'Requisição inválida' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  if (!file) return Response.json({ error: 'Nenhum arquivo enviado' }, { status: 400 })
  if (file.size > MAX_FILE_SIZE) return Response.json({ error: 'Arquivo muito grande (máx. 20 MB)' }, { status: 413 })

  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  const mimeType = file.type || `application/${ext}`

  // Images — return base64 for vision
  if (IMAGE_TYPES.includes(mimeType) || IMAGE_TYPES.some(t => t.endsWith(ext))) {
    const buffer = Buffer.from(await file.arrayBuffer())
    const mediaType = mimeType.startsWith('image/') ? mimeType : `image/${ext}`
    return Response.json({
      name: file.name,
      type: 'image',
      content: buffer.toString('base64'),
      mediaType,
      size: file.size,
    })
  }

  // Text / document — extract text
  try {
    let text = ''

    if (ext === 'txt' || ext === 'csv') {
      const buffer = Buffer.from(await file.arrayBuffer())
      text = buffer.toString('utf-8')
    } else if (ext === 'pdf') {
      const buffer = Buffer.from(await file.arrayBuffer())
      const pdfParse = (await import('pdf-parse')).default
      const data = await pdfParse(buffer)
      text = data.text
    } else if (ext === 'docx') {
      const buffer = Buffer.from(await file.arrayBuffer())
      const mammoth = await import('mammoth')
      const result = await mammoth.extractRawText({ buffer })
      text = result.value
    } else {
      return Response.json({ error: `Formato .${ext} não suportado para extração de texto` }, { status: 415 })
    }

    return Response.json({
      name: file.name,
      type: 'text',
      content: text.substring(0, 80000),
      size: file.size,
    })
  } catch (err) {
    console.error('[ai-chat/upload]', err)
    return Response.json({ error: 'Falha ao extrair conteúdo do arquivo' }, { status: 500 })
  }
}
