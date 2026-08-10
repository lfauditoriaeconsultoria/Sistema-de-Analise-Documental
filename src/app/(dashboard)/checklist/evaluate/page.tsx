import { ChecklistEvaluate } from '@/components/checklist/checklist-evaluate'

export const metadata = { title: 'Avaliação de Evidências — LF Auditoria' }

export default function ChecklistEvaluatePage() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <ChecklistEvaluate />
    </div>
  )
}
