import { createClient } from '@/lib/supabase/server'

/**
 * Verifica, em server component, se o usuário logado é administrador.
 * Usado pelas páginas do módulo Perfil Operador, que está liberado apenas
 * para administradores enquanto está em desenvolvimento.
 *
 * O layout de (dashboard) já garante que há usuário autenticado; aqui só
 * interessa o papel.
 */
export async function isCurrentUserAdmin(): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  return profile?.role === 'admin'
}
