import { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { extractTextFromFile } from '@/lib/document-parser'

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

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    const supabase = buildSupabase(token)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'Não autorizado' }, { status: 401 })

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return Response.json({ error: 'Arquivo obrigatório' }, { status: 400 })

    const maxSize = 10 * 1024 * 1024
    if (file.size > maxSize) {
      return Response.json({ error: 'Arquivo muito grande (máx. 10MB)' }, { status: 400 })
    }

    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    const imageExts = ['jpg', 'jpeg', 'png', 'webp']
    if (imageExts.includes(ext)) {
      return Response.json({ error: 'Imagens não são suportadas como documentos de referência' }, { status: 400 })
    }

    const content = await extractTextFromFile(file)
    if (!content.trim()) {
      return Response.json({ error: 'Não foi possível extrair texto do arquivo' }, { status: 400 })
    }

    return Response.json({
      name: file.name.replace(/\.[^.]+$/, ''),
      file_type: ext,
      content: content.substring(0, 500000),
    })
  } catch (err: unknown) {
    console.error('[documents/extract]', err)
    return Response.json({ error: err instanceof Error ? err.message : 'Erro interno' }, { status: 500 })
  }
}
