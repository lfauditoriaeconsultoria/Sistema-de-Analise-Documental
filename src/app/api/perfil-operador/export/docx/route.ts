import { NextRequest } from 'next/server'
import {
  Document, Packer, Paragraph, TextRun,
  AlignmentType, BorderStyle, Header, Footer, PageNumber, NumberFormat, ImageRun,
} from 'docx'
import * as fs from 'fs'
import * as path from 'path'
import { PerfilOperadorItem } from '@/types/perfil-operador'
import { getAuthedAdmin } from '@/lib/perfil-operador/auth'

/* ── Paleta — mesma identidade visual de /api/audit/docx ── */
const C = {
  navy: '123E7C', blue: '1B5FAA', green: '2BA05A', gray: '5A6A7A',
  text: '2C3743', border: 'D6E2EF', white: 'FFFFFF',
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

function criterioTitle(nome: string): Paragraph {
  return new Paragraph({
    pageBreakBefore: true,
    children: [new TextRun({ text: nome, bold: true, color: C.blue, size: 30 })],
    spacing: { before: 120, after: 200 },
    border: { bottom: { color: C.blue, size: 6, style: BorderStyle.SINGLE } },
  })
}

function itemBlock(item: PerfilOperadorItem): Paragraph[] {
  const paras: Paragraph[] = [
    new Paragraph({
      children: [
        new TextRun({ text: `${item.item_number}  `, bold: true, color: C.green, size: 22 }),
        new TextRun({ text: item.item_description, bold: true, color: C.text, size: 22 }),
      ],
      spacing: { before: 280, after: 120 },
    }),
    new Paragraph({
      children: [new TextRun({
        text: item.resposta?.trim() || '[Resposta ainda não elaborada]',
        size: 22, color: '000000',
        italics: !item.resposta?.trim(),
      })],
      alignment: AlignmentType.BOTH,
      spacing: { after: 80, line: 360, lineRule: 'auto' as const },
    }),
  ]
  return paras
}

export async function POST(req: NextRequest) {
  // Módulo em desenvolvimento — liberado apenas para administradores
  if (!(await getAuthedAdmin(req))) {
    return Response.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const cliente = String(body.cliente ?? '').trim()
    const items   = Array.isArray(body.items) ? (body.items as PerfilOperadorItem[]) : []

    if (!cliente || !items.length) {
      return Response.json({ error: 'Dados insuficientes para exportar.' }, { status: 400 })
    }

    let logoData: Buffer | undefined
    const logoPath = path.join(process.cwd(), 'public', 'logo.png')
    if (fs.existsSync(logoPath)) logoData = fs.readFileSync(logoPath)

    // Agrupa por critério, preservando a ordem de número do critério e item
    const sorted = [...items].sort((a, b) =>
      a.criteria_number - b.criteria_number || a.item_number.localeCompare(b.item_number, 'pt-BR', { numeric: true })
    )
    const byCriterio = new Map<string, PerfilOperadorItem[]>()
    for (const it of sorted) {
      const key = `${it.criteria_number}. ${it.criteria_name}`
      if (!byCriterio.has(key)) byCriterio.set(key, [])
      byCriterio.get(key)!.push(it)
    }

    const headerRight = `Perfil do Operador — ${cliente}`
    const today = new Date().toLocaleDateString('pt-BR')

    const body_children: Paragraph[] = []
    let first = true
    for (const [criterioLabel, criterioItems] of byCriterio) {
      const titlePara = criterioTitle(criterioLabel)
      if (first) { /* mantém quebra de página mesmo na 1ª seção — separa da capa */ }
      body_children.push(titlePara)
      for (const it of criterioItems) body_children.push(...itemBlock(it))
      first = false
    }

    const doc = new Document({
      numbering: { config: [] },
      styles: {
        default: {
          document: {
            run: { color: '000000' },
            paragraph: { spacing: { before: 0, after: 0, line: 276, lineRule: 'auto' as const } },
          },
        },
      },
      sections: [
        {
          properties: { page: { pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL } } },
          headers: { default: headerText(headerRight) },
          footers: { default: footerContent() },
          children: [
            ...(logoData ? [new Paragraph({
              children: [new ImageRun({ data: logoData, transformation: { width: 90, height: 90 }, type: 'png' })],
              alignment: AlignmentType.CENTER,
              spacing: { before: 200, after: 300 },
            })] : []),
            new Paragraph({
              children: [new TextRun({ text: 'PERFIL DO OPERADOR', bold: true, size: 40, color: C.navy })],
              alignment: AlignmentType.CENTER,
              spacing: { after: 160 },
            }),
            new Paragraph({
              children: [new TextRun({ text: cliente.toUpperCase(), bold: true, size: 28, color: C.blue })],
              alignment: AlignmentType.CENTER,
              spacing: { after: 100 },
            }),
            new Paragraph({
              children: [new TextRun({ text: `Programa OEA — ${today}`, size: 20, color: C.gray })],
              alignment: AlignmentType.CENTER,
              spacing: { after: 0 },
            }),
            ...body_children,
          ],
        },
      ],
    })

    const buf = await Packer.toBuffer(doc)
    const filename = `Perfil_Operador_${cliente.replace(/[^a-zA-Z0-9]/g, '_')}.docx`

    return new Response(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (err) {
    console.error('[perfil-operador/export/docx]', err)
    return Response.json({ error: err instanceof Error ? err.message : 'Erro ao gerar DOCX.' }, { status: 500 })
  }
}
