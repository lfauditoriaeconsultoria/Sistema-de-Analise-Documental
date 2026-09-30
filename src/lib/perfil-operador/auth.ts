import { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase/admin'

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

/**
 * Igual a getAuthedUser, mas só devolve o usuário se ele for administrador.
 *
 * O módulo Perfil Operador está em desenvolvimento e liberado apenas para
 * administradores. Todas as rotas de API do módulo usam esta função — logo,
 * bloquear aqui basta para fechar o módulo inteiro no servidor, sem depender
 * de o frontend esconder os botões.
 *
 * Para liberar o módulo a todos os colaboradores no futuro, basta trocar as
 * chamadas de getAuthedAdmin por getAuthedUser nas rotas de /api/perfil-operador
 * (e ajustar as páginas em (dashboard)/perfil-operador).
 */
export async function getAuthedAdmin(req: NextRequest) {
  const user = await getAuthedUser(req)
  if (!user) return null

  const { data: profile } = await createAdminClient()
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  return profile?.role === 'admin' ? user : null
}
