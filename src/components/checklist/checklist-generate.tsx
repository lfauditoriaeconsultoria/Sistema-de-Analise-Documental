'use client'

import { useState, useRef, useCallback } from 'react'
import { Upload, FileText, X, Loader2, CheckCircle2, Download, AlertCircle, ChevronDown, TableProperties } from 'lucide-react'
import { cn } from '@/lib/utils'

/* ── Critérios OEA disponíveis ─────────────────────────────────────────────── */
const OEA_CRITERIOS = [
  'Segurança da Informação',
  'Parceiros Comerciais',
  'Segurança Física',
  'Segurança de Carga e Contêineres',
  'Segurança de Pessoal',
  'Educação, Treinamento e Conscientização',
  'Gestão de Riscos',
  'Conformidade',
  'Solvência Financeira',
  'Gestão de Crises e Recuperação de Negócios',
] as const

const ACCEPT_TYPES = '.pdf,.docx,.doc,.txt,.md'
const MAX_FILE_MB  = 20
const MAX_TOTAL_MB = 60

/* ── Tipos ─────────────────────────────────────────────────────────────────── */
interface UploadedFile {
  file: File
  id:   string
}

type Stage = 'idle' | 'loading' | 'done' | 'error'

/* ── Helpers ────────────────────────────────────────────────────────────────── */
function fmtSize(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(0)} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase()
  const color = ext === 'pdf' ? 'text-red-500' : ext?.startsWith('doc') ? 'text-blue-600' : 'text-gray-500'
  return <FileText size={16} className={color} />
}

/* ── Componente ─────────────────────────────────────────────────────────────── */
export function ChecklistGenerate() {
  const [criterio, setCriterio]   = useState('')
  const [cliente,  setCliente]    = useState('')
  const [files,    setFiles]      = useState<UploadedFile[]>([])
  const [stage,    setStage]      = useState<Stage>('idle')
  const [error,    setError]      = useState('')
  const [result,   setResult]     = useState<{ filename: string; blob: Blob; count: number } | null>(null)
  const [dragging, setDragging]   = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)

  /* ── Adiciona arquivos ── */
  const addFiles = useCallback((incoming: FileList | File[]) => {
    const arr = Array.from(incoming)
    const errors: string[] = []

    const next: UploadedFile[] = []
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

  /* ── Drag & drop ── */
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    addFiles(e.dataTransfer.files)
  }, [addFiles])

  /* ── Geração ── */
  async function handleGenerate() {
    setError('')
    if (!criterio)     return setError('Selecione o critério OEA.')
    if (!cliente.trim()) return setError('Informe o nome do cliente.')
    if (!files.length) return setError('Adicione ao menos um documento.')

    const totalSize = files.reduce((s, f) => s + f.file.size, 0)
    if (totalSize > MAX_TOTAL_MB * 1024 * 1024) {
      return setError(`Tamanho total (${fmtSize(totalSize)}) ultrapassa ${MAX_TOTAL_MB} MB.`)
    }

    setStage('loading')
    setResult(null)

    try {
      const fd = new FormData()
      fd.append('criterio', criterio)
      fd.append('cliente', cliente.trim())
      files.forEach(f => fd.append('files', f.file))

      const res = await fetch('/api/checklist/generate', { method: 'POST', body: fd })

      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error ?? `Erro ${res.status}`)
      }

      const blob        = await res.blob()
      const rawFilename = res.headers.get('X-Filename') ?? 'checklist.xlsx'
      // X-Filename é enviado percent-encoded (encodeURIComponent) para preservar acentos
      const filename    = decodeURIComponent(rawFilename)
      const count       = Number(res.headers.get('X-Items-Count') ?? 0)

      setResult({ filename, blob, count })
      setStage('done')
    } catch (e) {
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
    setStage('idle')
    setResult(null)
    setError('')
    setFiles([])
    setCriterio('')
    setCliente('')
  }

  const canGenerate = criterio && cliente.trim() && files.length > 0 && stage !== 'loading'

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

          {/* Critério */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Critério OEA <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <select
                value={criterio}
                onChange={e => setCriterio(e.target.value)}
                disabled={stage === 'loading'}
                className={cn(
                  'w-full appearance-none rounded-lg border px-3 py-2.5 pr-9 text-sm bg-white dark:bg-gray-800',
                  'border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white',
                  'focus:outline-none focus:ring-2 focus:ring-blue-500',
                  'disabled:opacity-60'
                )}
              >
                <option value="">Selecione o critério...</option>
                {OEA_CRITERIOS.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
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

            {/* Área de drop */}
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

            {/* Lista de arquivos */}
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

          {/* Botão gerar */}
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
            <p className="text-center text-xs text-gray-400 -mt-2">
              A IA está lendo os procedimentos e cruzando com os requisitos OEA.
              Isso pode levar de 1 a 3 minutos dependendo da quantidade de documentos.
            </p>
          )}
        </div>
      )}

      {/* Resultado */}
      {stage === 'done' && result && (
        <div className="bg-white dark:bg-gray-900 border border-green-200 dark:border-green-800 rounded-xl p-6 space-y-5 shadow-sm">

          {/* Status */}
          <div className="flex items-center gap-3">
            <CheckCircle2 size={24} className="text-green-500 flex-shrink-0" />
            <div>
              <p className="text-base font-semibold text-gray-900 dark:text-white">
                Checklist gerado com sucesso!
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                <span className="font-medium text-green-600 dark:text-green-400">{result.count} itens auditáveis</span>
                {' '}extraídos dos documentos do cliente para o critério <span className="font-medium">{criterio}</span>
              </p>
            </div>
          </div>

          {/* Arquivo */}
          <div className="rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-4 py-3">
            <div className="flex items-center gap-2 text-sm">
              <FileText size={16} className="text-green-600 flex-shrink-0" />
              <span className="text-gray-700 dark:text-gray-300 truncate font-medium">{result.filename}</span>
            </div>
          </div>

          {/* Ações */}
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

          {/* Aviso Etapa 2 */}
          <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-4 py-3 text-xs text-amber-700 dark:text-amber-400">
            <strong>Próximo passo (Etapa 2):</strong> Após coletar as evidências do cliente, utilize a planilha gerada
            para registrar o atendimento nas colunas Q em diante e gerar o relatório de auditoria.
          </div>
        </div>
      )}
    </div>
  )
}
