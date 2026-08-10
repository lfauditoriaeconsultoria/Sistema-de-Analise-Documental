import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import * as fs from 'fs'
import * as path from 'path'
import ExcelJS from 'exceljs'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const mammoth = require('mammoth') as typeof import('mammoth')

export const maxDuration = 300

/* ── Colunas da planilha (1-indexed) ──────────────────────────────────────── */
const COL = {
  ID:          1,   // A
  DATA_AUD:    2,   // B — manual, não tocado
  AUDITOR:     3,   // C — manual, não tocado
  CRITERIO:    4,   // D
  REQUISITO:   5,   // E
  QUALIF:      6,   // F
  DOC_COD:     7,   // G
  DOC_VER:     8,   // H
  DOC_NOME:    9,   // I
  ITEM_NUM:    10,  // J
  ITEM_NOME:   11,  // K
  SUBITEM:     12,  // L
  PROCESSO:    13,  // M
  PERIODO:     14,  // N
  EVIDENCIA:   15,  // O
  METODOLOGIA: 16,  // P
  SIM:         17,  // Q — Atendimento: Sim
  NAO:         18,  // R — Atendimento: Não
  NA:          19,  // S — Atendimento: N/A
  NV:          20,  // T — Atendimento: N/V
  // U (21) = Pendências auditoria anterior — NÃO TOCAR
  // V (22) = Pendências backlog — NÃO TOCAR
  DOCS_APRES:  23,  // W — Documentos Apresentados
  CONSTATACAO: 24,  // X — Constatação
  NAO_CONF:    25,  // Y — Não conformidades
  RECOMEND:    26,  // Z — Recomendações de melhoria
  REQ_NA:      27,  // AA — Requisitos não aplicáveis
} as const

/* ── Tipos ──────────────────────────────────────────────────────────────────── */
interface ChecklistRow {
  row_num:     number
  id:          number
  criterio:    string
  requisito:   string
  qualificador: string
  doc_codigo:  string
  doc_versao:  string
  doc_nome:    string
  item_numero: string
  item_nome:   string
  subitem:     string
  processo:    string
  periodo:     string
  evidencia:   string
  metodologia: string
}

export interface ValidationError {
  row: number
  id:  number
  field: string
  message: string
}

