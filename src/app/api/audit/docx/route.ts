import { NextRequest } from 'next/server'
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, BorderStyle, WidthType, ShadingType, HeightRule,
  Header, Footer, PageNumber, NumberFormat, ImageRun, LeaderType,
} from 'docx'
import * as fs from 'fs'
import * as path from 'path'
import { AuditReportData } from '@/types/audit'

/* ── Paleta ── */
const C = {
  navy:    '123E7C',
  blue:    '1B5FAA',
  green:   '2BA05A',
  amber:   'E8A020',
  amberTx: 'C8860E',
  red:     'C0392B',
  gray:    '5A6A7A',
  text:    '2C3743',
  border:  'D6E2EF',
  bgSoft:  'F4F8FC',
  bgTotal: 'EAF1F9',
  white:   'FFFFFF',
}

/* ── Helpers de formatação ── */
function fmtPct(v: number): string {
  return v.toFixed(1).replace('.', ',') + '%'
}
function scoreColor(v: number) { return v >= 80 ? C.green : v >= 50 ? C.amber : C.red }

/* ── Parse de markdown **negrito** em TextRun[] ── */
function markdownToRuns(text: string | null | undefined, size = 22, color = C.text): TextRun[] {
  const safe = text ?? ''
  if (!safe) return [new TextRun({ text: '', size, color })]
  const parts = safe.split(/(\*\*[^*]+\*\*)/)
  const runs = parts.flatMap(part => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return [new TextRun({ text: part.slice(2, -2), bold: true, size, color })]
    }
    return part ? [new TextRun({ text: part, size, color })] : []
  })
  return runs.length ? runs : [new TextRun({ text: safe, size, color })]
}

/* ── Agrupamento Seção 3 (idêntico ao componente HTML) ── */
interface ReqGroup {
  requisito: string; tema: string; total: number
  conf: number; parc: number; nc: number; na: number; rec: number; pct: number
}
function groupByRequisito(itens: AuditReportData['itens']): ReqGroup[] {
  const map = new Map<string, ReqGroup>()
  for (const it of itens) {
    if (!map.has(it.requisito)) {
      map.set(it.requisito, { requisito: it.requisito, tema: it.tema, total: 0, conf: 0, parc: 0, nc: 0, na: 0, rec: 0, pct: 0 })
    }
    const g = map.get(it.requisito)!
    g.total++
    if (it.classificacao === 'Conforme')                   g.conf++
    else if (it.classificacao === 'Parcialmente Conforme') g.parc++
    else if (it.classificacao === 'Não Conforme')          g.nc++
    else if (it.classificacao === 'Não Aplicável')         g.na++
    if (it.recomendacoes?.trim() && it.recomendacoes !== '—') g.rec++
  }
  for (const [, g] of map) {
    const base = g.total - g.na || 1
    g.pct = ((g.conf + g.parc * 0.5) / base) * 100
  }
  return Array.from(map.values()).sort((a, b) => {
    const parse = (r: string) => { const m = r.match(/(\d+)(?:\.(\d+))?/); return m ? +m[1] * 100 + +(m[2] ?? 0) : 0 }
    return parse(a.requisito) - parse(b.requisito)
  })
}

/* ── Remove assinatura inline da conclusão ── */
function processConclusion(conclusao: string[] | null | undefined, emissao: string) {
  const sigDate = `Santos/SP, ${emissao ?? ''}.`
  const list = Array.isArray(conclusao) ? conclusao : []
  const cleanParas = list
    .map(p => { const s = p ?? ''; const i = s.search(/Santos\/SP/i); return i === -1 ? s : s.slice(0, i).trim() })
    .filter(p => p.trim().length > 0)
  return { paras: cleanParas, sigDate }
}

/* ─────────────────────────────────────────────────────────────
   Faixa da capa: tabela full-bleed com indentação negativa.
   A tabela tem largura = página física A4 (11906 DXA) e
   indent = –left_margin para iniciar na borda física esquerda.
   margin.top = 0 na seção faz a tabela começar no topo exato.
───────────────────────────────────────────────────────────── */

