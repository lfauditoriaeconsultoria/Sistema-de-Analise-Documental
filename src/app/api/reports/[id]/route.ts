import { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

const ALLOWED_FIELDS = [
  'summary',
  'criteria_used',
  'conforming_points',
  'partial_points',
  'non_conforming_points',
  'improvement_suggestions',
  'conclusion',
  'prompt_responses',
]

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const token = req.headers.get('authorization')?.replace('Bearer ', '')

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: { getAll: () => [], setAll: () => {} },
      global: token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Não autorizado' }, { status: 401 })

  // Verify report exists and the linked analysis belongs to the requesting user
  const { data: existingReport } = await supabase
    .from('reports')
    .select('id, analysis_id')
    .eq('id', id)
    .single()

  if (!existingReport) return Response.json({ error: 'Relatório não encontrado' }, { status: 404 })

  const { data: linkedAnalysis } = await supabase
    .from('analyses')
    .select('id')
    .eq('id', existingReport.analysis_id)
    .single()

  if (!linkedAnalysis) return Response.json({ error: 'Acesso negado' }, { status: 403 })

  const existing = existingReport

  const body = await req.json()
  const updates = Object.fromEntries(
    Object.entries(body).filter(([k]) => ALLOWED_FIELDS.includes(k))
  )

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: 'Nenhum campo válido para atualizar' }, { status: 400 })
  }

  const { data: updated, error } = await supabase
    .from('reports')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ report: updated })
}
