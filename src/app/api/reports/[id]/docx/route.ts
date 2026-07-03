import { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  Document, Packer, Paragraph, TextRun, AlignmentType, BorderStyle, ImageRun,
} from 'docx'
import { readFileSync } from 'fs'
import { join } from 'path'
import { ADEQUACY_RAW_PREFIX } from '@/lib/anthropic/analysis'

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

// ── Logo ──────────────────────────────────────────────────────────────────────

function loadLogo(): Buffer | null {
  try {
    return readFileSync(join(process.cwd(), 'public', 'logo.png'))
  } catch {
    return null
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sectionHeader(text: string, color = '1B3A8C') {
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

// ── Route ─────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  const supabase = buildSupabase(token)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Não autorizado', { status: 401 })

  const admin = createAdminClient()
  const logoData = loadLogo()

  // id is the ANALYSIS id — fetch report by analysis_id
  const { data: reportData, error: reportError } = await admin
    .from('reports')
    .select('*')
    .eq('analysis_id', id)
    .single()

  if (reportError || !reportData) return new Response('Relatório não encontrado', { status: 404 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const report = reportData as any

  const { data: analysisData, error: analysisError } = await admin
    .from('analyses')
    .select('*, theme:themes(name, color), subtopic:subtopics(name)')
    .eq('id', id)
    .single()

  if (analysisError || !analysisData) return new Response('Análise não encontrada', { status: 404 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const analysis = analysisData as any
  const theme = analysis.theme as { name: string } | undefined
  const subtopic = analysis.subtopic as { name: string } | null | undefined
  const today = new Date().toLocaleDateString('pt-BR')

  // ── Document header (logo + title) ────────────────────────────────────────

  const headerChildren: (TextRun | ImageRun)[] = []
  if (logoData) {
    headerChildren.push(
      new ImageRun({ data: logoData, transformation: { width: 36, height: 36 }, type: 'png' })
    )
    headerChildren.push(new TextRun({ text: '   ', size: 20 }))
  }
  headerChildren.push(new TextRun({ text: 'LF Consultoria e Auditoria', bold: true, size: 20, color: '1B3A8C', allCaps: true }))

  const headerParagraph = new Paragraph({
    children: headerChildren,
    alignment: AlignmentType.LEFT,
    spacing: { after: 60 },
  })

  // ── Info rows (same for all types) ────────────────────────────────────────

  const complianceLabel: Record<string, string> = {
    conforme: 'Conforme',
    parcialmente_conforme: 'Parcialmente Conforme',
    nao_conforme: 'Não Conforme',
  }

  // ── Detect adequacy mode ──────────────────────────────────────────────────

  const isAdequacy = typeof report.raw_analysis === 'string' && report.raw_analysis.startsWith(ADEQUACY_RAW_PREFIX)

  let children: Paragraph[]

  if (isAdequacy) {
    // Parse proposals
    type Proposal = { reference: string; original: string; proposed: string; justification: string; lgpd_basis: string }
    let proposals: Proposal[] = []
    try {
      const parsed = JSON.parse(report.raw_analysis.slice(ADEQUACY_RAW_PREFIX.length))
      proposals = parsed.proposals ?? []
    } catch { /* empty proposals on parse error */ }

    children = [
      headerParagraph,
      new Paragraph({
        children: [new TextRun({ text: 'Proposta de Adequação à LGPD', bold: true, size: 36, color: '1a2a5e' })],
        spacing: { after: 40 },
      }),
      new Paragraph({
        children: [new TextRun({ text: today, size: 18, color: '94A3B8' })],
        spacing: { after: 400 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: '1B3A8C', space: 8 } },
      }),

      new Paragraph({
        children: [new TextRun({ text: 'Informações do Documento', bold: true, size: 22, color: '1B3A8C' })],
        spacing: { before: 200, after: 160 },
      }),
      infoRow([['Documento', analysis.document_name ?? '—'], ['Tema', `${theme?.name ?? '—'}${subtopic?.name ? ` › ${subtopic.name}` : ''}`]]),
      infoRow([['Data da análise', new Date(report.created_at).toLocaleDateString('pt-BR')], ['Total de propostas', `${proposals.length}`]]),
      ...(analysis.client_name ? [infoRow([['Cliente', analysis.client_name]])] : []),

      sectionHeader(`Propostas de Adequação — ${proposals.length} cláusula(s)`),

      ...proposals.flatMap((p, i) => [
        new Paragraph({
          children: [
            new TextRun({ text: `${i + 1}. `, bold: true, size: 22, color: '1B3A8C' }),
            new TextRun({ text: p.reference, bold: true, size: 22, color: '1a2a5e' }),
          ],
          spacing: { before: 320, after: 80 },
        }),
        new Paragraph({
          children: [new TextRun({ text: `Base legal: ${p.lgpd_basis}`, size: 18, color: '1B3A8C', italics: true })],
          spacing: { before: 0, after: 140 },
          indent: { left: 360 },
        }),
        new Paragraph({
          children: [new TextRun({ text: 'TEXTO ORIGINAL', bold: true, size: 16, color: 'DC2626', allCaps: true })],
          spacing: { before: 160, after: 60 },
          indent: { left: 360 },
        }),
        new Paragraph({
          children: [new TextRun({ text: p.original, size: 18, color: '64748B', italics: true })],
          spacing: { before: 0, after: 140 },
          indent: { left: 360 },
          border: { left: { style: BorderStyle.SINGLE, size: 8, color: 'FCA5A5', space: 8 } },
        }),
        new Paragraph({
          children: [new TextRun({ text: 'TEXTO PROPOSTO', bold: true, size: 16, color: '16A34A', allCaps: true })],
          spacing: { before: 160, after: 60 },
          indent: { left: 360 },
        }),
        new Paragraph({
          children: [new TextRun({ text: p.proposed, size: 18, color: '1a2a5e' })],
          spacing: { before: 0, after: 140 },
          indent: { left: 360 },
          border: { left: { style: BorderStyle.SINGLE, size: 8, color: '86EFAC', space: 8 } },
        }),
        new Paragraph({
          children: [new TextRun({ text: 'JUSTIFICATIVA', bold: true, size: 16, color: 'D97706', allCaps: true })],
          spacing: { before: 160, after: 60 },
          indent: { left: 360 },
        }),
        new Paragraph({
          children: [new TextRun({ text: p.justification, size: 18, color: '64748B' })],
          spacing: { before: 0, after: 60 },
          indent: { left: 360 },
        }),
      ]),

      // Footer
      new Paragraph({
        children: [
          new TextRun({ text: 'LF Consultoria e Auditoria  ·  ', size: 16, color: '94A3B8' }),
          new TextRun({ text: today, size: 16, color: '94A3B8' }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { before: 600 },
        border: { top: { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0', space: 8 } },
      }),
    ]
  } else {
    // ── Standard compliance report ───────────────────────────────────────────

    children = [
      headerParagraph,
      new Paragraph({
        children: [new TextRun({ text: 'Relatório de Conformidade', bold: true, size: 36, color: '1a2a5e' })],
        spacing: { after: 40 },
      }),
      new Paragraph({
        children: [new TextRun({ text: today, size: 18, color: '94A3B8' })],
        spacing: { after: 400 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: '1B3A8C', space: 8 } },
      }),

      new Paragraph({
        children: [new TextRun({ text: 'Informações do Documento', bold: true, size: 22, color: '1B3A8C' })],
        spacing: { before: 200, after: 160 },
      }),
      infoRow([['Documento', analysis.document_name ?? '—'], ['Tema', `${theme?.name ?? '—'}${subtopic?.name ? ` › ${subtopic.name}` : ''}`]]),
      infoRow([['Data da análise', new Date(report.created_at).toLocaleDateString('pt-BR')], ['Resultado geral', complianceLabel[report.overall_compliance ?? ''] ?? '—']]),
      ...(analysis.client_name
        ? [infoRow([['Cliente', analysis.client_name], ['Pontuação', `${report.compliance_score ?? 0}%`]])]
        : [infoRow([['Pontuação de conformidade', `${report.compliance_score ?? 0}%`]])]),

      sectionHeader('Resumo Executivo'),
      body(report.summary ?? ''),

      ...(report.criteria_used
        ? [sectionHeader('Critérios Utilizados'), body(report.criteria_used)]
        : []),

      ...((report.prompt_responses ?? []).length > 0
        ? [
            sectionHeader('Respostas às Instruções do Gestor', '4338CA'),
            ...(report.prompt_responses as Array<{ prompt: string; response: string }>).flatMap(r => [
              new Paragraph({
                children: [new TextRun({ text: r.prompt, bold: true, size: 20, color: '1a2a5e' })],
                spacing: { before: 200, after: 80 },
              }),
              body(r.response),
            ]),
          ]
        : []),

      ...((report.conforming_points ?? []).length > 0
        ? [sectionHeader('Pontos em Conformidade', '16A34A'), ...pointBlock(report.conforming_points, '✓')]
        : []),

      ...((report.partial_points ?? []).length > 0
        ? [sectionHeader('Parcialmente Conformes', 'D97706'), ...pointBlock(report.partial_points, '◐')]
        : []),

      ...((report.non_conforming_points ?? []).length > 0
        ? [sectionHeader('Não Conformes', 'DC2626'), ...pointBlock(report.non_conforming_points, '✗')]
        : []),

      ...((report.improvement_suggestions ?? []).length > 0
        ? [
            sectionHeader('Sugestões de Melhoria'),
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

      ...(report.conclusion
        ? [sectionHeader('Conclusão'), body(report.conclusion)]
        : []),

      new Paragraph({
        children: [
          new TextRun({ text: 'LF Consultoria e Auditoria  ·  ', size: 16, color: '94A3B8' }),
          new TextRun({ text: today, size: 16, color: '94A3B8' }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { before: 600 },
        border: { top: { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0', space: 8 } },
      }),
    ]
  }

  const doc = new Document({
    creator: 'LF Consultoria e Auditoria',
    title: isAdequacy
      ? `Proposta de Adequação LGPD — ${analysis.document_name ?? id}`
      : `Relatório de Conformidade — ${analysis.document_name ?? id}`,
    sections: [{ children }],
  })

  const buffer = await Packer.toBuffer(doc)
  const safeName = (analysis.document_name ?? id).replace(/[^a-zA-Z0-9À-ú\s-]/g, '').trim().replace(/\s+/g, '-')
  const filePrefix = isAdequacy ? 'adequacao-lgpd' : 'relatorio'

  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${filePrefix}-${safeName}.docx"`,
    },
  })
}