function buildCoverBand(): Table {
  const PAGE_W_DXA = 11906   // largura A4 em twips
  const L_MARGIN   = 1440    // margem esquerda da seção de capa (1 pol)
  const CELL_L_PAD = 1840    // L_MARGIN + 400 recuo visual — alinha com o texto do corpo
  const BAND_H     = 3400    // altura faixa azul em twips (≈ 60 mm)
  const STRIPE_H   = 285     // altura filete verde em twips (≈ 5 mm)

  const nb = { style: BorderStyle.NONE, size: 0, color: 'auto' as const }
  const noBord  = { top: nb, bottom: nb, left: nb, right: nb }
  const noTBord = { ...noBord, insideH: nb, insideV: nb }

  return new Table({
    width:  { size: PAGE_W_DXA, type: WidthType.DXA },
    indent: { size: -L_MARGIN,  type: WidthType.DXA },
    borders: noTBord,
    rows: [
      /* ── Faixa azul-marinho ── */
      new TableRow({
        height: { value: BAND_H, rule: HeightRule.EXACT },
        children: [new TableCell({
          shading: { type: ShadingType.SOLID, color: C.navy },
          margins: { top: 1000, bottom: 0, left: CELL_L_PAD, right: 720 },
          borders: noBord,
          children: [
            new Paragraph({
              children: [new TextRun({
                text: 'RELATÓRIO DE AUDITORIA',
                bold: true, size: 64, color: C.white,
              })],
              spacing: { before: 0, after: 240 },
            }),
            new Paragraph({
              children: [new TextRun({
                text: 'Monitoramento da Certificação OEA-Segurança (OEA-S)',
                size: 22, color: C.white,
              })],
              spacing: { before: 0, after: 0 },
            }),
          ],
        })],
      }),
      /* ── Filete verde ── */
      new TableRow({
        height: { value: STRIPE_H, rule: HeightRule.EXACT },
        children: [new TableCell({
          shading: { type: ShadingType.SOLID, color: C.green },
          margins: { top: 0, bottom: 0, left: 0, right: 0 },
          borders: noBord,
          children: [new Paragraph({ text: '', spacing: { before: 0, after: 0 } })],
        })],
      }),
    ],
  })
}

/* ── Sub-construtores ── */

function bodyParagraph(text: string | null | undefined): Paragraph {
  return new Paragraph({
    children: markdownToRuns(text ?? '', 22, '000000'),
    spacing: { before: 0, after: 0, line: 360, lineRule: 'auto' as const },
    alignment: AlignmentType.BOTH,
  })
}

/** Título de seção numerada — começa em nova página (exceto Seção 1 quando logo após sumário) */
function sectionTitle(num: string, title: string): Paragraph[] {
  return [new Paragraph({
    pageBreakBefore: true,
    children: [
      new TextRun({ text: `${num}. `, color: C.green, bold: true, size: 28 }),
      new TextRun({ text: title,      color: C.blue,  bold: true, size: 28 }),
    ],
    spacing: { before: 120, after: 120 },
    border: { bottom: { color: C.blue, size: 6, style: BorderStyle.SINGLE } },
  })]
}

function headerText(right: string): Header {
  return new Header({
    children: [new Paragraph({
      children: [
        new TextRun({ text: 'LF Auditoria e Consultoria', bold: true, color: C.navy, size: 18 }),
        new TextRun({ text: `\t${right}`, color: C.gray, size: 15 }),
      ],
      tabStops: [{ type: 'right' as const, position: 9000 }],
      border: { bottom: { color: C.blue, size: 4, style: BorderStyle.SINGLE } },
    })],
  })
}

function footerContent(): Footer {
  return new Footer({
    children: [new Paragraph({
      children: [
        new TextRun({ text: 'LF Auditoria e Consultoria · lfconsultoria.srv.br\t', size: 16, color: C.gray }),
        new TextRun({ text: 'Página ', size: 16, color: C.gray }),
        new TextRun({ children: [PageNumber.CURRENT], size: 16, color: C.gray }),
        new TextRun({ text: ' de ', size: 16, color: C.gray }),
        new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: C.gray }),
      ],
      tabStops: [{ type: 'right' as const, position: 9000 }],
      border: { top: { color: C.border, size: 4, style: BorderStyle.SINGLE } },
    })],
  })
}

