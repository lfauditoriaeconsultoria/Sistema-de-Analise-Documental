import { ChecklistGenerate } from '@/components/checklist/checklist-generate'

export const metadata = { title: 'Gerar Checklist — LF Auditoria' }

export default function ChecklistGeneratePage() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <ChecklistGenerate />
    </div>
  )
}
