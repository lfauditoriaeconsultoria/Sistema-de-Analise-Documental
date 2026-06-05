import { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  Document, Packer, Paragraph, TextRun, AlignmentType, BorderStyle,
} from 'docx'

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

function header(text: string, color = '1B3A8C') {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 24, color })],
    spacing: { before: 360, after: 200 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color, space: 4 } },
  })
}

function body(text: string, indent = 0) {
  return new Paragraph({
    children: [new TextRun({ text, size: 20, color: '475569' })],
    spacing: { before: 60, after: 100 },
    indent: indent ? { left: indent } : undefined,
  })
}

function label(text: string) {
  return new TextRun({ text, bold: true, size: 18, color: '94A3B8', allCaps: true })
}

function value(text: string) {
  return new TextRun({ text, size: 20, bold: true, color: '1a2a5e', break: 1 })
}

function infoRow(pairs: Array<[string, string]>) {
  const runs: TextRun[] = []
  pairs.forEach(([l, v], i) => {
    runs.push(new TextRun({ text: l.toUpperCase(), bold: true, size: 16, color: '94A3B8' }))
    runs.push(new TextRun({ text: v, size: 20, bold: true, color: '1a2a5e', break: 1 }))
    if (i < pairs.length - 1) runs.push(new TextRun({ text: '     ', size: 20 }))
  })
  return new Paragraph({ children: runs, spacing: { before: 80, after: 80 } })
}

function pointBlock(
  points: Array<{ item: string; description: string; reference?: string }>,
  bullet: string,
) {
  return points.flatMap(p => [
    new Paragraph({
      children: [
        new TextRun({ text: `${bullet}  `, bold: true, size: 20 }),
        new TextRun({ text: p.item, bold: true, size: 20, color: '1a2a5e' }),
      ],
      spacing: { before: 200, after: 60 },
      indent: { left: 360 },
    }),
    new Paragraph({
      children: [new TextRun({ text: p.description, size: 18, color: '64748B' })],
      spacing: { before: 0, after: p.reference ? 60 : 140 },
      indent: { left: 720 },
    }),
    ...(p.reference
      ? [new Paragraph({
          children: [new TextRun({ text: `Ref: ${p.reference}`, size: 16, color: '1B3A8C', italics: true })],
          spacing: { before: 0, after: 140 },
          indent: { left: 720 },
        })]
      : []),
  ])
}