interface EvaluationResult {
  id:                      number
  atendimento:             'Sim' | 'Não' | 'N/A' | 'N/V'
  documentos_apresentados: string
  constatacao:             string
  nao_conformidades:       string
  recomendacoes:           string
  requisitos_na:           string
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */
function loadPromptValidacao(): string {
  const p = path.join(process.cwd(), 'data', 'validacao_evidencias', 'prompt_validacao.txt')
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf-8') : ''
}

function getCellText(row: ExcelJS.Row, col: number): string {
  const cell = row.getCell(col)
  const v = cell.value
  if (v === null || v === undefined) return ''
  // Rich text
  if (typeof v === 'object' && 'richText' in v) {
    return (v as ExcelJS.CellRichTextValue).richText.map(rt => rt.text).join('')
  }
  // Formula result
  if (typeof v === 'object' && 'result' in v) {
    return String((v as ExcelJS.CellFormulaValue).result ?? '')
  }
  return String(v).trim()
}

/* ── Extrai linhas de dados do XLSX (a partir da linha 3) ─────────────────── */
function extractRows(ws: ExcelJS.Worksheet): ChecklistRow[] {
  const rows: ChecklistRow[] = []
  ws.eachRow((row, rowNum) => {
    if (rowNum < 3) return
    const idRaw = getCellText(row, COL.ID)
    if (!idRaw.trim()) return
    const id = Number(idRaw)
    if (isNaN(id)) return

    rows.push({
      row_num:     rowNum,
      id,
      criterio:    getCellText(row, COL.CRITERIO),
      requisito:   getCellText(row, COL.REQUISITO),
      qualificador: getCellText(row, COL.QUALIF),
      doc_codigo:  getCellText(row, COL.DOC_COD),
      doc_versao:  getCellText(row, COL.DOC_VER),
      doc_nome:    getCellText(row, COL.DOC_NOME),
      item_numero: getCellText(row, COL.ITEM_NUM),
      item_nome:   getCellText(row, COL.ITEM_NOME),
      subitem:     getCellText(row, COL.SUBITEM),
      processo:    getCellText(row, COL.PROCESSO),
      periodo:     getCellText(row, COL.PERIODO),
      evidencia:   getCellText(row, COL.EVIDENCIA),
      metodologia: getCellText(row, COL.METODOLOGIA),
    })
  })
  return rows
}

/* ── Valida campos obrigatórios para execução da Etapa 2 ─────────────────── */
function validateRows(rows: ChecklistRow[]): ValidationError[] {
  const errors: ValidationError[] = []

  if (rows.length === 0) {
    errors.push({ row: 0, id: 0, field: 'Geral', message: 'A planilha não contém itens de checklist (nenhuma linha de dados encontrada a partir da linha 3).' })
    return errors
  }

  for (const row of rows) {
    const mandatory: [string, string][] = [
      ['D (Critério OEA)',        row.criterio],
      ['E (Requisito)',           row.requisito],
      ['F (Qualificador)',        row.qualificador],
      ['O (Evidência Esperada)',  row.evidencia],
      ['P (Metodologia)',         row.metodologia],
    ]

    for (const [label, value] of mandatory) {
      if (!value.trim() || value.trim() === '-') {
        errors.push({
          row: row.row_num,
          id:  row.id,
          field: label,
          message: `Linha ${row.row_num} (item ${row.id}): coluna ${label} está vazia.`,
        })
      }
    }

    // Processo Auditado deve ter conteúdo substantivo (transcrição verbatim)
    if (!row.processo.trim() || row.processo.trim().length < 20) {
      errors.push({
        row: row.row_num,
        id:  row.id,
        field: 'M (Processo Auditado)',
        message: `Linha ${row.row_num} (item ${row.id}): coluna M (Processo Auditado) está vazia ou muito curta — deve conter a transcrição verbatim do procedimento.`,
      })
    }
  }

  return errors
}

/* ── Formata o checklist como texto estruturado para o Claude ─────────────── */
function buildChecklistContext(rows: ChecklistRow[]): string {
  const criterio = rows[0]?.criterio ?? 'N/D'
  const header   = `CHECKLIST DE AUDITORIA — COLUNAS A–P\nCritério OEA: ${criterio}\nTotal de itens: ${rows.length}\n\n`

  const items = rows.map(r => {
    return [
      `--- ITEM ${r.id} (linha ${r.row_num}) ---`,
      `Critério:         ${r.criterio}`,
      `Requisito:        ${r.requisito}`,
      `Qualificador:     ${r.qualificador}`,
      `Documento:        ${[r.doc_codigo, r.doc_versao, r.doc_nome].filter(Boolean).join(' | ') || 'N/D'}`,
      `Seção/Item:       ${[r.item_numero, r.item_nome].filter(Boolean).join(' — ') || 'N/D'}`,
      r.subitem ? `Subitem:          ${r.subitem}` : null,
      `Processo Auditado:\n${r.processo}`,
      `Período:          ${r.periodo}`,
      `Evidência Esperada:\n${r.evidencia}`,
      `Metodologia:\n${r.metodologia}`,
    ].filter(Boolean).join('\n')
  }).join('\n\n')

  return header + items
}

/* ── Preenche resultados no XLSX preservando a formatação original ─────────── */
async function writeResults(
  xlsxBuffer: Buffer,
  results: EvaluationResult[],
): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await wb.xlsx.load(xlsxBuffer as any)
  const ws = wb.worksheets[0]

  const resultMap = new Map<number, EvaluationResult>()
  for (const r of results) resultMap.set(r.id, r)

