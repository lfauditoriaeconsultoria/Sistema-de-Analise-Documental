import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ChecklistGenerate } from '@/components/checklist/checklist-generate'

export const metadata = { title: 'Gerar Checklist — LF Auditoria' }

export default async function ChecklistGeneratePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user!.id)
    .single()

  if (profile?.role !== 'admin') {
    redirect('/audit')
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <ChecklistGenerate />
    </div>
  )
}
