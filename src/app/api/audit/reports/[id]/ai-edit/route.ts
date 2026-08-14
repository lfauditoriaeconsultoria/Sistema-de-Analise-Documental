import { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase/admin'
import Anthropic from '@anthropic-ai/sdk'
import { AuditReportData } from '@/types/audit'

export const maxDuration = 60

function buildUserSupabase(token?: string) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: { getAll: () => [], setAll: () => {} },
      global: token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
    }
  )
}

const SYSTEM_PROMPT = `Você é um assistente especializado em edição de relatórios de auditoria OEA da LF Auditoria e Consultoria.

O usuário fornecerá o relatório atual em JSON e um pedido de edição em português.
Você deve analisar o pedido e retornar SOMENTE um objeto JSON com as mudanças a serem aplicadas, sem texto adicional.

FORMATO DE RESPOSTA (JSON puro, sem markdown):
{
  "changes": [
    { "field": "campo_simples", "new_value": "novo valor" },
    { "field": "array_field", "new_value": ["item1", "item2"] },
    { "field": "array_field", "index": 0, "new_value": "novo item 0" }
  ],
  "message": "Descrição clara e curta do que foi alterado"
}

CAMPOS DISPONÍVEIS:
- Texto simples: empresa, criterio, requisitos, periodo, metodologia, auditor, procedimento_referencia, emissao, indice_calculo_descricao, nota_atencao, item_maior_atencao
- Números: total_nao_conformidades, total_recomendacoes
- Arrays de parágrafos: resumo_executivo, conclusao
- Stats (objeto): stats.total, stats.conforme, stats.nao_conforme, stats.nao_aplicavel, stats.indice_conformidade

REGRAS:
- Preserve o tom profissional, técnico e consultivo do relatório original
- Ao reescrever parágrafos, mantenha o estilo e as informações existentes, salvo instrução contrária
- Ao mencionar números no texto corrido, inclua o extenso entre parênteses (ex: 21 (vinte e um))
- Para parágrafos específicos de arrays: use "index" (0-based) para modificar apenas aquele parágrafo
- Para substituir todo um array: forneça "new_value" como array completo (sem "index")
- Se o pedido for ambíguo, interprete da forma mais útil para o usuário
- NÃO altere campos que não foram solicitados`

type Params = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  const supabase = buildUserSupabase(token)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Não autorizado' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const isAdmin = profile?.role === 'admin'
  const admin = createAdminClient()

  // Verifica se o relatório existe e se o usuário tem acesso
  const { data: row } = isAdmin
    ? await admin.from('audit_reports').select('id').eq('id', id).single()
    : await supabase.from('audit_reports').select('id').eq('id', id).single()

  if (!row) return Response.json({ error: 'Relatório não encontrado.' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const { report, message } = body as { report?: AuditReportData; message?: string }

  if (!report || !message?.trim()) {
    return Response.json({ error: 'Forneça o relatório e a mensagem.' }, { status: 400 })
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

  const userContent = `RELATÓRIO ATUAL:
${JSON.stringify(report, null, 2)}

PEDIDO DO USUÁRIO:
${message.trim()}`

  const aiRes = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4000,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userContent }],
  })

  const rawText = aiRes.content
    .filter(b => b.type === 'text')
    .map(b => (b as { type: 'text'; text: string }).text)
    .join('')

  // Extrai JSON da resposta
  let parsed: { changes: unknown[]; message: string } | undefined
  try {
    const match = rawText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/) || rawText.match(/(\{[\s\S]*\})/)
    const jsonStr = match ? (match[1] ?? match[0]) : rawText.trim()
    parsed = JSON.parse(jsonStr)
  } catch {
    return Response.json({ error: 'A IA não retornou um JSON válido. Tente reformular o pedido.' }, { status: 500 })
  }

  return Response.json({ changes: parsed?.changes ?? [], message: parsed?.message ?? '' })
}
