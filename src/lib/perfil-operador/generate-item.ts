import * as fs from 'fs'
import * as path from 'path'
import Anthropic from '@anthropic-ai/sdk'
import { PerfilOperadorDocument, PerfilOperadorItem } from '@/types/perfil-operador'

function loadDataFile(...segments: string[]): string {
  const p = path.join(process.cwd(), 'data', 'perfil_operador', ...segments)
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf-8') : ''
}

const MASTER_PROMPT     = loadDataFile('prompt_perfil_operador.txt')
const STYLE_REFERENCE   = loadDataFile('estilo_referencia.txt')

/**
 * Respostas reais do Perfil do Operador da VL Cargo, indexadas pelo número oficial
 * do item (ex.: "5.1") — extraídas uma única vez de "Perfil Operador - VL CARGO
 * rev 29Jul2026.docx". A numeração do Perfil do Operador é padronizada pelo Anexo II
 * do Programa OEA, então o item "5.1" da VL Cargo é o MESMO item oficial que o "5.1"
 * de qualquer outro cliente — por isso serve como calibre real de escopo/tamanho
 * para o item correspondente, não apenas um exemplo genérico de estilo.
 * Cobre os critérios 2 a 14 (135 itens); fora desse intervalo cai no excerto genérico.
 */
const VL_CARGO_POR_ITEM: Record<string, string> =
  JSON.parse(loadDataFile('vl_cargo_por_item.json') || '{}')

export interface GenerateItemResult {
  resposta:   string
  pendencias: string[]
}

/**
 * Retry para overloaded_error (HTTP 529) da Anthropic — mesma técnica validada em
 * /api/checklist/generate: backoff linear de 10s/20s, até 2 tentativas extras.
 */
async function callWithRetry<T>(fn: () => Promise<T>, label: string, maxRetries = 2): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const isOverloaded = (err as any)?.status === 529
        || (err instanceof Error && err.message.toLowerCase().includes('overloaded'))
      if (isOverloaded && attempt < maxRetries) {
        const waitMs = (attempt + 1) * 10_000
        console.warn(`[perfil-operador] ${label} overloaded (tentativa ${attempt + 1}/${maxRetries}) — retry em ${waitMs / 1_000}s`)
        await new Promise(r => setTimeout(r, waitMs))
        continue
      }
      throw err
    }
  }
  throw new Error('unreachable')
}

/** Converte erros técnicos da Anthropic API em mensagens legíveis — mesma lógica de /api/checklist/generate */
export function humanizeApiError(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as { error?: { type?: string; message?: string } }
    switch (parsed?.error?.type) {
      case 'overloaded_error': return 'Os servidores de IA estão sobrecarregados no momento. Aguarde alguns minutos e tente novamente.'
      case 'rate_limit_error': return 'Limite de requisições atingido. Aguarde alguns minutos e tente novamente.'
      default: return `Erro na IA: ${parsed?.error?.message ?? raw}. Tente novamente.`
    }
  } catch { /* não é JSON — usa heurística de texto */ }
  if (raw.toLowerCase().includes('overloaded'))  return 'Os servidores de IA estão sobrecarregados no momento. Aguarde alguns minutos e tente novamente.'
  if (raw.toLowerCase().includes('rate limit'))  return 'Limite de requisições atingido. Aguarde alguns minutos e tente novamente.'
  return `Erro ao processar com a IA: ${raw}. Tente novamente.`
}

function parseResult(rawText: string): GenerateItemResult | null {
  const fence = rawText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
  const js    = fence
    ? fence[1].trim()
    : (() => { const a = rawText.indexOf('{'); const b = rawText.lastIndexOf('}'); return a !== -1 && b > a ? rawText.slice(a, b + 1) : rawText.trim() })()
  for (const s of [js, js.replace(/,\s*([}\]])/g, '$1')]) {
    try {
      const parsed = JSON.parse(s) as { resposta?: string; pendencias?: string[] }
      if (typeof parsed.resposta === 'string') {
        return { resposta: parsed.resposta, pendencias: Array.isArray(parsed.pendencias) ? parsed.pendencias : [] }
      }
    } catch { /* tenta a próxima variante */ }
  }
  return null
}

