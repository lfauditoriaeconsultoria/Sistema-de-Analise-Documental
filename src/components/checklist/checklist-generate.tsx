'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import {
  Upload, FileText, X, Loader2, CheckCircle2, Download,
  AlertCircle, TableProperties, ChevronDown, Search, Check,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

const ACCEPT_TYPES      = '.pdf,.docx,.doc,.txt,.md'
const MAX_FILE_MB       = 20
const MAX_TOTAL_MB      = 60
// Limite seguro abaixo do teto de 4.5 MB do Vercel para request bodies.
// Quando o total ultrapassa esse valor, os arquivos são enviados diretamente
// ao Supabase Storage (sem passar pelo Vercel) e a API recebe apenas os paths.
const VERCEL_BODY_LIMIT = 3.5 * 1024 * 1024

/* ── Tipos ─────────────────────────────────────────────────────────────────── */
interface OeaCriteria {
  number: number
  name:   string
}

interface UploadedFile {
  file: File
  id:   string
}

type Stage = 'idle' | 'loading' | 'done' | 'error'

/* ── Helpers ─────────────────────────────────────────────────────────────── */
function fmtSize(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(0)} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fileIcon(name: string) {
  const ext   = name.split('.').pop()?.toLowerCase()
  const color = ext === 'pdf'
    ? 'text-red-500'
    : ext?.startsWith('doc') ? 'text-blue-600' : 'text-gray-500'
  return <FileText size={16} className={color} />
}

/* ── Multi-select de critérios ──────────────────────────────────────────────── */
interface CriteriaSelectProps {
  criteria:   OeaCriteria[]
  selected:   string[]
  onChange:   (v: string[]) => void
  disabled:   boolean
  loading:    boolean
}

function CriteriaSelect({ criteria, selected, onChange, disabled, loading }: CriteriaSelectProps) {
  const [open,   setOpen]   = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  // Fecha ao clicar fora
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  const filtered = criteria.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    String(c.number).includes(search)
  )

  function toggle(name: string) {
    onChange(
      selected.includes(name)
        ? selected.filter(s => s !== name)
        : [...selected, name]
    )
  }

  function selectAll() { onChange(criteria.map(c => c.name)) }
  function clearAll()  { onChange([]) }

  const label = loading
    ? 'Carregando critérios…'
    : selected.length === 0
    ? 'Selecione os critérios…'
    : selected.length === 1
    ? criteria.find(c => c.name === selected[0])
        ? `${criteria.find(c => c.name === selected[0])!.number}. ${selected[0]}`
        : selected[0]
    : `${selected.length} critérios selecionados`

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => !disabled && !loading && setOpen(o => !o)}
        disabled={disabled || loading}
        className={cn(
          'w-full flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm bg-white dark:bg-gray-800 text-left transition-colors',
          'border-gray-300 dark:border-gray-600',
          'focus:outline-none focus:ring-2 focus:ring-blue-500',
          open && 'ring-2 ring-blue-500',
          (disabled || loading) && 'opacity-60 cursor-not-allowed',
          !disabled && !loading && 'cursor-pointer hover:border-blue-400'
        )}
      >
        <span className={cn('truncate', selected.length === 0 && 'text-gray-400')}>
          {label}
        </span>
        {loading
          ? <Loader2 size={15} className="animate-spin text-gray-400 flex-shrink-0" />
          : <ChevronDown size={15} className={cn('text-gray-400 flex-shrink-0 transition-transform', open && 'rotate-180')} />
        }
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg overflow-hidden">
          {/* Busca */}
          <div className="p-2 border-b border-gray-100 dark:border-gray-700">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                autoFocus
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar critério…"
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-700 dark:text-gray-300"
              />
            </div>
          </div>

          {/* Ações rápidas */}
          <div className="flex gap-2 px-3 py-1.5 border-b border-gray-100 dark:border-gray-700">
            <button
              type="button"
              onClick={selectAll}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              Selecionar todos
            </button>
            <span className="text-gray-300 dark:text-gray-600">·</span>
            <button
              type="button"
              onClick={clearAll}
              className="text-xs text-gray-500 dark:text-gray-400 hover:underline"
            >
              Limpar
            </button>
          </div>

          {/* Lista */}
          <ul className="max-h-60 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-4 text-xs text-center text-gray-400">Nenhum critério encontrado</li>
            ) : (
              filtered.map(c => {
                const isSelected = selected.includes(c.name)
                return (
                  <li key={c.number}>
                    <button
                      type="button"
                      onClick={() => toggle(c.name)}
                      className={cn(
                        'w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors',
                        isSelected
                          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                      )}
                    >
                      <span className={cn(
                        'flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center',
                        isSelected
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'border-gray-300 dark:border-gray-600'
                      )}>
                        {isSelected && <Check size={10} />}
                      </span>
                      <span className="flex-shrink-0 text-xs font-semibold text-gray-400 dark:text-gray-500 w-5 text-right">
                        {c.number}.
                      </span>
                      <span className="flex-1">{c.name}</span>
                    </button>
                  </li>
                )
              })
            )}
          </ul>
        </div>
      )}
    </div>
  )
}

