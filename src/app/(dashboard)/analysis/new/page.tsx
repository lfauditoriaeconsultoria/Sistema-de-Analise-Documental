import { createAdminClient } from '@/lib/supabase/admin'
import { NewAnalysisWizard } from '@/components/analysis/analysis-wizard'

const THEME_ORDER: Record<string, number> = { OEA: 0, LGPD: 1, Outros: 2 }

export default async function NewAnalysisPage() {
  const admin = createAdminClient()

  const [{ data: rawThemes }, { data: subtopics }] = await Promise.all([
    admin.from('themes').select('*').eq('is_active', true),
    admin.from('subtopics').select('*').eq('is_active', true).order('name'),
  ])

  const themes = [...(rawThemes ?? [])].sort(
    (a, b) => (THEME_ORDER[a.name] ?? 99) - (THEME_ORDER[b.name] ?? 99)
  )

  return <NewAnalysisWizard themes={themes} subtopics={subtopics ?? []} />
}