/**
 * Gera (ou regera) a resposta de UM item do Perfil do Operador, usando somente os
 * documentos vinculados a ele. Lança erro em caso de falha na chamada à API —
 * quem chama decide como tratar (SSE em lote vs. endpoint síncrono de regeração).
 */
export async function generateItemAnswer(
  client:     Anthropic,
  cliente:    string,
  item:       Pick<PerfilOperadorItem, 'criteria_name' | 'item_number' | 'item_description'>,
  documents:  Pick<PerfilOperadorDocument, 'tipo' | 'filename' | 'content_text'>[],
  instruction?: string,
): Promise<GenerateItemResult> {
  const politicas  = documents.filter(d => d.tipo === 'politica'  && d.content_text)
  const evidencias = documents.filter(d => d.tipo === 'evidencia' && d.content_text)

  const docsBlock = [
    politicas.length
      ? `━━━ POLÍTICAS, PROCEDIMENTOS E INSTRUÇÕES DE TRABALHO VINCULADAS A ESTE ITEM ━━━\n\n` +
        politicas.map(d => `=== Documento: ${d.filename} ===\n${d.content_text}`).join('\n\n')
      : '━━━ POLÍTICAS, PROCEDIMENTOS E INSTRUÇÕES DE TRABALHO VINCULADAS A ESTE ITEM ━━━\n\n(nenhum documento deste tipo foi vinculado a este item)',
    evidencias.length
      ? `━━━ EVIDÊNCIAS VINCULADAS A ESTE ITEM ━━━\n\n` +
        evidencias.map(d => `=== Documento: ${d.filename} ===\n${d.content_text}`).join('\n\n')
      : '━━━ EVIDÊNCIAS VINCULADAS A ESTE ITEM ━━━\n\n(nenhum documento deste tipo foi vinculado a este item)',
  ].join('\n\n')

  // Fica no system prompt (cacheado) só o que é 100% igual em toda chamada — o exemplo
  // específico do item vai na mensagem do usuário, que já varia por chamada mesmo assim.
  const systemPrompt = `${MASTER_PROMPT}

━━━ EXCERTO DE REFERÊNCIA DE ESTILO GENÉRICO (uso restrito — ver regras acima) ━━━

${STYLE_REFERENCE}`

  const itemReference = VL_CARGO_POR_ITEM[item.item_number]
  const referenceBlock = itemReference
    ? `━━━ REFERÊNCIA DE ESCOPO PARA ESTE MESMO ITEM (item ${item.item_number} de outro cliente, mesmo número oficial do Anexo II) ━━━

⚠️ Use isto SOMENTE para calibrar TAMANHO e NÍVEL DE DETALHE da sua resposta a este item
específico — jamais copie ou mencione qualquer fato, nome, sistema ou procedimento daqui.

${itemReference}`
    : ''

  const userMessage = `Cliente: ${cliente}
Critério OEA: ${item.criteria_name}
Item ${item.item_number}: ${item.item_description}

${docsBlock}${referenceBlock ? `\n\n${referenceBlock}` : ''}${instruction?.trim() ? `\n\n━━━ INSTRUÇÃO ADICIONAL DO COLABORADOR PARA ESTA REGERAÇÃO ━━━\n\n${instruction.trim()}` : ''}

Redija a resposta institucional para este item, seguindo todas as regras do prompt mestre.
${itemReference ? 'Antes de finalizar, compare o escopo e o tamanho da sua resposta com a referência deste mesmo item acima — não a ultrapasse em detalhamento sem necessidade real.' : ''}
Retorne SOMENTE o objeto JSON no formato especificado.`

  const msg = await callWithRetry(
    () => client.messages.stream({
      model:      'claude-sonnet-4-6',
      max_tokens: 4_000,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }] as any,
      messages: [{ role: 'user', content: userMessage }],
    }).finalMessage(),
    `item ${item.item_number}`,
  )

  const raw = msg.content.filter(b => b.type === 'text').map(b => (b as { type: 'text'; text: string }).text).join('')
  const parsed = parseResult(raw)

  if (!parsed) {
    console.error(`[perfil-operador] parse falhou para item ${item.item_number} — raw(300):`, raw.slice(0, 300))
    throw new Error('A IA não retornou uma resposta em formato válido.')
  }

  return parsed
}
