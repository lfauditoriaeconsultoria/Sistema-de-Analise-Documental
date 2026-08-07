import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import * as XLSX from 'xlsx'
import * as fs from 'fs'
import * as path from 'path'

export const maxDuration = 300

/**
 * Repara problemas comuns em JSON gerado por LLMs:
 * 1. Quebras de linha literais dentro de strings → \n
 * 2. Aspas duplas não escapadas dentro de strings → aspas simples
 *    Ex: "status como "em análise", "não aplicável"" → "status como 'em análise', 'não aplicável'"
 */
function repairJson(str: string): string {
  let result = ''
  let i = 0
  let inString = false
  let escaped = false

  while (i < str.length) {
    const ch = str[i]

    if (escaped) { result += ch; escaped = false; i++; continue }

    if (ch === '\\' && inString) { result += ch; escaped = true; i++; continue }

    if (inString && ch === '\n') { result += '\\n'; i++; continue }
    if (inString && ch === '\r') { result += '\\r'; i++; continue }
    if (inString && ch === '\t') { result += '\\t'; i++; continue }

    if (ch === '"') {
      if (!inString) {
        inString = true
        result += '"'
        i++
        continue
      }

      // Dentro de uma string — decidir se é fechamento ou aspas internas
      // Percorre espaços/tabs à frente
      let j = i + 1
      while (j < str.length && (str[j] === ' ' || str[j] === '\t')) j++
      const next = j < str.length ? str[j] : ''

      // Fechamento de string: seguido por caractere estrutural JSON
      if (!next || next === ',' || next === '}' || next === ']' || next === '\n' || next === '\r') {
        // Pode ser fechamento real OU aspas internas antes de vírgula (ex: "term", "next")
        // Heurística: se após a vírgula vier outra aspas que NÃO é seguida de "key":
        // trata como aspas internas
        if (next === ',') {
          let k = j + 1
          while (k < str.length && (str[k] === ' ' || str[k] === '\t' || str[k] === '\n')) k++
          const afterComma = k < str.length ? str[k] : ''
          // Se após a vírgula vier outra string (não um campo "key":)
          if (afterComma === '"') {
            // Verifica se é "key": (fechamento real) ou "value" (aspas internas em lista)
            let m = k + 1
            while (m < str.length && str[m] !== '"' && str[m] !== ':' && str[m] !== '\n') m++
            const afterKey = m < str.length ? str[m] : ''
            if (afterKey !== ':') {
              // Parece lista de termos dentro de string → aspas internas
              result += "'"
              i++
              continue
            }
          }
        }
        // Fechamento real
        inString = false
        result += '"'
      } else if (next === ':') {
        // Fim de chave JSON
        inString = false
        result += '"'
      } else {
        // Aspas internas (ex: como "em análise") → substitui por aspas simples
        result += "'"
      }
      i++
      continue
    }

    result += ch
    i++
  }

  return result
}

function sheetsToText(buffer: Buffer): string {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true, cellNF: false, cellText: true })
  const parts: string[] = []
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false })
    if (csv.trim().length < 10) continue
    parts.push(`=== ABA: ${sheetName} ===\n${csv}`)
  }
  return parts.join('\n\n')
}

/** Lê o PDF do modelo como base64 para enviar ao Claude */
function loadModelPdf(): string | null {
  const pdfPath = path.resolve(process.cwd(), '..', 'relatorio_de_auditoria', 'modelo_geracao_relatorio.pdf')
  if (!fs.existsSync(pdfPath)) {
    console.warn('[audit/generate] PDF modelo não encontrado em', pdfPath)
    return null
  }
  return fs.readFileSync(pdfPath).toString('base64')
}

/** Lê o arquivo de instrução de geração */
function loadPromptTxt(): string {
  const txtPath = path.resolve(process.cwd(), '..', 'relatorio_de_auditoria', 'prompt_geracao_relatorio.txt')
  if (!fs.existsSync(txtPath)) {
    console.warn('[audit/generate] prompt_geracao_relatorio.txt não encontrado em', txtPath)
    return ''
  }
  return fs.readFileSync(txtPath, 'utf-8')
}

