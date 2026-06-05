import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { AnalysisHistoryClient } from '@/components/analysis/analysis-history'

export default async function HistoryPage() {
  const supabase = await createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user!.id)
    .single()

  const isAdmin = profile?.role === 'admin'

  let analyses
  if (isAdmin) {
    const { data } = await admin
      .from('analyses')
      .select(`
        *,
        theme:themes(id, name, color),
        subtopic:subtopics(id, name),
        report:reports(overall_compliance, compliance_score),
        user:profiles(id, full_name)
      `)
      .order('created_at', { ascending: false })
    analyses = data
  } else {
    const { data } = await supabase
      .from('analyses')
      .select(`
        *,
        theme:themes(id, name, color),
        subtopic:subtopics(id, name),
        report:reports(overall_compliance, compliance_score)
      `)
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false })
    analyses = data
  }

  const { data: themes } = await admin.from('themes').select('id, name').eq('is_active', true)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <AnalysisHistoryClient analyses={(analyses ?? []) as any} themes={themes ?? []} isAdmin={isAdmin} />
}
