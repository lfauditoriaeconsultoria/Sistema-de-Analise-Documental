import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import * as fs from 'fs'
import * as path from 'path'
import ExcelJS from 'exceljs'
// mammoth não tem types default export — usar require
// eslint-disable-next-line @typescript-eslint/no-require-imports
const mammoth = require('mammoth') as typeof import('mammoth')

export const maxDuration = 300

/* ── Nomes dos meses em português para o filename ── */
const MESES = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']

function buildFilename(cliente: string, criterio: string): string {
  const now  = new Date()
  const dd   = String(now.getDate()).padStart(2, '0')
  const mes  = MESES[now.getMonth()]
  const yyyy = now.getFullYear()
  const safe = (s: string) => s.replace(/[/\\:*?"<>|]/g, '-')
  return safe(`Monitoramento OEA - ${cliente} - Checklist Auditoria ${yyyy} (${criterio}) - rev LF ${dd}${mes}${yyyy}`)
}

/* ── Lê o prompt mestre e o template da pasta raiz do projeto ── */
function loadPromptMestre(): string {
  const p = path.resolve(process.cwd(), '..', 'preenchimento_planilha_auditoria', 'prompt_mestre.txt')
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf-8') : ''
}

function loadTemplate(): Buffer {
  const p = path.resolve(process.cwd(), '..', 'preenchimento_planilha_auditoria', 'Monitoramento OEA - EMPRESA - Checklist Auditoria.xlsx')
  return fs.readFileSync(p)
}

/* ── Item de checklist gerado pela IA ── */
interface ChecklistItem {
  id:                 number
  criterio:           string
  requisito:          string
  qualificador:       string
  doc_codigo:         string
  doc_versao:         string
  doc_nome:           string
  item_numero:        string
  item_nome:          string
  subitem:            string
  processo_auditado:  string
  periodo:            string
  evidencia:          string
  metodologia:        string
}

/* ── Preenche o template preservando formatação via ExcelJS ── */
async function fillTemplate(
  templateBuffer: Buffer,
  items: ChecklistItem[],
): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook()
  // Node.js 20 usa Buffer<ArrayBufferLike>; ExcelJS espera Buffer legado — cast seguro em runtime
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await wb.xlsx.load(templateBuffer as any)
  const ws = wb.worksheets[0]

  // Captura o estilo da 1ª linha de dados (row 3) para replicar em linhas extras
  const styleRow = ws.getRow(3)

  function cloneCellStyle(srcCol: number): Partial<ExcelJS.Style> {
    const src = styleRow.getCell(srcCol)
    try {
      return JSON.parse(JSON.stringify(src.style ?? {}))
    } catch {
      return {}
    }
  }

  items.forEach((item, idx) => {
    const rowNum = 3 + idx  // dados a partir da linha 3 (1-indexed)
    const row    = ws.getRow(rowNum)

    // Linhas além do template (>24): aplica estilo da linha 3 em cada célula A–P
    if (rowNum > 24) {
      row.height = 87  // altura padrão compatível com o template
      for (let col = 1; col <= 16; col++) {
        const cell = row.getCell(col)
        const sty  = cloneCellStyle(col)
        if (Object.keys(sty).length) cell.style = sty as ExcelJS.Style
      }
    }

    // Preenche A–P (colunas 1–16); B e C ficam em branco (preenchimento manual de campo)
    row.getCell(1).value  = item.id
    // col 2 (B) = data auditoria — em branco
    // col 3 (C) = auditor — em branco
    row.getCell(4).value  = item.criterio
    row.getCell(5).value  = item.requisito
    row.getCell(6).value  = item.qualificador
    row.getCell(7).value  = item.doc_codigo
    row.getCell(8).value  = item.doc_versao
    row.getCell(9).value  = item.doc_nome
    row.getCell(10).value = item.item_numero
    row.getCell(11).value = item.item_nome
    row.getCell(12).value = item.subitem
    row.getCell(13).value = item.processo_auditado
    row.getCell(14).value = item.periodo
    row.getCell(15).value = item.evidencia
    row.getCell(16).value = item.metodologia
    // colunas Q (17) em diante = intocadas (etapa de conformidade)

    row.commit()
  })

  // writeBuffer() retorna Buffer/ArrayBuffer — normaliza para Uint8Array (BodyInit compatível)
  const buf = await wb.xlsx.writeBuffer()
  return new Uint8Array(buf instanceof Buffer ? buf : Buffer.from(buf))
}

/* ── Handler principal ── */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const criterio = (formData.get('criterio') as string | null)?.trim()
    const cliente  = (formData.get('cliente')  as string | null)?.trim()
    const files    = formData.getAll('files') as File[]

    if (!criterio) return Response.json({ error: 'Selecione o critério OEA.' }, { status: 400 })
    if (!cliente)  return Response.json({ error: 'Informe o nome do cliente.' }, { status: 400 })
    if (!files.length) return Response.json({ error: 'Envie ao menos um documento.' }, { status: 400 })

    // ── Processa os arquivos enviados pelo usuário ────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const docBlocks: any[] = []
    let totalSize = 0

    for (const file of files) {
      if (file.size > 20 * 1024 * 1024) {
        return Response.json({ error: `Arquivo "${file.name}" ultrapassa 20 MB.` }, { status: 413 })
      }
      totalSize += file.size
      if (totalSize > 60 * 1024 * 1024) {
        return Response.json({ error: 'Tamanho total dos arquivos ultrapassa 60 MB.' }, { status: 413 })
      }

      const buffer = Buffer.from(await file.arrayBuffer())
      const ext = file.name.split('.').pop()?.toLowerCase() ?? ''

      if (ext === 'pdf') {
        docBlocks.push({
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: buffer.toString('base64') },
          title: file.name,
        })
      } else if (ext === 'docx' || ext === 'doc') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await mammoth.extractRawText({ buffer: buffer as any })
        if (result.value.trim()) {
          docBlocks.push({
            type: 'text',
            text: `=== Documento: ${file.name} ===\n${result.value.trim()}`,
          })
        }
      } else if (['txt', 'md', 'csv'].includes(ext)) {
        const text = buffer.toString('utf-8')
        if (text.trim()) {
          docBlocks.push({
            type: 'text',
            text: `=== Documento: ${file.name} ===\n${text.trim()}`,
          })
        }
      }
    }

    if (!docBlocks.length) {
      return Response.json({ error: 'Nenhum conteúdo legível nos arquivos enviados.' }, { status: 400 })
    }

    // ── Prompt mestre ─────────────────────────────────────────────────────────
    const promptMestre = loadPromptMestre()

    const systemPrompt = `${promptMestre}

━━━ FORMATO DE SAÍDA OBRIGATÓRIO ━━━

Retorne SOMENTE um objeto JSON válido, sem markdown, sem texto antes ou depois.
Use aspas simples (') para citações internas — NUNCA aspas duplas dentro de valores string.

{
  "items": [
    {
      "id": 1,
      "criterio": "nome oficial do critério",
      "requisito": "ex: 9.1",
      "qualificador": "Obrigatório",
      "doc_codigo": "código do documento",
      "doc_versao": "versão/revisão ou '-'",
      "doc_nome": "nome completo do documento",
      "item_numero": "número da seção",
      "item_nome": "TÍTULO EXATO DA SEÇÃO",
      "subitem": "x.x.x - Nome do subitem ou '-'",
      "processo_auditado": "TRANSCRIÇÃO LITERAL VERBATIM do trecho do documento",
      "periodo": "Atual",
      "evidencia": "descrição objetiva e específica do documento/evidência esperada",
      "metodologia": "Verificar, por meio de [instrumento], se [condição verificada]"
    }
  ]
}

REGRAS CRÍTICAS:
- "processo_auditado" DEVE ser transcrição verbatim (palavra por palavra) do documento — NUNCA parafrasear
- Gere quantas linhas forem necessárias — não há limite de 22 itens
- Extraia TODOS os trechos auditáveis relevantes para o critério ${criterio}
- Não toque nas colunas Q em diante (etapa de conformidade)`

    const userMessage = `Critério OEA selecionado: ${criterio}
Cliente: ${cliente}

Analise os documentos abaixo e preencha o checklist de auditoria conforme as instruções.
Extraia TODOS os itens auditáveis relevantes para o critério "${criterio}".`

    // ── Chamada à API do Claude ───────────────────────────────────────────────
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

    const message = await client.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 16000,
      system:     systemPrompt,
      messages: [{
        role:    'user',
        content: [
          { type: 'text', text: userMessage },
          ...docBlocks,
        ],
      }],
    })

    const rawText = message.content
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('')

    if (message.stop_reason === 'max_tokens') {
      console.warn('[checklist/generate] resposta cortada por max_tokens')
    }

    // ── Parse do JSON retornado pela IA ───────────────────────────────────────
    let parsed: { items: ChecklistItem[] } | undefined
    const tryParse = (s: string) => { parsed = JSON.parse(s); return true }

    const fenceMatch = rawText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
    const jsonStr    = fenceMatch
      ? fenceMatch[1].trim()
      : (() => {
          const a = rawText.indexOf('{')
          const b = rawText.lastIndexOf('}')
          return a !== -1 && b > a ? rawText.slice(a, b + 1) : rawText.trim()
        })()

    let parseOk = false
    for (const attempt of [
      () => tryParse(jsonStr),
      () => tryParse(jsonStr.replace(/,\s*([}\]])/g, '$1')),
    ]) {
      try { parseOk = attempt(); break } catch { /* continue */ }
    }

    if (!parseOk || !parsed?.items?.length) {
      console.error('[checklist/generate] parse falhou. Raw:', rawText.slice(0, 500))
      return Response.json({ error: 'A IA não retornou um checklist válido. Tente reformular os documentos ou tente novamente.' }, { status: 500 })
    }

    const items = parsed.items.map((it, i) => ({ ...it, id: i + 1 }))

    // ── Preenche o template Excel ──────────────────────────────────────────────
    const templateBuffer = loadTemplate()
    const xlsxBytes      = await fillTemplate(templateBuffer, items)
    const filename       = buildFilename(cliente, criterio)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new Response(xlsxBytes as any, {
      headers: {
        'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}.xlsx"`,
        'Content-Length':      String(xlsxBytes.byteLength),
        'X-Filename':          `${filename}.xlsx`,
        'X-Items-Count':       String(items.length),
      },
    })
  } catch (err) {
    console.error('[checklist/generate]', err)
    return Response.json(
      { error: err instanceof Error ? err.message : 'Erro interno.' },
      { status: 500 }
    )
  }
}