/** Sumário com linha pontilhada e número de página alinhado à direita */
function buildSumario(): Paragraph[] {
  const items = [
    { title: 'Resumo Executivo',               page: '3' },
    { title: 'Índice Geral de Conformidade',   page: '4' },
    { title: 'Resultado por Requisito',        page: '5' },
    { title: 'Quadro Executivo de Resultados', page: '6' },
    { title: 'Conclusão',                      page: '7' },
  ]
  return [
    new Paragraph({
      children: [
        new TextRun({ text: 'Sumário', color: C.blue, bold: true, size: 32 }),
      ],
      spacing: { before: 200, after: 120 },
      border: { bottom: { color: C.blue, size: 6, style: BorderStyle.SINGLE } },
    }),
    new Paragraph({ text: '', spacing: { before: 200 } }),
    ...items.map((item, i) =>
      new Paragraph({
        children: [
          new TextRun({ text: `${i + 1}.  `, color: C.green, bold: true, size: 24 }),
          new TextRun({ text: item.title, size: 22, color: C.text }),
          new TextRun({ text: '\t', size: 22 }),
          new TextRun({ text: item.page, bold: true, size: 22, color: C.navy }),
        ],
        tabStops: [{ type: 'right' as const, position: 9000, leader: LeaderType.DOT }],
        spacing: { before: 160, after: 160 },
        border: { bottom: { color: C.border, size: 4, style: BorderStyle.SINGLE } },
      })
    ),
  ]
}

/** Faixa de 5 cartões indicadores */
interface StatCard { label: string; value: string; color: string; sublabel?: string }
function buildStatCardsRow(cards: StatCard[]): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [new TableRow({
      children: cards.map(card =>
        new TableCell({
          width: { size: Math.floor(100 / cards.length), type: WidthType.PERCENTAGE },
          children: [
            new Paragraph({
              children: [new TextRun({ text: card.value, bold: true, size: 40, color: card.color })],
              alignment: AlignmentType.CENTER,
              spacing: { before: 100, after: 40 },
            }),
            new Paragraph({
              children: [new TextRun({ text: card.label, size: 15, color: C.gray })],
              alignment: AlignmentType.CENTER,
              spacing: { before: 0, after: card.sublabel ? 0 : 100 },
            }),
            ...(card.sublabel ? [new Paragraph({
              children: [new TextRun({ text: card.sublabel, size: 14, color: C.gray })],
              alignment: AlignmentType.CENTER,
              spacing: { before: 0, after: 100 },
            })] : []),
          ],
          shading: { type: ShadingType.SOLID, color: C.bgSoft },
          borders: {
            top:    { style: BorderStyle.SINGLE, size: 18, color: card.color },
            bottom: { style: BorderStyle.SINGLE, size: 4,  color: C.border },
            left:   { style: BorderStyle.SINGLE, size: 4,  color: C.border },
            right:  { style: BorderStyle.SINGLE, size: 4,  color: C.border },
          },
        })
      ),
    })],
  })
}

