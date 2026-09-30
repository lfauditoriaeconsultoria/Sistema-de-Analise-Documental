import { PerfilOperadorNew } from '@/components/perfil-operador/perfil-operador-new'
import { PerfilOperadorEmBreve } from '@/components/perfil-operador/perfil-operador-em-breve'
import { isCurrentUserAdmin } from '@/lib/perfil-operador/is-admin'

export default async function PerfilOperadorNewPage() {
  // Módulo em desenvolvimento — liberado apenas para administradores
  if (!(await isCurrentUserAdmin())) return <PerfilOperadorEmBreve />

  return <PerfilOperadorNew />
}
