import { redirect } from 'next/navigation'

// /checklist redireciona direto para a geração (única funcionalidade da Etapa 1)
export default function ChecklistIndexPage() {
  redirect('/checklist/generate')
}