  const atendMap: Record<string, number> = {
    'Sim': COL.SIM,
    'Não': COL.NAO,
    'N/A': COL.NA,
    'N/V': COL.NV,
  }

  ws.eachRow((row, rowNum) => {
    if (rowNum < 3) return
    const idRaw = getCellText(row, COL.ID)
    if (!idRaw.trim()) return
    const id = Number(idRaw)
    if (isNaN(id)) return

    const result = resultMap.get(id)
    if (!result) return

    // Limpa marcações de atendimento anteriores (Q-T)
    for (const col of [COL.SIM, COL.NAO, COL.NA, COL.NV]) {
      row.getCell(col).value = null
    }

    // Marca a coluna correta com "X"
    const atendCol = atendMap[result.atendimento]
    if (atendCol) row.getCell(atendCol).value = 'X'

    // Preenche W-AA
    const setCell = (col: number, value: string) => {
      const cell = row.getCell(col)
      cell.value = value.trim() || null
      // Garante quebra de texto automática nas colunas preenchidas
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const existing = (cell.alignment ?? {}) as any
      cell.alignment = { ...existing, wrapText: true, vertical: 'top' }
    }

    setCell(COL.DOCS_APRES,  result.documentos_apresentados)
    setCell(COL.CONSTATACAO, result.constatacao)
    // Y e Z: quando não houver conteúdo, preencher com "N/A" em vez de deixar vazio
    setCell(COL.NAO_CONF, result.nao_conformidades?.trim() || 'N/A')
    setCell(COL.RECOMEND, result.recomendacoes?.trim()    || 'N/A')
    setCell(COL.REQ_NA,   result.requisitos_na)

    row.commit()
  })

  const buf = await wb.xlsx.writeBuffer()
  return new Uint8Array(buf instanceof Buffer ? buf : Buffer.from(buf))
}

/* ── Gera o nome do arquivo de saída a partir do original ─────────────────── */
function buildOutputFilename(originalName: string): string {
  const base = originalName.replace(/\.xlsx$/i, '')
  return `${base} - PREENCHIDA`
}

/* ── Tenta extrair o nome do cliente a partir do nome do arquivo ──────────── */
function extractCliente(filename: string): string {
  // Padrão gerado pela Etapa 1: "Monitoramento OEA - {CLIENTE} - Checklist de Auditoria.xlsx"
  const match = filename.match(/^Monitoramento OEA - (.+?) - Checklist de Auditoria/i)
  return match?.[1]?.trim() ?? ''
}