/** Gráfico de rosca — aproximação visual em tabela */
function buildDonutChart(stats: AuditReportData['stats']): (Paragraph | Table)[] {
  const total = stats.total || 1
  const slices = [
    { label: 'Conforme',              value: stats.conforme,     color: C.green },
    { label: 'Parcialmente Conforme', value: stats.parcialmente ?? 0, color: C.amber },
    { label: 'Não Conforme',          value: stats.nao_conforme, color: C.red   },
    { label: 'Não Aplicável',         value: stats.nao_aplicavel, color: C.gray },
  ].filter(s => s.value > 0)

  const chart = new Table({
    width: { size: 85, type: WidthType.PERCENTAGE },
    rows: [new TableRow({
      children: [
        // Célula esquerda: valor grande centralizado
        new TableCell({
          width: { size: 50, type: WidthType.PERCENTAGE },
          children: [
            new Paragraph({
              children: [new TextRun({
                text: fmtPct(stats.indice_conformidade),
                bold: true, size: 64, color: scoreColor(stats.indice_conformidade),
              })],
              alignment: AlignmentType.CENTER,
              spacing: { before: 300, after: 80 },
            }),
            new Paragraph({
              children: [new TextRun({ text: 'Conformidade Geral', size: 18, color: C.gray })],
              alignment: AlignmentType.CENTER,
              spacing: { before: 0, after: 300 },
            }),
          ],
          shading: { type: ShadingType.SOLID, color: C.bgSoft },
          borders: {
            top:    { style: BorderStyle.SINGLE, size: 8, color: scoreColor(stats.indice_conformidade) },
            bottom: { style: BorderStyle.SINGLE, size: 4, color: C.border },
            left:   { style: BorderStyle.SINGLE, size: 4, color: C.border },
            right:  { style: BorderStyle.SINGLE, size: 4, color: C.border },
          },
          margins: { top: 100, bottom: 100, left: 200, right: 200 },
        }),
        // Célula direita: legenda
        new TableCell({
          width: { size: 50, type: WidthType.PERCENTAGE },
          children: [
            new Paragraph({
              children: [new TextRun({ text: 'Distribuição', bold: true, size: 18, color: C.navy })],
              spacing: { before: 160, after: 120 },
            }),
            ...slices.map(s => new Paragraph({
              children: [
                new TextRun({ text: '■  ', color: s.color, bold: true, size: 20 }),
                new TextRun({ text: `${s.label}`, size: 19, color: C.gray }),
                new TextRun({ text: `  —  ${s.value}`, bold: true, size: 19, color: C.text }),
                new TextRun({ text: `  (${fmtPct((s.value / total) * 100)})`, size: 18, color: C.gray }),
              ],
              spacing: { before: 80, after: 80 },
            })),
          ],
          borders: {
            top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
            left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
          },
          margins: { top: 100, bottom: 100, left: 200, right: 100 },
        }),
      ],
    })],
  })

  return [chart]
}

