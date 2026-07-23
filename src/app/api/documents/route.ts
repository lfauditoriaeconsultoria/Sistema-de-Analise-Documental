import { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase/admin'
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
    // oeaCriteriaIds is a comma-separated list for multi-select support
    const oeaCriteriaIdsRaw = req.nextUrl.searchParams.get('oeaCriteriaIds')
    const oeaCriteriaIds = oeaCriteriaIdsRaw ? oeaCriteriaIdsRaw.split(',').filter(Boolean) : []
    const admin = createAdminClient()

    let query = admin
      .from('reference_documents')
      .select('id, name, description, file_type, file_size, subtopic_id, oea_criteria_id, oea_item_id')
      .order('created_at', { ascending: true })

    if (themeId) {
      query = query.eq('theme_id', themeId)
    }
    if (subtopicId) {
      query = query.or(`subtopic_id.eq.${subtopicId},subtopic_id.is.null`)
    }
    if (oeaItemId) {
      query = query.or(`oea_item_id.eq.${oeaItemId},oea_item_id.is.null`)
    } else if (oeaCriteriaIds.length > 0) {
      // Multiple criteria: include docs for any of the selected criteria + docs with no criteria
      const criteriaFilter = oeaCriteriaIds.map(id => `oea_criteria_id.eq.${id}`).join(',')
      query = query.or(`${criteriaFilter},oea_criteria_id.is.null`)
    } else if (oeaCriteriaId) {
      query = query.or(`oea_criteria_id.eq.${oeaCriteriaId},oea_criteria_id.is.null`)
    }

    const { data: documents, error } = await query
    if (error) return Response.json({ error: 'Erro ao buscar documentos' }, { status: 500 })

    return Response.json({ documents: documents ?? [] })
  } catch (err: unknown) {
    console.error('[documents GET]', err)
    return Response.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    const supabase = buildSupabase(token)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'Não autorizado' }, { status: 401 })

    // Check admin role
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin') {
      return Response.json({ error: 'Acesso negado. Apenas administradores podem cadastrar documentos.' }, { status: 403 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const name = formData.get('name') as string
    const version = (formData.get('version') as string | null) || null
    const description = formData.get('description') as string | null
    const themeId = formData.get('themeId') as string
    const subtopicId = formData.get('subtopicId') as string | null
    const oeaCriteriaId = formData.get('oeaCriteriaId') as string | null
    const oeaItemId = formData.get('oeaItemId') as string | null

    if (!file || !name || !themeId) {
      return Response.json({ error: 'Arquivo, nome e tema são obrigatórios' }, { status: 400 })
    }

    // Extract text
    const content = await extractTextFromFile(file)

    // Upload file to Supabase Storage
    const filePath = `reference-documents/${themeId}/${Date.now()}-${file.name}`
    const { error: uploadError } = await supabase.storage
      .from('reference-documents')
      .upload(filePath, file)

    if (uploadError) {
      console.warn('[documents] Storage upload failed, storing content only:', uploadError.message)
    }

    // Save to database
    const { data: doc, error: dbError } = await supabase
      .from('reference_documents')
      .insert({
        theme_id: themeId,
        subtopic_id: subtopicId || null,
        oea_criteria_id: oeaCriteriaId || null,
        oea_item_id: oeaItemId || null,
        name,
        version: version || null,
        description: description || null,
        file_path: uploadError ? null : filePath,
        file_type: file.name.split('.').pop()?.toLowerCase(),
        file_size: file.size,
        content: content.substring(0, 500000),
        uploaded_by: user.id,
      })
      .select()
      .single()

    if (dbError) {
      return Response.json({ error: 'Erro ao salvar documento' }, { status: 500 })
    }

    return Response.json({ document: doc, success: true })
  } catch (err: unknown) {
    console.error('[documents POST]', err)
    return Response.json({ error: err instanceof Error ? err.message : 'Erro interno' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
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

    const body = await req.json() as {
      name?: string
      version?: string | null
      description?: string | null
      themeId?: string
      subtopicId?: string | null
      oeaCriteriaId?: string | null
      oeaItemId?: string | null
    }

    const updates: Record<string, unknown> = {}
    if (body.name !== undefined) updates.name = body.name
    if ('version' in body) updates.version = body.version ?? null
    if ('description' in body) updates.description = body.description ?? null
    if (body.themeId !== undefined) updates.theme_id = body.themeId
    if ('subtopicId' in body) updates.subtopic_id = body.subtopicId ?? null
    if ('oeaCriteriaId' in body) updates.oea_criteria_id = body.oeaCriteriaId ?? null
    if ('oeaItemId' in body) updates.oea_item_id = body.oeaItemId ?? null

    const { data: doc, error } = await supabase
      .from('reference_documents')
      .update(updates)
      .eq('id', id)
      .select('*, theme:themes(name), subtopic:subtopics(name)')
      .single()

    if (error) return Response.json({ error: 'Erro ao atualizar documento' }, { status: 500 })

    return Response.json({ document: doc })
  } catch (err: unknown) {
    console.error('[documents PATCH]', err)
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

    // Get file path to delete from storage
    const { data: doc } = await supabase.from('reference_documents').select('file_path').eq('id', id).single()

    if (doc?.file_path) {
      await supabase.storage.from('reference-documents').remove([doc.file_path])
    }

    const { error } = await supabase.from('reference_documents').delete().eq('id', id)
    if (error) return Response.json({ error: 'Erro ao excluir' }, { status: 500 })

    return Response.json({ success: true })
  } catch (err: unknown) {
    console.error('[documents DELETE]', err)
    return Response.json({ error: 'Erro interno' }, { status: 500 })
  }
}
