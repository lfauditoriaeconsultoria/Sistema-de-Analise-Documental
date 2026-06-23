export async function fetchUrlContent(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'LFAuditoria-KnowledgeBot/1.0' },
    signal: AbortSignal.timeout(20000),
  })

  if (!res.ok) throw new Error(`Falha ao acessar URL: HTTP ${res.status}`)

  const contentType = res.headers.get('content-type') ?? ''

  if (contentType.includes('text/plain')) {
    return (await res.text()).substring(0, 100000)
  }

  const html = await res.text()

  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s{2,}/g, ' ')
    .trim()

  return text.substring(0, 100000)
}