/** Seção 3 — tabela consolidada por requisito */
function buildReqGroupTable(report: AuditReportData): Table {
  const grupos  = groupByRequisito(report.itens)
  const totConf  = grupos.reduce((a, g) => a + g.conf,  0)
  const totParc  = grupos.reduce((a, g) => a + g.parc,  0)
  const totNC    = grupos.reduce((a, g) => a + g.nc,    0)
  const totRec   = grupos.reduce((a, g) => a + g.rec,   0)
  const totItens = grupos.reduce((a, g) => a + g.total, 0)

  const W    = [9, 34, 8, 7, 7, 9, 9, 10]
  const HDRS = ['Requisito', 'Tema Principal', 'Itens\nAval.', 'Conf.', 'Parc.', 'Não\nConf.', 'Recomen-\ndações', '%\nConform.']

  const noBorder = { style: BorderStyle.NONE } as const
  const thinBorder = (color = C.border) => ({ style: BorderStyle.SINGLE, size: 4, color }) as const

  const headerRow = new TableRow({
    tableHeader: true,
    children: HDRS.map((h, i) => new TableCell({
      width: { size: W[i], type: WidthType.PERCENTAGE },
      children: [new Paragraph({
        children: [new TextRun({ text: h, bold: true, color: C.white, size: 16 })],
        alignment: i >= 2 ? AlignmentType.CENTER : AlignmentType.LEFT,
      })],
      shading: { type: ShadingType.SOLID, color: C.blue },
    })),
  })

  const dataRows = grupos.map((g, i) => {
    const bg = i % 2 === 0 ? C.white : C.bgSoft
    const row = [
      { v: g.requisito,                           align: AlignmentType.CENTER, color: C.text,    bold: true  },
      { v: g.tema,                                align: AlignmentType.LEFT,   color: C.text,    bold: false },
      { v: String(g.total),                       align: AlignmentType.CENTER, color: C.text,    bold: false },
      { v: g.conf > 0 ? String(g.conf) : '–',    align: AlignmentType.CENTER, color: g.conf > 0 ? C.green   : C.gray, bold: false },
      { v: g.parc > 0 ? String(g.parc) : '–',    align: AlignmentType.CENTER, color: g.parc > 0 ? C.amber   : C.gray, bold: false },
      { v: g.nc > 0   ? String(g.nc)   : '–',    align: AlignmentType.CENTER, color: g.nc > 0   ? C.red     : C.gray, bold: false },
      { v: g.rec > 0  ? String(g.rec)  : '–',    align: AlignmentType.CENTER, color: g.rec > 0  ? C.amberTx : C.gray, bold: false },
      { v: fmtPct(g.pct),                         align: AlignmentType.CENTER, color: scoreColor(g.pct),     bold: true  },
    ]
    return new TableRow({
      children: row.map((c, idx) => new TableCell({
        width: { size: W[idx], type: WidthType.PERCENTAGE },
        children: [new Paragraph({
          children: [new TextRun({ text: c.v, size: 18, color: c.color, bold: c.bold })],
          alignment: c.align,
        })],
        shading: { type: ShadingType.SOLID, color: bg },
      })),
    })
  })

  // Linha de total — Tema = nome do critério
  const mk = (v: string, color: string, align: (typeof AlignmentType)[keyof typeof AlignmentType], w: number, bold = true) =>
    new TableCell({
      width: { size: w, type: WidthType.PERCENTAGE },
      children: [new Paragraph({ children: [new TextRun({ text: v, bold, size: 18, color })], alignment: align })],
      shading: { type: ShadingType.SOLID, color: C.bgTotal },
    })

  const totalRow = new TableRow({
    children: [
      mk('Total',                                                             C.text,                              AlignmentType.CENTER, W[0]),
      mk(report.criterio,                                                     C.text,                              AlignmentType.LEFT,   W[1]),
      mk(String(totItens),                                                    C.text,                              AlignmentType.CENTER, W[2]),
      mk(String(totConf),                                                     C.green,                             AlignmentType.CENTER, W[3]),
      mk(totParc > 0 ? String(totParc) : '–',  totParc > 0 ? C.amber   : C.gray, AlignmentType.CENTER, W[4]),
      mk(totNC   > 0 ? String(totNC)   : '–',  totNC   > 0 ? C.red     : C.gray, AlignmentType.CENTER, W[5]),
      mk(totRec  > 0 ? String(totRec)  : '–',  totRec  > 0 ? C.amberTx : C.gray, AlignmentType.CENTER, W[6]),
      mk(fmtPct(report.stats.indice_conformidade), scoreColor(report.stats.indice_conformidade), AlignmentType.CENTER, W[7]),
    ],
  })

  // Aplica bordas na tabela
  void noBorder; void thinBorder

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...dataRows, totalRow],
  })
}

/** Nota_atencao: separa nota normal de "Critério de contagem:" em bold */
function buildNotaAtencao(nota: string): Paragraph[] {
  if (!nota) return []
  const idx = nota.search(/Crit[eé]rio de contagem[:\s]/i)
  const paras: Paragraph[] = []

  const before = idx === -1 ? nota.trim() : nota.slice(0, idx).trim()
  if (before) {
    paras.push(new Paragraph({
      children: markdownToRuns(before, 18, C.gray),
      spacing: { before: 120, after: idx === -1 ? 0 : 100 },
    }))
  }
  if (idx !== -1) {
    const afterStr = nota.slice(idx).trim()
    const colonIdx = afterStr.indexOf(':')
    const boldPart = colonIdx !== -1 ? afterStr.slice(0, colonIdx + 1) : 'Critério de contagem:'
    const restPart = colonIdx !== -1 ? afterStr.slice(colonIdx + 1).trim() : afterStr
    paras.push(new Paragraph({
      children: [
        new TextRun({ text: boldPart + ' ', bold: true, size: 18, color: C.text }),
        ...markdownToRuns(restPart, 18, C.text),
      ],
      spacing: { before: 0, after: 0 },
    }))
  }
  return paras
}

