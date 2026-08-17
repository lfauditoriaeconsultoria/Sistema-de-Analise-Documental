import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import * as fs from 'fs'
import * as path from 'path'
import ExcelJS from 'exceljs'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
// mammoth não tem types default export — usar require
// eslint-disable-next-line @typescript-eslint/no-require-imports
const mammoth = require('mammoth') as typeof import('mammoth')

export const maxDuration = 300

function buildFilename(cliente: string): string {
  // Remove caracteres inválidos em nomes de arquivo (Windows/Mac/Linux)
  const safe = (s: string) => s.replace(/[/\\:*?"<>|]/g, '-').trim()
  return safe(`Monitoramento OEA - ${cliente} - Checklist de Auditoria`)
}

/* ── Lê os arquivos de configuração da pasta data/ (dentro do projeto) ── */
function loadPromptMestre(): string {
  const p = path.join(process.cwd(), 'data', 'prompt_mestre.txt')
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf-8') : ''
}

function loadTemplate(): Buffer {
  const p = path.join(process.cwd(), 'data', 'template_checklist.xlsx')
  return fs.readFileSync(p)
}

/* ── Tipos locais para dados de critérios do banco ── */
interface OeaItemRow {
  item_number: string
  description: string
  qualificador: string
}
interface OeaCriteriaRow {
  number: number
  name: string
  description: string | null
  items: OeaItemRow[]
}

/**
 * Formata os dados do critério OEA como texto estruturado para o Claude.
 * Substitui o Anexo II PDF — muito mais barato em tokens (~500–2.000 vs 8.000–15.000).
 * Inclui qualificador (Obrigatório/Recomendável) diretamente do banco.
 */
function buildCriteriaContext(criteria: OeaCriteriaRow): string {
  const sorted = [...(criteria.items ?? [])].sort((a, b) => {
    const toNum = (s: string) => {
      const parts = s.split('.').map(Number)
      return parts[0] * 1000 + (parts[1] ?? 0)
    }
    return toNum(a.item_number) - toNum(b.item_number)
  })

  const lines = sorted
    .map(item => `• ${item.item_number} [${item.qualificador}] — ${item.description}`)
    .join('\n')

  return [
    `CRITÉRIO OEA Nº ${criteria.number} — ${criteria.name}`,
    criteria.description ?? '',
    '',
    'Requisitos oficiais do Programa OEA para este critério (número, qualificador e descrição):',
    lines,
  ].join('\n').trim()
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

    // Linhas a partir da 24 (última do template tem estilo de fechamento diferente,
    // e linhas acima dela não existem no template) — clona estilo da linha 3.
    // Bug anterior: condição ">24" excluía exatamente o row 24, deixando-o sem estilo.
    if (rowNum >= 24) {
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

    // Garante quebra automática de texto em todas as colunas de conteúdo (D–P).
    // Necessário porque escrever .value pode não preservar wrapText do template
    // em algumas versões do ExcelJS.
    for (let col = 4; col <= 16; col++) {
      const cell = row.getCell(col)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const existing = (cell.alignment ?? {}) as any
      cell.alignment = { ...existing, wrapText: true, vertical: 'top' }
    }

    row.commit()
  })

  // writeBuffer() retorna Buffer/ArrayBuffer — normaliza para Uint8Array (BodyInit compatível)
  const buf = await wb.xlsx.writeBuffer()
  return new Uint8Array(buf instanceof Buffer ? buf : Buffer.from(buf))
}

/* ── Handler principal ── */
export async function POST(req: NextRequest) {
  // ── Validação e leitura do body ANTES de abrir o stream ──────────────────
  // (o body só pode ser lido uma vez; deve acontecer aqui, fora do ReadableStream)
  const formData = await req.formData()
  const criteriosRaw = formData.getAll('criterios') as string[]
  const criterioLeg  = (formData.get('criterio') as string | null)?.trim()
  const criterios    = criteriosRaw.length > 0 ? criteriosRaw.map(s => s.trim()).filter(Boolean)
                     : criterioLeg ? [criterioLeg] : []
  const cliente  = (formData.get('cliente') as string | null)?.trim()
  const files    = formData.getAll('files') as File[]

  if (!criterios.length) return Response.json({ error: 'Selecione ao menos um critério OEA.' }, { status: 400 })
  if (!cliente)  return Response.json({ error: 'Informe o nome do cliente.' }, { status: 400 })
  if (!files.length) return Response.json({ error: 'Envie ao menos um documento.' }, { status: 400 })

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
        docBlocks.push({ type: 'text', text: `=== Documento: ${file.name} ===\n${result.value.trim()}` })
      }
    } else if (['txt', 'md', 'csv'].includes(ext)) {
      const text = buffer.toString('utf-8')
      if (text.trim()) {
        docBlocks.push({ type: 'text', text: `=== Documento: ${file.name} ===\n${text.trim()}` })
      }
    }
  }

  if (!docBlocks.length) {
    return Response.json({ error: 'Nenhum conteúdo legível nos arquivos enviados.' }, { status: 400 })
  }

  // ── Resposta SSE — evita 504 mantendo a conexão viva durante o processamento ──
  // O Vercel/proxy fecha a conexão se nenhum byte é enviado por ~30 s.
  // Com SSE a primeira byte é enviada imediatamente e pings periódicos
  // mantêm o keep-alive enquanto o Claude processa.
  const enc = new TextEncoder()
  const sseStream = new ReadableStream({
    async start(ctrl) {
      const send = (data: object) => {
        try { ctrl.enqueue(enc.encode(`data: ${JSON.stringify(data)}\n\n`)) } catch { /* já fechado */ }
      }

      // Ping a cada 20 s para manter conexão viva
      const pingId = setInterval(() => send({ type: 'ping' }), 20_000)

      try {
        // ── Critérios OEA ─────────────────────────────────────────────────────
        send({ type: 'progress', message: 'Buscando critérios OEA...' })
        let criteriaContexts: string[] = []
        try {
          const admin = createAdminClient()
          const { data: criteriaRows, error } = await admin
            .from('oea_criteria')
            .select('number, name, description, items:oea_items(item_number, description, qualificador)')
            .in('name', criterios)
            .order('number', { ascending: true })

          if (error) {
            console.warn('[checklist/generate] erro ao buscar critérios:', error.message)
          } else if (criteriaRows?.length) {
            criteriaContexts = criteriaRows.map(row => buildCriteriaContext(row as OeaCriteriaRow))
            console.log('[checklist/generate] critérios:', criteriaRows.map(r => `${r.number}. ${r.name}`).join(', '))
          }
        } catch (dbErr) {
          console.warn('[checklist/generate] falha ao consultar banco:', dbErr)
        }

        const criteriosLabel = criterios.join(', ')
        const promptMestre   = loadPromptMestre()

        const normativaSection = criteriaContexts.length > 0
          ? `━━━ REFERÊNCIA NORMATIVA ━━━

Os requisitos oficiais dos critérios selecionados foram extraídos do banco de dados do sistema.
Use estas listas como fonte DEFINITIVA para as colunas E (requisito) e F (qualificador).

Cada linha tem o formato:
  • NÚMERO [QUALIFICADOR] — descrição do requisito

Regras:
- "criterio" (coluna D): use exatamente o nome do critério ao qual o item pertence.
- "requisito" (coluna E): use exatamente o NÚMERO do item (ex: 5.1, 5.3).
- "qualificador" (coluna F): copie exatamente o valor entre colchetes — "Obrigatório" ou "Recomendável".
- NUNCA repita o mesmo número de requisito para todos os itens.

${criteriaContexts.join('\n\n━━━\n\n')}`
          : `━━━ REFERÊNCIA NORMATIVA ━━━

Use seu conhecimento do Programa OEA (Portaria Coana nº 154/2024) para identificar os requisitos
corretos de cada processo auditado. Os números VARIAM por item — nunca repita o mesmo requisito.
O qualificador ("Obrigatório" ou "Recomendável") segue a classificação oficial do programa.`

        const systemPrompt = `${promptMestre}

${normativaSection}

━━━ FORMATO DE SAÍDA OBRIGATÓRIO ━━━

Retorne SOMENTE um objeto JSON válido, sem markdown, sem texto antes ou depois.
Use aspas simples (') para citações internas — NUNCA aspas duplas dentro de valores string.

{
  "items": [
    {
      "id": 1,
      "criterio": "nome oficial do critério OEA ao qual este item pertence",
      "requisito": "número do requisito para este item (ex: 5.1, 5.3, 6.2) — VARIA por item",
      "qualificador": "Obrigatório ou Recomendável — conforme classificação no Programa OEA",
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
- "requisito" DEVE variar entre os itens — mapeie cada processo ao seu requisito correto
- "criterio" DEVE indicar corretamente a qual critério o item pertence
- Gere quantas linhas forem necessárias — não há limite
- Extraia TODOS os trechos auditáveis relevantes para os critérios: ${criteriosLabel}
- Não toque nas colunas Q em diante (etapa de conformidade)`

        const userMessage = `Critério(s) OEA selecionado(s): ${criteriosLabel}
Cliente: ${cliente}

Analise os documentos abaixo e preencha o checklist de auditoria conforme as instruções.
Para cada item, identifique o critério correto (coluna D), o requisito (coluna E) e o qualificador (coluna F).
Extraia TODOS os itens auditáveis relevantes para os critérios informados.`

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const userContent: any[] = [{ type: 'text', text: userMessage }, ...docBlocks]

        // ── Chamada ao Claude ─────────────────────────────────────────────────
        send({ type: 'progress', message: 'Analisando documentos com IA...' })
        const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

        const message = await client.messages.stream({
          model:      'claude-sonnet-4-6',
          max_tokens: 64000,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }] as any,
          messages: [{ role: 'user', content: userContent }],
        }).finalMessage()

        console.log(
          '[checklist/generate] stop_reason:', message.stop_reason,
          '| cache_write:', message.usage?.cache_creation_input_tokens ?? 0,
          '| cache_read:', message.usage?.cache_read_input_tokens ?? 0,
          '| input:', message.usage?.input_tokens,
          '| output:', message.usage?.output_tokens,
        )

        if (message.stop_reason === 'max_tokens') {
          console.error('[checklist/generate] resposta cortada por max_tokens')
          send({ type: 'error', message: 'O checklist gerado é muito extenso. Reduza a quantidade de documentos ou divida em lotes menores e tente novamente.' })
          clearInterval(pingId); ctrl.close(); return
        }

        const rawText = message.content
          .filter(b => b.type === 'text')
          .map(b => (b as { type: 'text'; text: string }).text)
          .join('')

        // ── Parse JSON ────────────────────────────────────────────────────────
        send({ type: 'progress', message: 'Gerando planilha...' })
        let parsed: { items: ChecklistItem[] } | undefined
        const tryParse = (s: string) => { parsed = JSON.parse(s); return true }

        const fenceMatch = rawText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
        const jsonStr    = fenceMatch
          ? fenceMatch[1].trim()
          : (() => { const a = rawText.indexOf('{'); const b = rawText.lastIndexOf('}'); return a !== -1 && b > a ? rawText.slice(a, b + 1) : rawText.trim() })()

        let parseOk = false
        for (const attempt of [
          () => tryParse(jsonStr),
          () => tryParse(jsonStr.replace(/,\s*([}\]])/g, '$1')),
        ]) {
          try { parseOk = attempt(); break } catch { /* continue */ }
        }

        if (!parseOk || !parsed?.items?.length) {
          console.error('[checklist/generate] parse falhou. Raw:', rawText.slice(0, 500))
          send({ type: 'error', message: 'A IA não retornou um checklist válido. Tente reformular os documentos ou tente novamente.' })
          clearInterval(pingId); ctrl.close(); return
        }

        const items       = parsed.items.map((it, i) => ({ ...it, id: i + 1 }))
        const templateBuf = loadTemplate()
        const xlsxBytes   = await fillTemplate(templateBuf, items)
        const filename    = buildFilename(cliente)
        const filenameXlsx = `${filename}.xlsx`

        // ── Histórico (best-effort) ───────────────────────────────────────────
        try {
          const supabase = await createClient()
          const { data: { user } } = await supabase.auth.getUser()
          if (user) {
            const admin       = createAdminClient()
            const checklistId = crypto.randomUUID()
            const filePath    = `${user.id}/${checklistId}.xlsx`
            const { error: uploadErr } = await admin.storage
              .from('checklists')
              .upload(filePath, Buffer.from(xlsxBytes), {
                contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
              })
            if (!uploadErr) {
              await admin.from('checklist_history').insert({
                id: checklistId, user_id: user.id, cliente,
                criterio: criteriosLabel, filename: filenameXlsx,
                items_count: items.length, file_path: filePath,
              })
              console.log('[checklist/generate] salvo no histórico:', checklistId)
            }
          }
        } catch (histErr) {
          console.warn('[checklist/generate] falha ao salvar histórico:', histErr)
        }

        // ── Envia arquivo como base64 no evento final ─────────────────────────
        const base64 = Buffer.from(xlsxBytes).toString('base64')
        send({ type: 'done', filename: filenameXlsx, count: items.length, file: base64 })

      } catch (err) {
        console.error('[checklist/generate]', err)
        send({ type: 'error', message: err instanceof Error ? err.message : 'Erro interno.' })
      } finally {
        clearInterval(pingId)
        ctrl.close()
      }
    },
  })

  return new Response(sseStream, {
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection':    'keep-alive',
      'X-Accel-Buffering': 'no',   // desativa buffering no nginx/Vercel
    },
  })
}