/* ── Handler principal ── */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()

    // ── 1. Recebe a planilha e os arquivos de evidência ────────────────────
    const xlsxFile  = formData.get('xlsx') as File | null
    const evFiles   = formData.getAll('evidencias') as File[]

    if (!xlsxFile) {
      return Response.json({ error: 'Envie a planilha de checklist (formato .xlsx).' }, { status: 400 })
    }
    if (!xlsxFile.name.toLowerCase().endsWith('.xlsx')) {
      return Response.json({ error: 'A planilha deve estar no formato .xlsx.' }, { status: 400 })
    }

    // ── 2. Lê o XLSX com ExcelJS ──────────────────────────────────────────
    const xlsxBuffer = Buffer.from(await xlsxFile.arrayBuffer())
    const wb = new ExcelJS.Workbook()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await wb.xlsx.load(xlsxBuffer as any)
    const ws = wb.worksheets[0]

    if (!ws) {
      return Response.json({ error: 'A planilha enviada não contém abas válidas.' }, { status: 400 })
    }

    // ── 3. Extrai e valida as linhas de dados ─────────────────────────────
    const rows   = extractRows(ws)
    const valErr = validateRows(rows)

    if (valErr.length > 0) {
      return Response.json({ validationErrors: valErr }, { status: 422 })
    }

    // ── 4. Processa os arquivos de evidência ──────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const evidenceBlocks: any[] = []
    let totalSize = xlsxFile.size

    for (const file of evFiles) {
      if (file.size > 20 * 1024 * 1024) {
        return Response.json({ error: `Arquivo "${file.name}" ultrapassa 20 MB.` }, { status: 413 })
      }
      totalSize += file.size
      if (totalSize > 100 * 1024 * 1024) {
        return Response.json({ error: 'Tamanho total dos arquivos ultrapassa 100 MB.' }, { status: 413 })
      }

      const buffer = Buffer.from(await file.arrayBuffer())
      const ext    = file.name.split('.').pop()?.toLowerCase() ?? ''

      if (ext === 'pdf') {
        evidenceBlocks.push({
          type:  'document',
          source: { type: 'base64', media_type: 'application/pdf', data: buffer.toString('base64') },
          title: file.name,
        })
      } else if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
        const mimeMap: Record<string, string> = {
          jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
          gif: 'image/gif',  webp: 'image/webp',
        }
        evidenceBlocks.push({
          type:   'image',
          source: { type: 'base64', media_type: mimeMap[ext], data: buffer.toString('base64') },
        })
        // Adiciona rótulo de nome após a imagem
        evidenceBlocks.push({ type: 'text', text: `[Imagem acima: ${file.name}]` })
      } else if (['docx', 'doc'].includes(ext)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await mammoth.extractRawText({ buffer: buffer as any })
        if (result.value.trim()) {
          evidenceBlocks.push({
            type: 'text',
            text: `=== Evidência: ${file.name} ===\n${result.value.trim()}`,
          })
        }
      } else if (['txt', 'md', 'csv'].includes(ext)) {
        const text = buffer.toString('utf-8')
        if (text.trim()) {
          evidenceBlocks.push({
            type: 'text',
            text: `=== Evidência: ${file.name} ===\n${text.trim()}`,
          })
        }
      }
      // Outros formatos são ignorados silenciosamente
    }

    // ── 5. Monta prompt e chama o Claude ──────────────────────────────────
    const promptBase       = loadPromptValidacao()
    const checklistContext = buildChecklistContext(rows)

    const systemPrompt = `${promptBase}

━━━ FORMATO DE SAÍDA OBRIGATÓRIO ━━━

Retorne SOMENTE um objeto JSON válido, sem markdown, sem texto antes ou depois.
Use aspas simples (') para citações internas — NUNCA aspas duplas dentro de valores string.

{
  "items": [
    {
      "id": 1,
      "atendimento": "Sim|Não|N/A|N/V",
      "documentos_apresentados": "lista dos documentos/evidências recebidos para este item",
      "constatacao": "narrativa objetiva do que foi observado nas evidências, à luz do requisito",
      "nao_conformidades": "descrição da NC quando atendimento = Não — use 'N/A' se não houver NC",
      "recomendacoes": "sugestão prática de melhoria — use 'N/A' se não houver recomendação a fazer",
      "requisitos_na": "justificativa de N/A — deixar em branco se não for N/A"
    }
  ]
}

REGRAS CRÍTICAS:
- Avalie TODOS os ${rows.length} itens do checklist — o array "items" deve ter exatamente ${rows.length} elementos.
- "atendimento" deve ser exatamente uma das strings: "Sim", "Não", "N/A" ou "N/V".
- "nao_conformidades" só deve ser preenchida quando atendimento = "Não".
- "requisitos_na" só deve ser preenchida quando atendimento = "N/A".
- "documentos_apresentados" e "constatacao" devem sempre ser preenchidas.
- Nunca invente evidências — baseie-se apenas nos arquivos enviados.
- Se não houver evidência para um item, classifique como "N/V" e explique na constatação.`

    const userMessage = `Analise as evidências enviadas e avalie cada item do checklist abaixo conforme as instruções do prompt.

${checklistContext}`

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userContent: any[] = [
      { type: 'text', text: userMessage },
    ]

    if (evidenceBlocks.length > 0) {
      userContent.push({ type: 'text', text: `\n━━━ EVIDÊNCIAS ENVIADAS (${evFiles.length} arquivo(s)) ━━━\n` })
      userContent.push(...evidenceBlocks)
    } else {
      userContent.push({
        type: 'text',
        text: '\n[Nenhum arquivo de evidência foi enviado. Classifique todos os itens como N/V e explique a ausência de evidências na constatação.]',
      })
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

    const message = await client.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 16000,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }] as any,
      messages: [{ role: 'user', content: userContent }],
    })

    console.log(
      '[checklist/evaluate] cache_write:', message.usage?.cache_creation_input_tokens ?? 0,
      '| cache_read:', message.usage?.cache_read_input_tokens ?? 0,
      '| input:', message.usage?.input_tokens,
      '| output:', message.usage?.output_tokens,
    )

    if (message.stop_reason === 'max_tokens') {
      console.warn('[checklist/evaluate] resposta truncada por max_tokens')
    }

    // ── 6. Parse da resposta do Claude ───────────────────────────────────
    const rawText = message.content
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('')

    let parsed: { items: EvaluationResult[] } | undefined
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
      try { parseOk = attempt(); break } catch { /* continua */ }
    }

    if (!parseOk || !parsed?.items?.length) {
      console.error('[checklist/evaluate] parse falhou. Raw:', rawText.slice(0, 500))
      return Response.json(
        { error: 'A IA não retornou uma avaliação válida. Tente novamente.' },
        { status: 500 }
      )
    }

    // ── 7. Escreve os resultados no XLSX ──────────────────────────────────
    const xlsxBytes = await writeResults(xlsxBuffer, parsed.items)

    // ── 8. Monta o nome do arquivo de saída ───────────────────────────────
    const outputName      = buildOutputFilename(xlsxFile.name)
    const filenameXlsx    = `${outputName}.xlsx`
    const filenameAscii   = filenameXlsx.replace(/[^\x20-\x7E]/g, '_')
    const filenameEnc     = encodeURIComponent(filenameXlsx)

    // Estatísticas para o frontend e histórico
    const stats = {
      total: parsed.items.length,
      sim:   parsed.items.filter(i => i.atendimento === 'Sim').length,
      nao:   parsed.items.filter(i => i.atendimento === 'Não').length,
      na:    parsed.items.filter(i => i.atendimento === 'N/A').length,
      nv:    parsed.items.filter(i => i.atendimento === 'N/V').length,
    }

    // ── 9. Salva no histórico (best-effort — falha não interrompe o download) ─
    try {
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        const admin      = createAdminClient()
        const evalId     = crypto.randomUUID()
        const filePath   = `${user.id}/${evalId}.xlsx`
        const cliente    = extractCliente(xlsxFile.name)
        const criterio   = rows[0]?.criterio ?? ''

        const { error: uploadError } = await admin.storage
          .from('evaluations')
          .upload(filePath, Buffer.from(xlsxBytes), {
            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          })

        if (uploadError) {
          console.warn('[checklist/evaluate] upload storage falhou:', uploadError.message)
        } else {
          await admin.from('evaluate_history').insert({
            id:          evalId,
            user_id:     user.id,
            criterio,
            cliente,
            filename:    filenameXlsx,
            items_count: stats.total,
            nc_count:    stats.nao,
            file_path:   filePath,
          })
          console.log('[checklist/evaluate] salvo no histórico:', evalId)
        }
      }
    } catch (histErr) {
      console.warn('[checklist/evaluate] falha ao salvar histórico:', histErr)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new Response(xlsxBytes as any, {
      headers: {
        'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filenameAscii}"; filename*=UTF-8''${filenameEnc}`,
        'Content-Length':      String(xlsxBytes.byteLength),
        'X-Filename':          filenameEnc,
        'X-Stats':             encodeURIComponent(JSON.stringify(stats)),
      },
    })
  } catch (err) {
    console.error('[checklist/evaluate]', err)
    return Response.json(
      { error: err instanceof Error ? err.message : 'Erro interno.' },
      { status: 500 }
    )
  }
}
