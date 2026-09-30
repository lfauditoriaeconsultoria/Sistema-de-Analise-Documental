import { PerfilOperadorWorkspace } from '@/components/perfil-operador/perfil-operador-workspace'
import { PerfilOperadorEmBreve } from '@/components/perfil-operador/perfil-operador-em-breve'
import { isCurrentUserAdmin } from '@/lib/perfil-operador/is-admin'

type Props = { params: Promise<{ id: string }> }

export default async function PerfilOperadorWorkspacePage({ params }: Props) {
  // Módulo em desenvolvimento — liberado apenas para administradores
  if (!(await isCurrentUserAdmin())) return <PerfilOperadorEmBreve />

  const { id } = await params
  return <PerfilOperadorWorkspace id={id} />
}