/* ── Componente principal ───────────────────────────────────────────────────── */
export function ChecklistGenerate() {
  const [criteria,  setCriteria]  = useState<OeaCriteria[]>([])
  const [criterios, setCriterios] = useState<string[]>([])
  const [cliente,   setCliente]   = useState('')
  const [files,     setFiles]     = useState<UploadedFile[]>([])
  const [stage,     setStage]     = useState<Stage>('idle')
  const [error,     setError]     = useState('')
  const [progress,  setProgress]  = useState('')
  const [result,    setResult]    = useState<{ filename: string; blob: Blob; count: number } | null>(null)
  const [dragging,  setDragging]  = useState(false)
  const [loadingCriteria, setLoadingCriteria] = useState(true)
  const [elapsedSeconds, setElapsedSeconds]   = useState(0)
  const [progressPct,    setProgressPct]      = useState(0)

  const inputRef  = useRef<HTMLInputElement>(null)
  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null)
  const crawlRef  = useRef<ReturnType<typeof setInterval> | null>(null)

  /* ── Busca critérios do banco ── */
  useEffect(() => {
    async function fetchCriteria() {
      try {
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        const res = await fetch('/api/oea-criteria', {
          headers: session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : {},
        })
        if (res.ok) {
          const json = await res.json()
          const list: OeaCriteria[] = (json.criteria ?? []).map((c: { number: number; name: string }) => ({
            number: c.number,
            name:   c.name,
          }))
          setCriteria(list)
        }
      } catch {
        // falha silenciosa — usuário verá a lista vazia
      } finally {
        setLoadingCriteria(false)
      }
    }
    fetchCriteria()
  }, [])

  /* ── Cleanup de intervals ao desmontar ── */
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (crawlRef.current) clearInterval(crawlRef.current)
    }
  }, [])

  /* ── Helpers de progresso e timer ── */
  function fmtTime(s: number): string {
    if (s < 60) return `${s}s`
    const m = Math.floor(s / 60)
    return `${m}m ${String(s % 60).padStart(2, '0')}s`
  }

  function startLoading() {
    setElapsedSeconds(0)
    setProgressPct(0)
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => setElapsedSeconds(prev => prev + 1), 1_000)
  }

  function stopLoading() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    if (crawlRef.current) { clearInterval(crawlRef.current); crawlRef.current = null }
  }

  function advanceProgress(pct: number) {
    if (crawlRef.current) { clearInterval(crawlRef.current); crawlRef.current = null }
    setProgressPct(pct)
  }

  // Crawl suave: avança 0,4% por segundo de `from` até `cap` (nunca ultrapassa)
  function startCrawl(from: number, cap: number) {
    if (crawlRef.current) { clearInterval(crawlRef.current); crawlRef.current = null }
    let cur = from
    crawlRef.current = setInterval(() => {
      cur = Math.min(cur + 0.4, cap)
      setProgressPct(cur)
      if (cur >= cap && crawlRef.current) { clearInterval(crawlRef.current); crawlRef.current = null }
    }, 1_000)
  }

  /* ── Upload de arquivos ── */
  const addFiles = useCallback((incoming: FileList | File[]) => {
    const arr    = Array.from(incoming)
    const errors: string[] = []
    const next:   UploadedFile[] = []
    for (const f of arr) {
      if (f.size > MAX_FILE_MB * 1024 * 1024) {
        errors.push(`"${f.name}" ultrapassa ${MAX_FILE_MB} MB`)
        continue
      }
      next.push({ file: f, id: `${f.name}-${f.size}-${Date.now()}` })
    }
    if (errors.length) setError(errors.join('; '))
    setFiles(prev => {
      const existing = new Set(prev.map(x => x.id))
      return [...prev, ...next.filter(n => !existing.has(n.id))]
    })
  }, [])

  const removeFile = (id: string) => setFiles(prev => prev.filter(f => f.id !== id))

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    addFiles(e.dataTransfer.files)
  }, [addFiles])

  /* ── Helpers de geração ── */

  // Lê o stream SSE e processa eventos (compartilhado entre os dois modos)
  async function readSSE(res: Response): Promise<void> {
    const reader  = res.body!.getReader()
    const decoder = new TextDecoder()
    let   buf     = ''

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })

      // Processa eventos completos (separados por \n\n)
      const parts = buf.split('\n\n')
      buf = parts.pop() ?? ''

      for (const part of parts) {
        const line = part.trim()
        if (!line.startsWith('data:')) continue
        const jsonStr = line.slice('data:'.length).trim()
        let evt: { type: string; message?: string; filename?: string; count?: number; file?: string; signedUrl?: string } | null = null
        try { evt = JSON.parse(jsonStr) } catch { continue }
        if (!evt) continue

        if (evt.type === 'progress' && evt.message) {
          setProgress(evt.message)
          // Avança a barra conforme a etapa do servidor
          if      (evt.message.includes('Preparando'))   advanceProgress(30)
          else if (evt.message.includes('Buscando'))     advanceProgress(45)
          else if (evt.message.includes('Analisando')) { advanceProgress(50); startCrawl(50, 84) }
          else if (evt.message.includes('Gerando'))      advanceProgress(90)
          else if (evt.message.includes('Baixando'))     advanceProgress(95)
        } else if (evt.type === 'error') {
          throw new Error(evt.message ?? 'Erro ao gerar checklist.')
        } else if (evt.type === 'done') {
          let blob: Blob
          if (evt.signedUrl) {
            // Preferencial: baixa via URL assinada (evento SSE menor)
            setProgress('Baixando planilha...')
            advanceProgress(95)
            const fileRes = await fetch(evt.signedUrl)
            if (!fileRes.ok) throw new Error('Falha ao baixar o arquivo gerado.')
            blob = await fileRes.blob()
          } else if (evt.file) {
            // Fallback: decodifica base64 embutido no evento
            const binary = Uint8Array.from(atob(evt.file), c => c.charCodeAt(0))
            blob = new Blob([binary], {
              type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            })
          } else {
            throw new Error('Resposta inválida: arquivo não encontrado.')
          }
          advanceProgress(100)
          stopLoading()
          setResult({ filename: evt.filename ?? 'checklist.xlsx', blob, count: evt.count ?? 0 })
          setStage('done')
          return
        }
        // evt.type === 'ping' — ignorado
      }
    }

    // Stream encerrou sem evento 'done'
    throw new Error('A geração foi interrompida. Tente novamente.')
  }

  // Modo 1: total ≤ 3.5 MB — envia diretamente como multipart/form-data
  async function generateViaFormData(): Promise<void> {
    setProgress('Enviando documentos...')
    advanceProgress(15)

    const fd = new FormData()
    criterios.forEach(c => fd.append('criterios', c))
    fd.append('cliente', cliente.trim())
    files.forEach(f => fd.append('files', f.file))

    const res = await fetch('/api/checklist/generate', { method: 'POST', body: fd })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      throw new Error(j.error ?? `Erro ${res.status}`)
    }
    await readSSE(res)
  }

  // Modo 2: total > 3.5 MB — upload direto ao Supabase Storage (bypassa limite do Vercel),
  // depois envia apenas os paths para a API processar
  async function generateViaStorage(): Promise<void> {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) throw new Error('Sessão expirada. Faça login novamente.')

    const userId = session.user.id

    // Uploads em paralelo — todos os arquivos são enviados ao Supabase simultaneamente.
    // Ordem preservada via Promise.all. Um contador atualiza o progresso conforme cada
    // arquivo termina, sem bloquear os outros.
    setProgress(`Enviando ${files.length} arquivo${files.length > 1 ? 's' : ''}...`)
    let uploadedCount = 0

    const paths = await Promise.all(
      files.map(async (f) => {
        // Path segue a política RLS: userId/uuid-nome — o bucket RLS exige userId como 1ª pasta
        const safeName    = f.file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')
        const storagePath = `${userId}/${crypto.randomUUID()}-${safeName}`

        const { error } = await supabase.storage
          .from('checklist-uploads')
          .upload(storagePath, f.file)

        if (error) throw new Error(`Erro ao enviar "${f.file.name}": ${error.message}`)

        uploadedCount++
        setProgress(`Enviando documentos... (${uploadedCount}/${files.length} concluídos)`)
        setProgressPct(Math.round((uploadedCount / files.length) * 20))
        return storagePath
      })
    )

    setProgress('Conectando com a IA...')

    const res = await fetch('/api/checklist/generate', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ criterios, cliente: cliente.trim(), filePaths: paths }),
    })

    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      throw new Error(j.error ?? `Erro ${res.status}`)
    }

    await readSSE(res)
  }

  /* ── Geração via SSE ── */
  async function handleGenerate() {
    setError('')
    setProgress('')
    if (criterios.length === 0) return setError('Selecione ao menos um critério OEA.')
    if (!cliente.trim())        return setError('Informe o nome do cliente.')
    if (!files.length)          return setError('Adicione ao menos um documento.')

    const totalSize = files.reduce((s, f) => s + f.file.size, 0)
    if (totalSize > MAX_TOTAL_MB * 1024 * 1024) {
      return setError(`Tamanho total (${fmtSize(totalSize)}) ultrapassa ${MAX_TOTAL_MB} MB.`)
    }

    setStage('loading')
    setResult(null)
    startLoading()

    try {
      if (totalSize > VERCEL_BODY_LIMIT) {
        // Arquivos grandes: upload direto ao Supabase, API recebe só os paths
        await generateViaStorage()
      } else {
        // Arquivos pequenos: multipart direto (mais simples, sem etapa extra)
        await generateViaFormData()
      }
    } catch (e) {
      stopLoading()
      setError(e instanceof Error ? e.message : 'Erro desconhecido.')
      setStage('error')
    }
  }

  function handleDownload() {
    if (!result) return
    const url = URL.createObjectURL(result.blob)
    const a   = document.createElement('a')
    a.href     = url
    a.download = result.filename
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleReset() {
    stopLoading()
    setElapsedSeconds(0)
    setProgressPct(0)
    setProgress('')
    setStage('idle')
    setResult(null)
    setError('')
    setFiles([])
    setCriterios([])
    setCliente('')
  }

  const canGenerate = criterios.length > 0 && cliente.trim() && files.length > 0 && stage !== 'loading'

  /* ── Label dos critérios selecionados para o resultado ── */
  const criteriosLabel = criterios.length === 1
    ? criterios[0]
    : `${criterios.length} critérios`

  /* ── Render ─────────────────────────────────────────────────────────────── */
  return (
    <div className="max-w-3xl mx-auto space-y-6">

      {/* Cabeçalho */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
          <TableProperties size={22} className="text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Gerador de Checklist de Auditoria</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Etapa 1 — Estrutura do checklist a partir dos procedimentos do cliente
          </p>
        </div>
      </div>

      {/* Formulário */}
      {stage !== 'done' && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-6 space-y-5 shadow-sm">

          {/* Critérios OEA */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Critério(s) OEA <span className="text-red-500">*</span>
              {criterios.length > 0 && (
                <span className="ml-2 text-xs font-normal text-blue-600 dark:text-blue-400">
                  {criterios.length} selecionado{criterios.length > 1 ? 's' : ''}
                </span>
              )}
            </label>
            <CriteriaSelect
              criteria={criteria}
              selected={criterios}
              onChange={setCriterios}
              disabled={stage === 'loading'}
              loading={loadingCriteria}
            />
            {/* Chips dos selecionados */}
            {criterios.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {criterios.map(c => {
                  const num = criteria.find(cr => cr.name === c)?.number
                  return (
                    <span
                      key={c}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                    >
                      {num != null ? `${num}. ` : ''}{c}
                      {stage !== 'loading' && (
                        <button
                          type="button"
                          onClick={() => setCriterios(prev => prev.filter(s => s !== c))}
                          className="hover:text-red-500 transition-colors"
                        >
                          <X size={10} />
                        </button>
                      )}
                    </span>
                  )
                })}
              </div>
            )}
          </div>

          {/* Nome do cliente */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Nome do cliente <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={cliente}
              onChange={e => setCliente(e.target.value)}
              disabled={stage === 'loading'}
              placeholder="Ex.: Empresa XYZ Ltda."
              className={cn(
                'w-full rounded-lg border px-3 py-2.5 text-sm bg-white dark:bg-gray-800',
                'border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-400',
                'focus:outline-none focus:ring-2 focus:ring-blue-500',
                'disabled:opacity-60'
              )}
            />
          </div>

          {/* Upload de documentos */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Procedimentos e políticas do cliente <span className="text-red-500">*</span>
              <span className="ml-2 font-normal text-gray-400">PDF, DOCX, TXT · até {MAX_FILE_MB} MB por arquivo</span>
            </label>

            <div
              onClick={() => inputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={cn(
                'relative cursor-pointer rounded-lg border-2 border-dashed p-6 text-center transition-colors',
                dragging
                  ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 hover:bg-gray-50 dark:hover:bg-gray-800/50',
                stage === 'loading' && 'pointer-events-none opacity-60'
              )}
            >
              <input
                ref={inputRef}
                type="file"
                multiple
                accept={ACCEPT_TYPES}
                className="hidden"
                onChange={e => e.target.files && addFiles(e.target.files)}
              />
              <Upload size={24} className="mx-auto mb-2 text-gray-400" />
              <p className="text-sm text-gray-600 dark:text-gray-400">
                <span className="font-medium text-blue-600 dark:text-blue-400">Clique para selecionar</span>
                {' '}ou arraste os arquivos aqui
              </p>
              <p className="text-xs text-gray-400 mt-1">Múltiplos arquivos suportados</p>
            </div>

            {files.length > 0 && (
              <ul className="mt-3 space-y-2">
                {files.map(f => (
                  <li key={f.id} className="flex items-center gap-2 rounded-lg bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm">
                    {fileIcon(f.file.name)}
                    <span className="flex-1 truncate text-gray-700 dark:text-gray-300 font-medium">{f.file.name}</span>
                    <span className="text-xs text-gray-400 flex-shrink-0">{fmtSize(f.file.size)}</span>
                    {stage !== 'loading' && (
                      <button onClick={() => removeFile(f.id)} className="text-gray-400 hover:text-red-500 transition-colors">
                        <X size={14} />
                      </button>
                    )}
                  </li>
                ))}
                <li className="text-xs text-gray-400 px-1">
                  Total: {files.length} arquivo{files.length > 1 ? 's' : ''} · {fmtSize(files.reduce((s, f) => s + f.file.size, 0))}
                </li>
              </ul>
            )}
          </div>

          {/* Erro */}
          {(error || stage === 'error') && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
              <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
              <span>{error || 'Erro ao gerar checklist.'}</span>
            </div>
          )}

          {/* Botão */}
          <button
            onClick={handleGenerate}
            disabled={!canGenerate}
            className={cn(
              'w-full flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold transition-all',
              canGenerate
                ? 'bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.99]'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
            )}
          >
            {stage === 'loading' ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Analisando documentos com IA…
              </>
            ) : (
              <>
                <TableProperties size={16} />
                Gerar Checklist
              </>
            )}
          </button>

          {stage === 'loading' && (
            <div className="-mt-2 space-y-2.5">

              {/* Barra de progresso */}
              <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1.5 overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-[width] duration-700 ease-out"
                  style={{ width: `${progressPct}%` }}
                />
              </div>

              {/* Etapa atual + timer */}
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-blue-600 dark:text-blue-400 truncate">
                  {progress || 'Iniciando…'}
                </p>
                <span className="text-xs text-gray-400 flex-shrink-0 ml-3 tabular-nums font-mono">
                  ⏱ {fmtTime(elapsedSeconds)}
                </span>
              </div>

              <p className="text-xs text-gray-400 text-center leading-relaxed">
                A IA está lendo os procedimentos e cruzando com os requisitos OEA.
                Isso pode levar de 1 a 3 minutos dependendo da quantidade de documentos.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Resultado */}
      {stage === 'done' && result && (
        <div className="bg-white dark:bg-gray-900 border border-green-200 dark:border-green-800 rounded-xl p-6 space-y-5 shadow-sm">
          <div className="flex items-center gap-3">
            <CheckCircle2 size={24} className="text-green-500 flex-shrink-0" />
            <div>
              <p className="text-base font-semibold text-gray-900 dark:text-white">
                Checklist gerado com sucesso!
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                <span className="font-medium text-green-600 dark:text-green-400">{result.count} itens auditáveis</span>
                {' '}extraídos para: <span className="font-medium">{criteriosLabel}</span>
              </p>
            </div>
          </div>

          <div className="rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-4 py-3">
            <div className="flex items-center gap-2 text-sm">
              <FileText size={16} className="text-green-600 flex-shrink-0" />
              <span className="text-gray-700 dark:text-gray-300 truncate font-medium">{result.filename}</span>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleDownload}
              className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-green-600 text-white px-4 py-3 text-sm font-semibold hover:bg-green-700 transition-colors"
            >
              <Download size={16} />
              Baixar Planilha (.xlsx)
            </button>
            <button
              onClick={handleReset}
              className="px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Novo Checklist
            </button>
          </div>

          <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-4 py-3 text-xs text-amber-700 dark:text-amber-400">
            <strong>Próximo passo (Etapa 2):</strong> Após coletar as evidências do cliente, utilize a planilha gerada
            para registrar o atendimento nas colunas Q em diante e gerar o relatório de auditoria.
          </div>
        </div>
      )}
    </div>
  )
}
