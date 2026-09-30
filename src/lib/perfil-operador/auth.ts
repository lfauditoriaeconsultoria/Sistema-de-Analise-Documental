import { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

/**
 * Extrai o usuário autenticado de uma requisição de API a partir do header
 * "Authorization: Bearer <token>" — mesmo padrão usado em /api/oea-criteria
 * e /api/audit/reports/[id]/ai-edit. Retorna null se não autenticado.
 */
export async function getAuthedUser(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: { getAll: () => [], setAll: () => {} },
      global: token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  return user
}
