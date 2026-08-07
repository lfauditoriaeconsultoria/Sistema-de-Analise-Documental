import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AuditReportPage } from '@/components/audit/audit-report-page'
import { AuditReportData } from '@/types/audit'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ id: string }> }

export default async function AuditReportRoute({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: row, error } = await supabase
    .from('audit_reports')
    .select('report_data')
    .eq('id', id)
    .eq('user_id', user!.id)
    .single()

  if (error || !row) notFound()

  const report = row.report_data as AuditReportData

  return <AuditReportPage reportId={id} initialReport={report} />
}
