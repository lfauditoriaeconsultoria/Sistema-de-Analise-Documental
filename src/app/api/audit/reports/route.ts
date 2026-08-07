import { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { AuditReportData } from '@/types/audit'

function buildSupabase(token?: string) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: { getAll: () => [], setAll: () => {} },
      global: token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
    }
  )
}

/** Lista relatórios do usuário autenticado */
export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  const supabase = buildSupabase(token)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Não autorizado' }, { status: 401 })

  const { data, error } = await supabase
    .from('audit_reports')
    .select('id, empresa, criterio, emissao, created_at, updated_at')
    .order('created_at', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ reports: data ?? [] })
}

/** Salva novo relatório */
export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  const supabase = buildSupabase(token)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const report = body.report as AuditReportData | undefined

  if (!report?.empresa) {
    return Response.json({ error: 'Dados do relatório inválidos.' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('audit_reports')
    .insert({
      user_id:     user.id,
      empresa:     report.empresa,
      criterio:    report.criterio ?? '',
      emissao:     report.emissao  ?? '',
      report_data: report,
    })
    .select('id')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ id: data.id }, { status: 201 })
}
