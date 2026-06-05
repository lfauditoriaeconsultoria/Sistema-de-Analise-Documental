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

    const admin = createAdminClient()
    const { data: criteria, error } = await admin
      .from('oea_criteria')
      .select('*, items:oea_items(*)')
      .order('number', { ascending: true })

    if (error) return Response.json({ error: 'Erro ao buscar critérios OEA' }, { status: 500 })

    // Sort items by item_number within each criteria
    const sorted = (criteria ?? []).map(c => ({
      ...c,
      items: (c.items ?? []).sort((a: { item_number: string }, b: { item_number: string }) => {
        const [, aSub] = a.item_number.split('.').map(Number)
        const [, bSub] = b.item_number.split('.').map(Number)
        return aSub - bSub
      }),
    }))

    return Response.json({ criteria: sorted })
  } catch (err: unknown) {
    console.error('[oea-criteria GET]', err)
    return Response.json({ error: 'Erro interno' }, { status: 500 })
  }
}
