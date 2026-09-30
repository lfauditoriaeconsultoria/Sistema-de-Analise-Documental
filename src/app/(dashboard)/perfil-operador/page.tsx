import { PerfilOperadorHub } from '@/components/perfil-operador/perfil-operador-hub'
import { PerfilOperadorEmBreve } from '@/components/perfil-operador/perfil-operador-em-breve'
import { isCurrentUserAdmin } from '@/lib/perfil-operador/is-admin'

export default async function PerfilOperadorModulePage() {
  // Módulo em desenvolvimento — liberado apenas para administradores
  if (!(await isCurrentUserAdmin())) return <PerfilOperadorEmBreve />

  return <PerfilOperadorHub />
}