/** Seção 4 — tabela de indicadores: Indicador regular, Resultado centralizado */
function buildExecutiveTable(report: AuditReportData): Table {
  const rows: [string, string][] = [
    ['Critério auditado',                    report.criterio],
    ['Procedimento de referência',            report.procedimento_referencia],
    ['Período analisado',                     report.periodo],
    ['Metodologia aplicada',                  report.metodologia],
    ['Itens avaliados',                       String(report.stats.total)],
    ['Itens Conformes',                       String(report.stats.conforme)],
    ...((report.stats.parcialmente ?? 0) > 0 ? [['Itens Parcialmente Conformes', String(report.stats.parcialmente)] as [string, string]] : []),
    ['Itens Não Conformes',                   String(report.stats.nao_conforme)],
    ['Itens Não Aplicáveis',                  String(report.stats.nao_aplicavel)],
    ['Não conformidades registradas',         String(report.total_nao_conformidades)],
    ['Recomendações de melhoria',             String(report.total_recomendacoes)],
    ['Requisito com maior necessidade de atenção', report.item_maior_atencao ?? '—'],
  ]

  const headerRow = new TableRow({
    tableHeader: true,
    children: ['Indicador', 'Resultado'].map((h, i) => new TableCell({
      children: [new Paragraph({
        children: [new TextRun({ text: h, bold: true, color: C.white, size: 18 })],
        alignment: i === 1 ? AlignmentType.CENTER : AlignmentType.LEFT,
      })],
      shading: { type: ShadingType.SOLID, color: C.blue },
      width: i === 0 ? { size: 38, type: WidthType.PERCENTAGE } : undefined,
    })),
  })

  const dataRows = rows.map(([ind, res], i) => {
    const bg = i % 2 === 0 ? C.white : C.bgSoft
    return new TableRow({
      children: [
        new TableCell({
          children: [new Paragraph({
            children: [new TextRun({ text: ind, size: 18, color: C.text })], // sem bold
          })],
          shading: { type: ShadingType.SOLID, color: bg },
          width: { size: 38, type: WidthType.PERCENTAGE },
        }),
        new TableCell({
          children: [new Paragraph({
            children: markdownToRuns(res, 18),
            alignment: AlignmentType.CENTER, // centralizado como no PDF
          })],
          shading: { type: ShadingType.SOLID, color: bg },
        }),
      ],
    })
  })

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...dataRows],
  })
}