const PRIORITY_LABEL: Record<string, string> = { alta: 'Alta', media: 'Média', baixa: 'Baixa' }

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  const supabase = buildSupabase(token)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Não autorizado', { status: 401 })

  const admin = createAdminClient()

  // id here is the REPORT id — fetch report first, then the linked analysis
  const { data: reportData, error: reportError } = await admin
    .from('reports')
    .select('*')
    .eq('id', id)
    .single()

  if (reportError || !reportData) return new Response('Relatório não encontrado', { status: 404 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const report = reportData as any

  const { data: analysisData, error: analysisError } = await admin
    .from('analyses')
    .select('*, theme:themes(name, color), subtopic:subtopics(name)')
    .eq('id', report.analysis_id)
    .single()

  if (analysisError || !analysisData) return new Response('Análise não encontrada', { status: 404 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const analysis = analysisData as any
  const theme = analysis.theme as { name: string } | undefined
  const subtopic = analysis.subtopic as { name: string } | null | undefined
  const today = new Date().toLocaleDateString('pt-BR')

  const complianceLabel: Record<string, string> = {
    conforme: 'Conforme',
    parcialmente_conforme: 'Parcialmente Conforme',
    nao_conforme: 'Não Conforme',
  }

  const children: Paragraph[] = [
    // ── Cabeçalho ──
    new Paragraph({
      children: [new TextRun({ text: 'LF Auditoria e Consultoria', bold: true, size: 20, color: '1B3A8C', allCaps: true })],
      alignment: AlignmentType.LEFT,
      spacing: { after: 60 },
    }),
    new Paragraph({
      children: [new TextRun({ text: 'Relatório de Conformidade', bold: true, size: 36, color: '1a2a5e' })],
      spacing: { after: 40 },
    }),
    new Paragraph({
      children: [new TextRun({ text: today, size: 18, color: '94A3B8' })],
      spacing: { after: 400 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: '1B3A8C', space: 8 } },
    }),

    // ── Informações ──
    new Paragraph({
      children: [new TextRun({ text: 'Informações do Documento', bold: true, size: 22, color: '1B3A8C' })],
      spacing: { before: 200, after: 160 },
    }),
    infoRow([['Documento', analysis.document_name ?? '—'], ['Tema', `${theme?.name ?? '—'}${subtopic?.name ? ` › ${subtopic.name}` : ''}`]]),
    infoRow([['Data da análise', new Date(report.created_at).toLocaleDateString('pt-BR')], ['Resultado geral', complianceLabel[report.overall_compliance ?? ''] ?? '—']]),
    ...(analysis.client_name
      ? [infoRow([['Cliente', analysis.client_name], ['Pontuação', `${report.compliance_score ?? 0}%`]])]
      : [infoRow([['Pontuação de conformidade', `${report.compliance_score ?? 0}%`]])]),

    // ── Resumo ──
    header('Resumo Executivo'),
    body(report.summary ?? ''),

    // ── Critérios ──
    ...(report.criteria_used
      ? [header('Critérios Utilizados'), body(report.criteria_used)]
      : []),

    // ── Prompt responses ──
    ...((report.prompt_responses ?? []).length > 0
      ? [
          header('Respostas às Instruções do Gestor', '4338CA'),
          ...(report.prompt_responses as Array<{ prompt: string; response: string }>).flatMap(r => [
            new Paragraph({
              children: [new TextRun({ text: r.prompt, bold: true, size: 20, color: '1a2a5e' })],
              spacing: { before: 200, after: 80 },
            }),
            body(r.response),
          ]),
        ]
      : []),

    // ── Pontos conformes ──
    ...((report.conforming_points ?? []).length > 0
      ? [header('Pontos em Conformidade', '16A34A'), ...pointBlock(report.conforming_points, '✓')]
      : []),

    // ── Parcialmente conformes ──
    ...((report.partial_points ?? []).length > 0
      ? [header('Parcialmente Conformes', 'D97706'), ...pointBlock(report.partial_points, '◐')]
      : []),

    // ── Não conformes ──
    ...((report.non_conforming_points ?? []).length > 0
      ? [header('Não Conformes', 'DC2626'), ...pointBlock(report.non_conforming_points, '✗')]
      : []),

    // ── Sugestões ──
    ...((report.improvement_suggestions ?? []).length > 0
      ? [
          header('Sugestões de Melhoria'),
          ...(report.improvement_suggestions as Array<{ priority: string; item: string; suggestion: string; reference?: string }>).flatMap(s => [
            new Paragraph({
              children: [
                new TextRun({ text: `[${PRIORITY_LABEL[s.priority] ?? s.priority}]  `, bold: true, size: 18, color: '1B3A8C' }),
                new TextRun({ text: s.item, bold: true, size: 20, color: '1a2a5e' }),
              ],
              spacing: { before: 200, after: 60 },
              indent: { left: 360 },
            }),
            new Paragraph({
              children: [new TextRun({ text: s.suggestion, size: 18, color: '64748B' })],
              spacing: { before: 0, after: s.reference ? 60 : 140 },
              indent: { left: 720 },
            }),
            ...(s.reference
              ? [new Paragraph({
                  children: [new TextRun({ text: `Ref: ${s.reference}`, size: 16, color: '1B3A8C', italics: true })],
                  spacing: { before: 0, after: 140 },
                  indent: { left: 720 },
                })]
              : []),
          ]),
        ]
      : []),

    // ── Conclusão ──
    ...(report.conclusion
      ? [header('Conclusão'), body(report.conclusion)]
      : []),

    // ── Rodapé ──
    new Paragraph({
      children: [
        new TextRun({ text: 'LF Auditoria e Consultoria  ·  ', size: 16, color: '94A3B8' }),
        new TextRun({ text: today, size: 16, color: '94A3B8' }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { before: 600 },
      border: { top: { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0', space: 8 } },
    }),
  ]

  const doc = new Document({
    creator: 'LF Auditoria e Consultoria',
    title: `Relatório de Conformidade — ${analysis.document_name ?? id}`,
    sections: [{ children }],
  })

  const buffer = await Packer.toBuffer(doc)
  const safeName = (analysis.document_name ?? id).replace(/[^a-zA-Z0-9À-ú\s-]/g, '').trim().replace(/\s+/g, '-')

  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="relatorio-${safeName}.docx"`,
    },
  })
}
