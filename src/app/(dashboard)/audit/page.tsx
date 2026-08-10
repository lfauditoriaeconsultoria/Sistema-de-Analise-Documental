import { createClient } from '@/lib/supabase/server'
import { AuditPage } from '@/components/audit/audit-page'

export default async function AuditModulePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user!.id)
    .single()

  const isAdmin = profile?.role === 'admin'

  return <AuditPage isAdmin={isAdmin} />
}