/* ══════════════════════════════════════════════════
   HANDLER
══════════════════════════════════════════════════ */
export async function POST(req: NextRequest) {
  try {
    const body   = await req.json()
    const report = body.report as AuditReportData

    if (!report?.empresa) {
      return Response.json({ error: 'Dados do relatório inválidos.' }, { status: 400 })
    }

    // Logo
    let logoData: Buffer | undefined
    const logoPath = path.join(process.cwd(), 'public', 'logo.png')
    if (fs.existsSync(logoPath)) logoData = fs.readFileSync(logoPath)

    const { paras: conclusaoParas, sigDate } = processConclusion(report.conclusao, report.emissao)
    const { stats } = report
    const sliceTotal = stats.total || 1
    const pctConf = (stats.conforme    / sliceTotal) * 100
    const pctParc = ((stats.parcialmente ?? 0) / sliceTotal) * 100
    const pctNC   = (stats.nao_conforme / sliceTotal) * 100

    const headerRight = `Relatório Executivo de Auditoria — Monitoramento OEA-S · ${report.empresa}`

    const doc = new Document({
      numbering: { config: [] },

      // ── Estilo padrão do documento ──
      // Garante que qualquer parágrafo sem estilo explícito herde:
      // • fonte preta (#000000)
      // • espaçamento antes = 0 pt, depois = 0 pt
      // • entrelinhamento = 1,5 linhas (line 360 = 1,5 × 240 twips)
      styles: {
        default: {
          document: {
            run: { color: '000000' },
            paragraph: {
              spacing: { before: 0, after: 0, line: 360, lineRule: 'auto' as const },
            },
          },
        },
      },

      sections: [

        /* ══════════════ CAPA ══════════════ */
        {
          properties: {
            titlePage: true, // habilita rodapé diferenciado na 1ª página
            page: {
              pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL },
              margin: {
                // top = 0 → corpo começa na borda física superior (faixa azul ocupa os primeiros ~65 mm)
                // footer = 720 twips (≈ 12,7 mm da borda) → rodapé próximo ao limite inferior
                top: 0, right: 1440, bottom: 1440, left: 1440, footer: 720,
              },
            },
          },
          // Rodapé real da primeira página — fica fixo na margem inferior pelo Word
          footers: {
            first: new Footer({
              children: [new Paragraph({
                children: [new TextRun({
                  text: 'LF Auditoria e Consultoria · Compartilhando Conhecimento · lfconsultoria.srv.br',
                  size: 18, color: C.gray,
                })],
                alignment: AlignmentType.CENTER,
                border: { top: { color: C.border, size: 4, style: BorderStyle.SINGLE } },
                spacing: { before: 120 },
              })],
            }),
          },
          children: [
            // Faixa azul-marinho + filete verde (tabela full-bleed via indentação negativa)
            buildCoverBand(),

            // Logo
            ...(logoData
              ? [new Paragraph({
                  children: [new ImageRun({ data: logoData, transformation: { width: 130, height: 130 }, type: 'png' })],
                  alignment: AlignmentType.CENTER,
                  spacing: { before: 720, after: 400 },
                })]
              : [new Paragraph({ text: '', spacing: { before: 720, after: 400 } })]),

            // Empresa
            new Paragraph({
              children: [new TextRun({ text: report.empresa.toUpperCase(), bold: true, size: 36, color: C.navy })],
              alignment: AlignmentType.CENTER,
              spacing: { after: 200 },
            }),
            new Paragraph({
              children: [new TextRun({ text: report.criterio, size: 26, color: C.blue, bold: true })],
              alignment: AlignmentType.CENTER,
              spacing: { after: 160 },
            }),
            new Paragraph({
              children: [new TextRun({ text: report.requisitos, size: 22, color: C.gray })],
              alignment: AlignmentType.CENTER,
              spacing: { after: 400 },
            }),
            ...(report.auditor ? [new Paragraph({
              children: [new TextRun({ text: `Auditor: ${report.auditor}`, size: 20, color: C.gray })],
              alignment: AlignmentType.CENTER,
              spacing: { after: 80 },
            })] : []),
            // Parágrafo vazio final para empurrar o Word a reconhecer o fim do conteúdo
            new Paragraph({ text: '' }),
          ],
        },

        /* ══════════════ SUMÁRIO + SEÇÕES 1–5 ══════════════ */
        {
          headers: { default: headerText(headerRight) },
          footers: { default: footerContent() },
          children: [

            /* ── Sumário ── */
            ...buildSumario(),

            /* ══ 1. Resumo Executivo ══ */
            ...sectionTitle('1', 'Resumo Executivo'),
            ...(report.resumo_executivo ?? []).map(p => bodyParagraph(p)),

            /* ══ 2. Índice Geral de Conformidade ══ */
            ...sectionTitle('2', 'Índice Geral de Conformidade'),
            new Paragraph({
              children: [
                new TextRun({ text: 'Critério de cálculo: ', bold: true, size: 22, color: C.text }),
                ...markdownToRuns(
                  report.indice_calculo_descricao
                    ? report.indice_calculo_descricao.replace(/^[Cc]rit[eé]rio de c[aá]lculo[:\s]*/i, '')
                    : `o índice pondera as classificações atribuindo 100% aos Conformes e 0% aos Não Conformes. Itens Não Aplicáveis são excluídos da base de cálculo. Índice apurado: ${fmtPct(stats.indice_conformidade)}.`
                ),
              ],
              spacing: { after: 200 },
              alignment: AlignmentType.BOTH,
            }),
            new Paragraph({ text: '', spacing: { before: 120 } }),

            // cartões com sublabel de % — "Parcialmente" apenas para relatórios antigos
            buildStatCardsRow([
              { label: 'Itens Avaliados',     value: String(stats.total),         color: C.blue  },
              { label: 'Conformes',            value: String(stats.conforme),      color: C.green, sublabel: `(${fmtPct(pctConf)})` },
              ...((stats.parcialmente ?? 0) > 0 ? [{ label: 'Parcialmente Conf.', value: String(stats.parcialmente), color: C.amber, sublabel: `(${fmtPct(pctParc)})` }] : []),
              { label: 'Não Conformes',        value: String(stats.nao_conforme),  color: C.red,   sublabel: `(${fmtPct(pctNC)})` },
              { label: 'Não Aplicáveis',       value: String(stats.nao_aplicavel), color: C.gray  },
            ]),
            new Paragraph({ text: '', spacing: { before: 200 } }),

            // Gráfico de rosca (aproximação visual)
            ...buildDonutChart(stats),
            new Paragraph({ text: '', spacing: { before: 80 } }),
            new Paragraph({
              children: [new TextRun({
                text: `Distribuição das classificações de atendimento dos ${stats.total} itens avaliados no critério ${report.criterio}.`,
                size: 18, color: C.gray, italics: true,
              })],
              alignment: AlignmentType.CENTER,
              spacing: { before: 80, after: 0 },
            }),

            /* ══ 3. Resultado por Requisito ══ */
            ...sectionTitle('3', 'Resultado por Requisito'),
            new Paragraph({
              children: markdownToRuns(
                `A tabela a seguir consolida o desempenho por requisito do critério ${report.criterio}, ` +
                `permitindo identificar as áreas com melhor desempenho e aquelas que demandam maior atenção. ` +
                `O percentual de conformidade de cada requisito segue o mesmo critério de ponderação do índice geral.`
              ),
              spacing: { after: 160 },
              alignment: AlignmentType.BOTH,
            }),
            buildReqGroupTable(report),
            ...buildNotaAtencao(report.nota_atencao ?? ''),

            /* ══ 4. Quadro Executivo de Resultados ══ */
            ...sectionTitle('4', 'Quadro Executivo de Resultados'),
            new Paragraph({
              children: [new TextRun({ text: `Síntese dos principais indicadores da auditoria do critério ${report.criterio}:`, size: 22, color: C.text })],
              spacing: { after: 160 },
            }),
            buildStatCardsRow([
              { label: 'Conformidade\nGeral',    value: fmtPct(stats.indice_conformidade), color: scoreColor(stats.indice_conformidade) },
              { label: 'Itens\nAvaliados',       value: String(stats.total),               color: C.blue  },
              { label: 'Itens\nConformes',       value: String(stats.conforme),            color: C.green },
              { label: 'Não\nConformidades',     value: String(report.total_nao_conformidades), color: C.red   },
              { label: 'Recomendação\nde Melhoria', value: String(report.total_recomendacoes), color: C.amber },
            ]),
            new Paragraph({ text: '', spacing: { before: 200 } }),
            buildExecutiveTable(report),

            /* ══ 5. Conclusão ══ */
            ...sectionTitle('5', 'Conclusão'),
            ...conclusaoParas.map(p => bodyParagraph(p)),

            // Assinatura separada com linha acima
            new Paragraph({ text: '', spacing: { before: 480 } }),
            new Paragraph({
              children: [new TextRun({ text: sigDate, size: 20, color: C.gray })],
              spacing: { before: 0, after: 120 },
              border: { top: { color: C.border, size: 4, style: BorderStyle.SINGLE } },
            }),
            new Paragraph({
              children: [new TextRun({ text: 'LF Auditoria e Consultoria', bold: true, size: 22, color: C.navy })],
            }),
          ],
        },
      ],
    })

    const buf = await Packer.toBuffer(doc)
    const filename = `Relatorio_Executivo_${report.empresa.replace(/[^a-zA-Z0-9]/g, '_')}.docx`

    return new Response(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (err) {
    console.error('[audit/docx]', err)
    return Response.json({ error: err instanceof Error ? err.message : 'Erro ao gerar DOCX.' }, { status: 500 })
  }
}
