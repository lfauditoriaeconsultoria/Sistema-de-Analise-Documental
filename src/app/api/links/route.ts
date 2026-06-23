import { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchUrlContent } from '@/lib/fetch-url-content'

const LINK_SELECT = 'id, name, url, description, theme_id, subtopic_id, oea_criteria_id, oea_item_id, fetch_status, last_checked_at, fetch_error, created_at, updated_at, theme:themes(name), subtopic:subtopics(name), oea_criteria:oea_criteria(number, name), oea_item:oea_items(item_number)'

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

    const themeId = req.nextUrl.searchParams.get('themeId')
    const subtopicId = req.nextUrl.searchParams.get('subtopicId')
    const oeaItemId = req.nextUrl.searchParams.get('oeaItemId')
    const oeaCriteriaId = req.nextUrl.searchParams.get('oeaCriteriaId')

    const admin = createAdminClient()
    let query = admin
      .from('reference_links')
      .select(LINK_SELECT)
      .order('created_at', { ascending: false })

    if (themeId) {
      query = query.or(`theme_id.eq.${themeId},theme_id.is.null`)
    }
    if (subtopicId) {
      query = query.or(`subtopic_id.eq.${subtopicId},subtopic_id.is.null`)
    } else if (themeId) {
      query = query.is('subtopic_id', null)
    }
    if (oeaItemId) {
      query = query.or(`oea_item_id.eq.${oeaItemId},oea_item_id.is.null`)
    } else if (oeaCriteriaId) {
      query = query.or(`oea_criteria_id.eq.${oeaCriteriaId},oea_criteria_id.is.null`)
    }

    const { data: links, error } = await query
    if (error) return Response.json({ error: 'Erro ao buscar links' }, { status: 500 })
    return Response.json({ links: links ?? [] })
  } catch (err) {
    console.error('[links GET]', err)
    return Response.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    const supabase = buildSupabase(token)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'Não autorizado' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin') return Response.json({ error: 'Acesso negado' }, { status: 403 })

    const body = await req.json()
    const { name, url, description, themeId, subtopicId, oeaCriteriaId, oeaItemId } = body as {
      name: string; url: string; description?: string
      themeId?: string; subtopicId?: string; oeaCriteriaId?: string; oeaItemId?: string
    }

    if (!name?.trim() || !url?.trim()) {
      return Response.json({ error: 'Nome e URL são obrigatórios' }, { status: 400 })
    }

    try { new URL(url) } catch {
      return Response.json({ error: 'URL inválida' }, { status: 400 })
    }

    let content: string | null = null
    let fetchError: string | null = null
    try {
      content = await fetchUrlContent(url)
    } catch (err) {
      fetchError = err instanceof Error ? err.message : 'Erro desconhecido'
      console.warn('[links POST] fetch failed:', err)
    }

    const admin = createAdminClient()
    const { data: link, error } = await admin
      .from('reference_links')
      .insert({
        name: name.trim(),
        url: url.trim(),
        description: description?.trim() || null,
        content,
        uploaded_by: user.id,
        theme_id: themeId || null,
        subtopic_id: subtopicId || null,
        oea_criteria_id: oeaCriteriaId || null,
        oea_item_id: oeaItemId || null,
        fetch_status: content ? 'success' : 'failed',
        last_checked_at: new Date().toISOString(),
        fetch_error: fetchError,
      })
      .select(LINK_SELECT)
      .single()

    if (error) return Response.json({ error: 'Erro ao salvar link' }, { status: 500 })
    return Response.json({ link, contentFetched: !!content }, { status: 201 })
  } catch (err) {
    console.error('[links POST]', err)
    return Response.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// Re-check a single link (admin only)
export async function PATCH(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    const supabase = buildSupabase(token)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'Não autorizado' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin') return Response.json({ error: 'Acesso negado' }, { status: 403 })

    const id = req.nextUrl.searchParams.get('id')
    if (!id) return Response.json({ error: 'ID obrigatório' }, { status: 400 })

    const admin = createAdminClient()
    const { data: existing } = await admin.from('reference_links').select('url').eq('id', id).single()
    if (!existing) return Response.json({ error: 'Link não encontrado' }, { status: 404 })

    let content: string | null = null
    let fetchError: string | null = null
    try {
      content = await fetchUrlContent(existing.url)
    } catch (err) {
      fetchError = err instanceof Error ? err.message : 'Erro desconhecido'
    }

    const { data: link, error } = await admin
      .from('reference_links')
      .update({
        content: content ?? undefined,
        fetch_status: content ? 'success' : 'failed',
        last_checked_at: new Date().toISOString(),
        fetch_error: fetchError,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select(LINK_SELECT)
      .single()

    if (error) return Response.json({ error: 'Erro ao atualizar link' }, { status: 500 })
    return Response.json({ link, contentFetched: !!content })
  } catch (err) {
    console.error('[links PATCH]', err)
    return Response.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    const supabase = buildSupabase(token)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'Não autorizado' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin') return Response.json({ error: 'Acesso negado' }, { status: 403 })

    const id = req.nextUrl.searchParams.get('id')
    if (!id) return Response.json({ error: 'ID obrigatório' }, { status: 400 })

    const admin = createAdminClient()
    const { error } = await admin.from('reference_links').delete().eq('id', id)
    if (error) return Response.json({ error: 'Erro ao excluir link' }, { status: 500 })
    return Response.json({ success: true })
  } catch (err) {
    console.error('[links DELETE]', err)
    return Response.json({ error: 'Erro interno' }, { status: 500 })
  }
}
