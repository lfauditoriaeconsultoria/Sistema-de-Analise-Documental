import { PerfilOperadorWorkspace } from '@/components/perfil-operador/perfil-operador-workspace'

type Props = { params: Promise<{ id: string }> }

export default async function PerfilOperadorWorkspacePage({ params }: Props) {
  const { id } = await params
  return <PerfilOperadorWorkspace id={id} />
}
