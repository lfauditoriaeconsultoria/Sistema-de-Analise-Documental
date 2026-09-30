import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthedUser } from '@/lib/perfil-operador/auth'
import { generateItemAnswer, humanizeApiError } from '@/lib/perfil-operador/generate-item'
import { PerfilOperadorDocument, PerfilOperadorItem } from '@/types/perfil-operador'

export const maxDuration = 300

// Concorrência limitada — uma elaboração pode ter dezenas de itens selecionados;
// processar tudo em paralelo de uma vez arriscaria rate limit da Anthropic.
const CONCURRENCY = 4

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T, idx: number) => Promise<R>): Promise<void> {
  let cursor = 0
  async function worker() {
    while (cursor < items.length) {
      const idx = cursor++
      await fn(items[idx], idx)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
}

export async function POST(req: NextRequest) {
  const user = await getAuthedUser(req)
  if (!user) return Response.json({ error: 'Não autorizado' }, { status: 401 })

  const body           = await req.json().catch(() => ({}))
  const elaborationId  = String(body.elaboration_id ?? '')
  const requestedIds   = Array.isArray(body.item_ids) ? (body.item_ids as string[]) : []

  if (!elaborationId) return Response.json({ error: 'Informe a elaboração.' }, { status: 400 })

  const admin = createAdminClient()
  const { data: elaboration } = await admin
    .from('perfil_operador_elaborations')
    .select('*')
    .eq('id', elaborationId)
    .eq('user_id', user.id)
    .single()
  if (!elaboration) return Response.json({ error: 'Elaboração não encontrada.' }, { status: 404 })

  const { data: allItems } = await admin
    .from('perfil_operador_items')
    .select('*')
    .eq('elaboration_id', elaborationId)

  const items: PerfilOperadorItem[] = (allItems ?? []).filter(
    it => !requestedIds.length || requestedIds.includes(it.id)
  )
  if (!items.length) return Response.json({ error: 'Nenhum item para gerar.' }, { status: 400 })

  // ── SSE ────────────────────────────────────────────────────────────────────
  const enc = new TextEncoder()
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>()
  const writer = writable.getWriter()

  let writeQueue = Promise.resolve()
  const send = (data: object) => {
    const chunk = enc.encode(`data: ${JSON.stringify(data)}\n\n`)
    writeQueue = writeQueue.then(() => writer.write(chunk)).catch(() => { /* stream cancelado */ })
  }

  const sseResponse = new Response(readable, {
    headers: {
      'Content-Type':      'text/event-stream; charset=utf-8',
      'Cache-Control':     'no-cache, no-transform',
      'Connection':        'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })

  void (async () => {
    send({ type: 'ping' })
    const pingId = setInterval(() => send({ type: 'ping' }), 15_000)

    try {
      send({ type: 'progress', message: `Preparando ${items.length} item(ns)...` })

      // Busca todos os vínculos documento↔item de uma vez (evita N+1 queries)
      const itemIds = items.map(i => i.id)
      const { data: links } = await admin
        .from('perfil_operador_document_items')
        .select('document_id, item_id')
        .in('item_id', itemIds)

      const docIds = Array.from(new Set((links ?? []).map(l => l.document_id)))
      let documents: PerfilOperadorDocument[] = []
      if (docIds.length) {
        const { data } = await admin
          .from('perfil_operador_documents')
          .select('*')
          .in('id', docIds)
        documents = data ?? []
      }
      const docsById = new Map(documents.map(d => [d.id, d]))

      send({ type: 'progress', message: 'Analisando documentos e elaborando respostas com IA...' })

      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

      let done = 0
      let okCount = 0
      let errCount = 0

      await mapWithConcurrency(items, CONCURRENCY, async (item) => {
        const linkedDocIds = (links ?? []).filter(l => l.item_id === item.id).map(l => l.document_id)
        const linkedDocs   = linkedDocIds.map(id => docsById.get(id)).filter((d): d is PerfilOperadorDocument => !!d)

        try {
          const result = await generateItemAnswer(client, elaboration.cliente, item, linkedDocs)

          const { error: saveErr } = await admin.from('perfil_operador_items').update({
            resposta:        result.resposta,
            pendencias:      result.pendencias,
            status:          'gerado',
            error_message:   null,
            manually_edited: false,
            generated_at:    new Date().toISOString(),
          }).eq('id', item.id)

          if (saveErr) {
            // A resposta foi gerada (e cobrada) mas não foi possível salvá-la — nunca falhar
            // silenciosamente aqui, senão o usuário paga pela geração e perde o resultado.
            console.error(`[perfil-operador/generate] item ${item.item_number} — FALHA AO SALVAR:`, saveErr)
            const msg = `Resposta gerada, mas houve falha ao salvar no banco: ${saveErr.message}. Verifique se todas as migrations de supabase/migration-perfil-operador*.sql foram executadas.`
            errCount++
            send({
              type: 'item_done', item_id: item.id, status: 'erro',
              criteria_number: item.criteria_number, item_number: item.item_number,
              error: msg,
            })
            return
          }

          okCount++
          send({
            type: 'item_done', item_id: item.id, status: 'gerado',
            criteria_number: item.criteria_number, item_number: item.item_number,
            pendencias_count: result.pendencias.length,
          })
        } catch (err) {
          console.error(`[perfil-operador/generate] item ${item.item_number}`, err)
          const msg = err instanceof Error ? humanizeApiError(err.message) : 'Erro ao gerar resposta.'
          const { error: saveErr } = await admin.from('perfil_operador_items').update({ status: 'erro', error_message: msg }).eq('id', item.id)
          if (saveErr) console.error(`[perfil-operador/generate] item ${item.item_number} — falha ao salvar status de erro:`, saveErr)
          errCount++
          send({
            type: 'item_done', item_id: item.id, status: 'erro',
            criteria_number: item.criteria_number, item_number: item.item_number,
            error: msg,
          })
        } finally {
          done++
          send({ type: 'progress', message: `Elaborando respostas... (${done}/${items.length} concluídos)` })
        }
      })

      await admin.from('perfil_operador_elaborations').update({ status: 'revisao' }).eq('id', elaborationId)

      send({ type: 'done', total: items.length, ok: okCount, errors: errCount })
      await writeQueue
    } catch (err) {
      console.error('[perfil-operador/generate] fatal', err)
      send({ type: 'error', message: err instanceof Error ? err.message : 'Erro interno no servidor.' })
      await writeQueue
    } finally {
      clearInterval(pingId)
      try { await writer.close() } catch { /* já fechado */ }
    }
  })()

  return sseResponse
}
