import { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase/admin'

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

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    const supabase = buildSupabase(token)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'Não autorizado' }, { status: 401 })

    const id = req.nextUrl.searchParams.get('id')
    if (!id) return Response.json({ error: 'ID obrigatório' }, { status: 400 })

    const admin = createAdminClient()
    const { data: doc, error } = await admin
      .from('reference_documents')
      .select('file_path, name, file_type, content')
      .eq('id', id)
      .single()

    if (error || !doc) return Response.json({ error: 'Documento não encontrado' }, { status: 404 })

    // Prefer original file from Storage
    if (doc.file_path) {
      const { data: signed, error: signError } = await admin.storage
        .from('reference-documents')
        .createSignedUrl(doc.file_path, 60, {
          download: `${doc.name}.${doc.file_type ?? 'pdf'}`,
        })

      if (!signError && signed?.signedUrl) {
        return Response.redirect(signed.signedUrl)
      }
    }

    // Fallback: serve extracted text content as a downloadable .txt
    if (doc.content) {
      const fileName = encodeURIComponent(`${doc.name}.txt`)
      return new Response(doc.content, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Content-Disposition': `attachment; filename*=UTF-8''${fileName}`,
        },
      })
    }

    return Response.json({ error: 'Arquivo não disponível para download' }, { status: 404 })
  } catch (err: unknown) {
    console.error('[documents/download]', err)
    return Response.json({ error: 'Erro interno' }, { status: 500 })
  }
}
