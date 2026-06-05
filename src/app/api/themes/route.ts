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

async function requireAdmin(token?: string) {
  const supabase = buildSupabase(token)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return null
  return user
}

export async function GET() {
  const admin = createAdminClient()
  const { data, error } = await admin.from('themes').select('*').order('name')
  if (error) return Response.json({ error: 'Erro ao buscar temas' }, { status: 500 })
  return Response.json({ themes: data ?? [] })
}

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  const user = await requireAdmin(token)
  if (!user) return Response.json({ error: 'Acesso negado' }, { status: 403 })

  const { name, description, color } = await req.json()
  if (!name?.trim()) return Response.json({ error: 'Nome obrigatório' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('themes')
    .insert({ name: name.trim(), description: description?.trim() || null, color: color || '#1B3A8C', is_active: true })
    .select()
    .single()

  if (error) return Response.json({ error: 'Erro ao criar tema' }, { status: 500 })
  return Response.json({ theme: data })
}

export async function DELETE(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  const user = await requireAdmin(token)
  if (!user) return Response.json({ error: 'Acesso negado' }, { status: 403 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return Response.json({ error: 'ID obrigatório' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin.from('themes').update({ is_active: false }).eq('id', id)
  if (error) return Response.json({ error: 'Erro ao remover tema' }, { status: 500 })
  return Response.json({ success: true })
}