function buildSystemPrompt(promptTxt: string): string {
  return `Você é um auditor sênior da LF Auditoria e Consultoria especializado em OEA.

${promptTxt ? `INSTRUÇÕES DE ANÁLISE E REDAÇÃO:\n${promptTxt}\n\n---\n\n` : ''}FORMATO DE SAÍDA — OBRIGATÓRIO:
As instruções acima descrevem a estrutura, o conteúdo e as regras de redação do relatório.
O modelo visual foi enviado como documento PDF — use-o como referência de layout, campos e estilo.
NÃO gere arquivos PDF ou Word diretamente. O sistema renderizará o relatório automaticamente.
Retorne SOMENTE um objeto JSON válido com a estrutura abaixo.

REGRA CRÍTICA DE JSON:
- Retorne SOMENTE o JSON, sem texto antes nem depois, sem markdown.
- NUNCA use aspas duplas dentro de valores string. Use aspas simples (') para citações internas.
  ERRADO: "recomendacoes": "opções como "em análise", "concluído""
  CERTO:  "recomendacoes": "opções como 'em análise', 'concluído'"

JSON ESPERADO:

{
  "empresa": "razão social da empresa auditada",
  "criterio": "critério auditado completo",
  "requisitos": "requisitos avaliados do Programa OEA",
  "periodo": "período analisado",
  "metodologia": "metodologia aplicada",
  "auditor": "nome do auditor (vazio se não informado)",
  "procedimento_referencia": "código e nome do procedimento de referência",
  "emissao": "mês e ano de emissão por extenso (ex: agosto de 2026)",
  "stats": {
    "total": 0,
    "conforme": 0,
    "nao_conforme": 0,
    "nao_aplicavel": 0,
    "nao_verificado": 0,
    "indice_conformidade": 0.0
  },
  "indice_calculo_descricao": "Parágrafo completo da seção 2 explicando o critério de cálculo E apresentando a conta com os números reais da planilha. Ex.: 'O índice de conformidade foi calculado atribuindo peso integral (100%) aos itens Conformes e zero aos Não Conformes, excluindo os Não Aplicáveis. Aplicando a fórmula com os dados desta planilha: 20 / (21 − 0) = 20 / 21 = 95,2% (noventa e cinco vírgula dois por cento).'",
  "resumo_executivo": [
    "parágrafo 1",
    "parágrafo 2",
    "parágrafo 3",
    "parágrafo 4",
    "parágrafo 5"
  ],
  "itens": [
    {
      "requisito": "código(s) do requisito",
      "item": "número ou código do item",
      "tema": "tema avaliado",
      "controle": "código do controle",
      "classificacao": "Conforme|Não Conforme|Não Aplicável|Não Verificado",
      "nao_conformidades": "texto da não conformidade (vazio se não houver)",
      "recomendacoes": "texto da recomendação (vazio se não houver)",
      "percentual_conformidade": 100
    }
  ],
  "nota_atencao": "nota sobre os itens que demandam maior atenção + critério de contagem de não conformidades",
  "total_nao_conformidades": 0,
  "total_recomendacoes": 0,
  "item_maior_atencao": "item com maior necessidade de atenção",
  "conclusao": [
    "parágrafo 1 — nível de aderência geral",
    "parágrafo 2 — principais aspectos positivos",
    "parágrafo 3 — pontos que demandam adequação",
    "parágrafo 4 — contribuição das recomendações e relevância para manutenção da certificação",
    "parágrafo 5 — considerações finais e maturidade dos controles"
  ]
}`
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return Response.json({ error: 'Nenhum arquivo enviado.' }, { status: 400 })
    }

    const ext = file.name.split('.').pop()?.toLowerCase()
    if (ext !== 'xlsx' && ext !== 'xls') {
      return Response.json({ error: 'Formato inválido. Envie um arquivo .xlsx ou .xls.' }, { status: 400 })
    }

    if (file.size > 10 * 1024 * 1024) {
      return Response.json({ error: 'Arquivo muito grande. Limite de 10 MB.' }, { status: 413 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const spreadsheetText = sheetsToText(buffer)

    if (!spreadsheetText.trim()) {
      return Response.json({ error: 'Não foi possível extrair conteúdo da planilha.' }, { status: 400 })
    }

    const modelPdfBase64 = loadModelPdf()
    const promptTxt = loadPromptTxt()
    const systemPrompt = buildSystemPrompt(promptTxt)

    console.log('[audit/generate] system prompt length:', systemPrompt.length, '| pdf:', modelPdfBase64 ? 'sim' : 'não')

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

    // Conteúdo da mensagem: PDF modelo (se disponível) + planilha em texto
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userContent: any[] = []

    if (modelPdfBase64) {
      userContent.push({
        type: 'document',
        source: {
          type: 'base64',
          media_type: 'application/pdf',
          data: modelPdfBase64,
        },
        title: 'Modelo de Relatório Executivo de Auditoria OEA',
      })
    }

    userContent.push({
      type: 'text',
      text: `Planilha de auditoria para análise:\n\n${spreadsheetText}`,
    })

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 16000,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userContent },
      ],
    })

    const rawText = message.content
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('')

    console.log('[audit/generate] stop_reason:', message.stop_reason, 'response length:', rawText.length)

    if (message.stop_reason === 'max_tokens') {
      return Response.json({ error: 'A resposta foi cortada por ser muito longa. Tente com uma planilha menor.' }, { status: 500 })
    }

    // ── Extração do JSON ──────────────────────────────────────────────────────
    // Prioridade 1: conteúdo dentro de ```json … ``` (formato preferido do Claude)
    // Prioridade 2: do primeiro { até o último }
    let jsonStr = ''
    const fenceMatch = rawText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
    if (fenceMatch) {
      jsonStr = fenceMatch[1].trim()
    } else {
      const firstBrace = rawText.indexOf('{')
      const lastBrace  = rawText.lastIndexOf('}')
      jsonStr = (firstBrace !== -1 && lastBrace > firstBrace)
        ? rawText.slice(firstBrace, lastBrace + 1)
        : rawText.trim()
    }

    // ── Parse com tentativas progressivas ────────────────────────────────────
    // 1) direto; 2) repair (newlines + aspas internas); 3) repair + trailing commas
    let parsed: Record<string, unknown> | undefined
    const attempts: Array<() => Record<string, unknown>> = [
      () => JSON.parse(jsonStr),
      () => JSON.parse(repairJson(jsonStr)),
      () => JSON.parse(repairJson(jsonStr).replace(/,\s*([}\]])/g, '$1')),
    ]
    let lastErr: unknown
    for (const attempt of attempts) {
      try { parsed = attempt(); break } catch (e) { lastErr = e }
    }
    if (!parsed) {
      // Grava raw para diagnóstico
      const debugPath = path.join(process.cwd(), 'audit_debug.txt')
      fs.writeFileSync(
        debugPath,
        `=== lastErr ===\n${String(lastErr)}\n\n=== jsonStr ===\n${jsonStr}\n\n=== rawText ===\n${rawText}`,
        'utf-8'
      )
      console.error('[audit/generate] parse failed — debug em', debugPath, '| err:', lastErr)
      return Response.json({ error: 'Erro ao interpretar resposta da IA. Tente novamente.' }, { status: 500 })
    }

    return Response.json({ report: parsed })
  } catch (err) {
    console.error('[audit/generate]', err)
    return Response.json(
      { error: err instanceof Error ? err.message : 'Erro interno.' },
      { status: 500 }
    )
  }
}
