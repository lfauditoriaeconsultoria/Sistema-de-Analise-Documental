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

async function requireAdmin(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  const supabase = buildSupabase(token)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autorizado', status: 401, user: null }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return { error: 'Acesso negado', status: 403, user: null }
  return { error: null, status: 200, user }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { error, status, user } = await requireAdmin(req)
    if (error || !user) return Response.json({ error }, { status })

    const body = await req.json()
    const { full_name, email, password, role } = body
    const admin = createAdminClient()

    const authUpdate: { email?: string; password?: string } = {}
    if (email?.trim()) authUpdate.email = email.trim()
    if (password?.trim()) authUpdate.password = password.trim()

    if (Object.keys(authUpdate).length > 0) {
      const { error: authErr } = await admin.auth.admin.updateUserById(id, authUpdate)
      if (authErr) return Response.json({ error: 'Erro ao atualizar credenciais: ' + authErr.message }, { status: 500 })
    }

    const profileUpdate: Record<string, string> = {}
    if (full_name !== undefined) profileUpdate.full_name = full_name
    if (role) profileUpdate.role = role

    if (Object.keys(profileUpdate).length > 0) {
      const { error: profileErr } = await admin.from('profiles').update(profileUpdate).eq('id', id)
      if (profileErr) return Response.json({ error: 'Erro ao atualizar perfil' }, { status: 500 })
    }

    return Response.json({ success: true })
  } catch (err) {
    console.error('[admin users PATCH]', err)
    return Response.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { error, status, user } = await requireAdmin(req)
    if (error || !user) return Response.json({ error }, { status })

    if (user.id === id) {
      return Response.json({ error: 'Não é possível excluir sua própria conta' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { error: deleteErr } = await admin.auth.admin.deleteUser(id)
    if (deleteErr) return Response.json({ error: 'Erro ao excluir: ' + deleteErr.message }, { status: 500 })

    await admin.from('profiles').delete().eq('id', id)
    return Response.json({ success: true })
  } catch (err) {
    console.error('[admin users DELETE]', err)
    return Response.json({ error: 'Erro interno' }, { status: 500 })
  }
}
