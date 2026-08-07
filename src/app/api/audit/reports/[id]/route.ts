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

type Params = { params: Promise<{ id: string }> }

/** Busca um relatório pelo ID */
export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  const supabase = buildSupabase(token)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Não autorizado' }, { status: 401 })

  const { data, error } = await supabase
    .from('audit_reports')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !data) return Response.json({ error: 'Relatório não encontrado.' }, { status: 404 })
  return Response.json({ report: data })
}

/** Atualiza um relatório existente */
export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  const supabase = buildSupabase(token)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const report = body.report as AuditReportData | undefined
  if (!report) return Response.json({ error: 'Dados inválidos.' }, { status: 400 })

  const { error } = await supabase
    .from('audit_reports')
    .update({
      empresa:     report.empresa,
      criterio:    report.criterio ?? '',
      emissao:     report.emissao  ?? '',
      report_data: report,
    })
    .eq('id', id)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}

/** Remove um relatório */
export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  const supabase = buildSupabase(token)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Não autorizado' }, { status: 401 })

  const { error } = await supabase
    .from('audit_reports')
    .delete()
    .eq('id', id)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
