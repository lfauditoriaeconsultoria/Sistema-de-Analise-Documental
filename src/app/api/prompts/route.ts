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

    const themeId = req.nextUrl.searchParams.get('themeId')
    const subtopicId = req.nextUrl.searchParams.get('subtopicId')
    const oeaItemId = req.nextUrl.searchParams.get('oeaItemId')
    const oeaCriteriaId = req.nextUrl.searchParams.get('oeaCriteriaId')
    const admin = createAdminClient()

    let query = admin
      .from('reference_prompts')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: true })

    if (themeId) {
      query = query.eq('theme_id', themeId)
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

    const { data: prompts, error } = await query
    if (error) return Response.json({ error: 'Erro ao buscar prompts' }, { status: 500 })

    return Response.json({ prompts: prompts ?? [] })
  } catch (err: unknown) {
    console.error('[prompts GET]', err)
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
    if (profile?.role !== 'admin') {
      return Response.json({ error: 'Acesso negado. Apenas administradores.' }, { status: 403 })
    }

    const body = await req.json()
    const { title, content, themeId, subtopicId, oeaCriteriaId, oeaItemId } = body

    if (!title?.trim() || !content?.trim()) {
      return Response.json({ error: 'Título e conteúdo são obrigatórios' }, { status: 400 })
    }

    const { data: prompt, error } = await supabase
      .from('reference_prompts')
      .insert({
        title: title.trim(),
        content: content.trim(),
        theme_id: themeId || null,
        subtopic_id: subtopicId || null,
        oea_criteria_id: oeaCriteriaId || null,
        oea_item_id: oeaItemId || null,
        created_by: user.id,
      })
      .select('*, theme:themes(name), subtopic:subtopics(name), oea_criteria:oea_criteria(number, name), oea_item:oea_items(item_number)')
      .single()

    if (error) return Response.json({ error: 'Erro ao criar prompt' }, { status: 500 })

    return Response.json({ prompt, success: true })
  } catch (err: unknown) {
    console.error('[prompts POST]', err)
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
    if (profile?.role !== 'admin') {
      return Response.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const id = req.nextUrl.searchParams.get('id')
    if (!id) return Response.json({ error: 'ID obrigatório' }, { status: 400 })

    const { error } = await supabase.from('reference_prompts').delete().eq('id', id)
    if (error) return Response.json({ error: 'Erro ao excluir prompt' }, { status: 500 })

    return Response.json({ success: true })
  } catch (err: unknown) {
    console.error('[prompts DELETE]', err)
    return Response.json({ error: 'Erro interno' }, { status: 500 })
  }
}
