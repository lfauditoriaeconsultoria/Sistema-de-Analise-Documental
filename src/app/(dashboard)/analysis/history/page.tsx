import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { UnifiedHistoryClient } from '@/components/unified-history-client'

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

  // ── Análises de documentos ──
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
      .not('status', 'in', '(failed,processing)')
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
      .not('status', 'in', '(failed,processing)')
      .order('created_at', { ascending: false })
    analyses = data
  }

  const { data: themes } = await admin.from('themes').select('id, name').eq('is_active', true)

  // ── Relatórios de auditoria OEA ──
  // Admin vê todos com nome do colaborador; colaborador vê só os seus
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let auditReports: any[]
  if (isAdmin) {
    const { data } = await admin
      .from('audit_reports')
      .select('id, empresa, criterio, emissao, created_at, updated_at, user_id, profiles!user_id(full_name)')
      .order('created_at', { ascending: false })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    auditReports = ((data ?? []) as any[]).map((r: any) => ({
      id:             r.id as string,
      empresa:        r.empresa as string,
      criterio:       r.criterio as string,
      emissao:        r.emissao as string,
      created_at:     r.created_at as string,
      updated_at:     r.updated_at as string,
      user_id:        r.user_id as string,
      // Supabase retorna o join como array; pega o primeiro elemento
      user_full_name: (Array.isArray(r.profiles) ? r.profiles[0]?.full_name : r.profiles?.full_name) ?? null,
    }))
  } else {
    const { data } = await supabase
      .from('audit_reports')
      .select('id, empresa, criterio, emissao, created_at, updated_at, user_id')
      .order('created_at', { ascending: false })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    auditReports = ((data ?? []) as any[]).map((r: any) => ({ ...r, user_full_name: null }))
  }

  // ── Checklists gerados ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let checklists: any[]
  if (isAdmin) {
    const { data } = await admin
      .from('checklist_history')
      .select('id, cliente, criterio, filename, items_count, created_at, user_id, profiles!user_id(full_name)')
      .order('created_at', { ascending: false })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    checklists = ((data ?? []) as any[]).map((c: any) => ({
      id:             c.id as string,
      cliente:        c.cliente as string,
      criterio:       c.criterio as string,
      filename:       c.filename as string,
      items_count:    c.items_count as number,
      created_at:     c.created_at as string,
      user_id:        c.user_id as string,
      user_full_name: (Array.isArray(c.profiles) ? c.profiles[0]?.full_name : c.profiles?.full_name) ?? null,
    }))
  } else {
    const { data } = await supabase
      .from('checklist_history')
      .select('id, cliente, criterio, filename, items_count, created_at, user_id')
      .order('created_at', { ascending: false })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    checklists = ((data ?? []) as any[]).map((c: any) => ({ ...c, user_full_name: null }))
  }

  // ── Avaliações de evidências (Etapa 2) ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let evaluations: any[]
  if (isAdmin) {
    const { data } = await admin
      .from('evaluate_history')
      .select('id, criterio, cliente, filename, items_count, nc_count, created_at, user_id, profiles!user_id(full_name)')
      .order('created_at', { ascending: false })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    evaluations = ((data ?? []) as any[]).map((e: any) => ({
      id:             e.id as string,
      criterio:       e.criterio as string,
      cliente:        e.cliente as string,
      filename:       e.filename as string,
      items_count:    e.items_count as number,
      nc_count:       e.nc_count as number,
      created_at:     e.created_at as string,
      user_id:        e.user_id as string,
      user_full_name: (Array.isArray(e.profiles) ? e.profiles[0]?.full_name : e.profiles?.full_name) ?? null,
    }))
  } else {
    const { data } = await supabase
      .from('evaluate_history')
      .select('id, criterio, cliente, filename, items_count, nc_count, created_at, user_id')
      .order('created_at', { ascending: false })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    evaluations = ((data ?? []) as any[]).map((e: any) => ({ ...e, user_full_name: null }))
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (
    <UnifiedHistoryClient
      analyses={(analyses ?? []) as any}
      themes={themes ?? []}
      isAdmin={isAdmin}
      auditReports={auditReports}
      checklists={checklists}
      evaluations={evaluations}
    />
  )
}
