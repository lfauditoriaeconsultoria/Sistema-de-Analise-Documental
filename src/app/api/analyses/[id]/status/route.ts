import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
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

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  const supabase = buildSupabase(token)

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Não autorizado' }, { status: 401 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('analyses')
    .select('id, status, error_message')
    .eq('id', id)
    .single()

  if (error || !data) return Response.json({ error: 'Não encontrado' }, { status: 404 })

  return Response.json({ status: data.status, errorMessage: data.error_message })
}
