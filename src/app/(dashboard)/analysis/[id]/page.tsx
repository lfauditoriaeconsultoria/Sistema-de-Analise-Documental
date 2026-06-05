import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { ReportViewer } from '@/components/analysis/report-viewer'
import { Analysis, Report } from '@/types'

export default async function AnalysisPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('analyses')
    .select(`
      *,
      theme:themes(*),
      subtopic:subtopics(*),
      report:reports(*),
      chat_messages(*)
    `)
    .eq('id', id)
    .single()

  if (error || !data) notFound()

  const analysis = data as Analysis & { report: Report[] | null }
  const report = Array.isArray(analysis.report) ? analysis.report[0] : analysis.report

  return <ReportViewer analysis={analysis} report={report ?? null} />
}
