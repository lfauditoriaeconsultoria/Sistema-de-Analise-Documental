import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchUrlContent } from '@/lib/fetch-url-content'

const FIFTEEN_DAYS_MS = 15 * 24 * 60 * 60 * 1000

export async function GET(req: NextRequest) {
  // Protect with CRON_SECRET so only Vercel Cron (or manual admin calls) can trigger
  const secret = req.headers.get('x-cron-secret') ?? req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.CRON_SECRET) {
    return Response.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const admin = createAdminClient()
  const cutoff = new Date(Date.now() - FIFTEEN_DAYS_MS).toISOString()

  // Fetch links that were never checked OR haven't been checked in 15 days
  const { data: links, error } = await admin
    .from('reference_links')
    .select('id, url')
    .or(`last_checked_at.is.null,last_checked_at.lt.${cutoff}`)

  if (error) {
    console.error('[links/refresh] query error:', error)
    return Response.json({ error: 'Erro ao buscar links' }, { status: 500 })
  }

  if (!links || links.length === 0) {
    return Response.json({ message: 'Nenhum link para verificar', checked: 0 })
  }

  const results = await Promise.allSettled(
    links.map(async (link) => {
      let content: string | null = null
      let fetchError: string | null = null
      try {
        content = await fetchUrlContent(link.url)
      } catch (err) {
        fetchError = err instanceof Error ? err.message : 'Erro desconhecido'
      }

      await admin
        .from('reference_links')
        .update({
          content: content ?? undefined,
          fetch_status: content ? 'success' : 'failed',
          last_checked_at: new Date().toISOString(),
          fetch_error: fetchError,
          updated_at: new Date().toISOString(),
        })
        .eq('id', link.id)

      return { id: link.id, status: content ? 'success' : 'failed' }
    })
  )

  const summary = results.reduce(
    (acc, r) => {
      if (r.status === 'fulfilled') {
        acc[r.value.status as 'success' | 'failed']++
      } else {
        acc.failed++
      }
      return acc
    },
    { success: 0, failed: 0 }
  )

  console.log('[links/refresh] completed:', summary)
  return Response.json({ checked: links.length, ...summary })
}
