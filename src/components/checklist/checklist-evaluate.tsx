'use client'

import { useState, useRef, useCallback } from 'react'
import {
  Upload, FileText, X, Loader2, CheckCircle2, Download,
  AlertCircle, ClipboardCheck, FileSpreadsheet, Info,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const ACCEPT_XLSX = '.xlsx'
const ACCEPT_EV   = '.pdf,.jpg,.jpeg,.png,.gif,.webp,.docx,.doc,.txt,.md,.csv'
const MAX_EV_MB   = 20
const MAX_TOTAL_MB = 100

/* ── Tipos ──────────────────────────────────────────────────────────────────── */
interface UploadedFile {
  file: File
  id:   string
}

interface ValidationError {
  row:     number
  id:      number
  field:   string
  message: string
}

interface EvalStats {
  total: number
  sim:   number
  nao:   number
  na:    number
  nv:    number
}

type Stage = 'idle' | 'validating' | 'loading' | 'done' | 'error'

/* ── Helpers ─────────────────────────────────────────────────────────────── */
function fmtSize(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(0)} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fileIcon(name: string, size = 16) {
  const ext   = name.split('.').pop()?.toLowerCase()
  const color = ext === 'pdf'
    ? 'text-red-500'
    : ext?.startsWith('doc')
    ? 'text-blue-600'
    : ['jpg','jpeg','png','gif','webp'].includes(ext ?? '')
    ? 'text-purple-500'
    : 'text-gray-500'
  return <FileText size={size} className={color} />
}

/* ── Componente principal ───────────────────────────────────────────────────── */
export function ChecklistEvaluate() {
  const [xlsxFile,  setXlsxFile]   = useState<File | null>(null)
  const [evFiles,   setEvFiles]    = useState<UploadedFile[]>([])
  const [stage,     setStage]      = useState<Stage>('idle')
  const [error,     setError]      = useState('')
  const [valErrors, setValErrors]  = useState<ValidationError[]>([])
  const [result,    setResult]     = useState<{ filename: string; blob: Blob; stats: EvalStats } | null>(null)
  const [draggingXlsx, setDraggingXlsx] = useState(false)
  const [draggingEv,   setDraggingEv]   = useState(false)

  const xlsxInputRef = useRef<HTMLInputElement>(null)
  const evInputRef   = useRef<HTMLInputElement>(null)

  /* ── Upload XLSX ── */
  function handleXlsxFile(f: File | undefined) {
    if (!f) return
    if (!f.name.toLowerCase().endsWith('.xlsx')) {
      setError('A planilha deve estar no formato .xlsx (gerada na Etapa 1).')
      return
    }
    setXlsxFile(f)
    setError('')
    setValErrors([])
  }

  /* ── Upload evidências ── */
  const addEvFiles = useCallback((incoming: FileList | File[]) => {
    const arr = Array.from(incoming)
    const errors: string[] = []
    const next: UploadedFile[] = []
    for (const f of arr) {
      if (f.size > MAX_EV_MB * 1024 * 1024) {
        errors.push(`"${f.name}" ultrapassa ${MAX_EV_MB} MB`)
        continue
      }
      next.push({ file: f, id: `${f.name}-${f.size}-${Date.now()}` })
    }
    if (errors.length) setError(errors.join('; '))
    setEvFiles(prev => {
      const existing = new Set(prev.map(x => x.id))
      return [...prev, ...next.filter(n => !existing.has(n.id))]
    })
  }, [])

  const removeEvFile = (id: string) => setEvFiles(prev => prev.filter(f => f.id !== id))

  /* ── Submissão ── */
  async function handleEvaluate() {
    setError('')
    setValErrors([])

    if (!xlsxFile)        return setError('Selecione a planilha de checklist (.xlsx).')
    if (!evFiles.length)  return setError('Adicione ao menos uma evidência do cliente.')

    const evTotal = evFiles.reduce((s, f) => s + f.file.size, 0)
    if (evTotal + xlsxFile.size > MAX_TOTAL_MB * 1024 * 1024) {
      return setError(`Tamanho total (${fmtSize(evTotal + xlsxFile.size)}) ultrapassa ${MAX_TOTAL_MB} MB.`)
    }

    setStage('validating')
    setResult(null)

    try {
      const fd = new FormData()
      fd.append('xlsx', xlsxFile)
      evFiles.forEach(f => fd.append('evidencias', f.file))

      const res = await fetch('/api/checklist/evaluate', { method: 'POST', body: fd })

      // Erros de validação (422)
      if (res.status === 422) {
        const j = await res.json()
        setValErrors(j.validationErrors ?? [])
        setStage('error')
        return
      }

      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error ?? `Erro ${res.status}`)
      }

      setStage('loading')

      const blob         = await res.blob()
      const rawFilename  = res.headers.get('X-Filename') ?? 'checklist-preenchida.xlsx'
      const filename     = decodeURIComponent(rawFilename)
      const rawStats     = res.headers.get('X-Stats') ?? ''
      const stats: EvalStats = rawStats
        ? JSON.parse(decodeURIComponent(rawStats))
        : { total: 0, sim: 0, nao: 0, na: 0, nv: 0 }

      setResult({ filename, blob, stats })
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
    setValErrors([])
    setXlsxFile(null)
    setEvFiles([])
  }

  const isProcessing = stage === 'validating' || stage === 'loading'
  const canSubmit    = !!xlsxFile && evFiles.length > 0 && !isProcessing

  /* ── Render ─────────────────────────────────────────────────────────────── */
  return (
    <div className="max-w-3xl mx-auto space-y-6">

      {/* Cabeçalho */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
          <ClipboardCheck size={22} className="text-green-600 dark:text-green-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Avaliação de Evidências</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Etapa 2 — Preenchimento do checklist com base nas evidências do cliente
          </p>
        </div>
      </div>

      {/* Formulário */}
      {stage !== 'done' && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-6 space-y-6 shadow-sm">

          {/* Aviso informativo */}
          <div className="flex items-start gap-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 px-4 py-3 text-xs text-blue-700 dark:text-blue-400">
            <Info size={14} className="mt-0.5 flex-shrink-0" />
            <span>
              <strong>Pré-requisito:</strong> As colunas A–P da planilha devem estar completamente preenchidas
              (Etapa 1 concluída) antes de prosseguir. A IA preencherá as colunas Q–AA com base nas evidências.
            </span>
          </div>

          {/* Upload do checklist */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Planilha de checklist <span className="text-red-500">*</span>
              <span className="ml-2 font-normal text-gray-400">Gerada na Etapa 1 · .xlsx</span>
            </label>

            {xlsxFile ? (
              <div className="flex items-center gap-2 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 px-4 py-3">
                <FileSpreadsheet size={18} className="text-green-600 flex-shrink-0" />
                <span className="flex-1 truncate text-sm font-medium text-gray-700 dark:text-gray-300">{xlsxFile.name}</span>
                <span className="text-xs text-gray-400">{fmtSize(xlsxFile.size)}</span>
                {!isProcessing && (
                  <button onClick={() => { setXlsxFile(null); setValErrors([]) }} className="text-gray-400 hover:text-red-500 transition-colors ml-1">
                    <X size={14} />
                  </button>
                )}
              </div>
            ) : (
              <div
                onClick={() => xlsxInputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setDraggingXlsx(true) }}
                onDragLeave={() => setDraggingXlsx(false)}
                onDrop={e => { e.preventDefault(); setDraggingXlsx(false); handleXlsxFile(e.dataTransfer.files[0]) }}
                className={cn(
                  'cursor-pointer rounded-lg border-2 border-dashed p-5 text-center transition-colors',
                  draggingXlsx
                    ? 'border-green-400 bg-green-50 dark:bg-green-900/20'
                    : 'border-gray-300 dark:border-gray-600 hover:border-green-400 hover:bg-gray-50 dark:hover:bg-gray-800/50'
                )}
              >
                <input
                  ref={xlsxInputRef}
                  type="file"
                  accept={ACCEPT_XLSX}
                  className="hidden"
                  onChange={e => handleXlsxFile(e.target.files?.[0])}
                />
                <Upload size={20} className="mx-auto mb-2 text-gray-400" />
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  <span className="font-medium text-green-600 dark:text-green-400">Clique</span> ou arraste a planilha
                </p>
              </div>
            )}
          </div>

          {/* Erros de validação da planilha */}
          {valErrors.length > 0 && (
            <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle size={16} className="text-red-600 dark:text-red-400 flex-shrink-0" />
                <p className="text-sm font-semibold text-red-700 dark:text-red-400">
                  A planilha possui {valErrors.length} problema{valErrors.length > 1 ? 's' : ''} que impedem o processamento:
                </p>
              </div>
              <ul className="space-y-1 text-xs text-red-700 dark:text-red-400 list-disc list-inside pl-1">
                {valErrors.map((e, i) => (
                  <li key={i}>{e.message}</li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-red-600 dark:text-red-500 font-medium">
                Corrija os campos indicados na planilha e faça o upload novamente.
              </p>
            </div>
          )}

          {/* Upload de evidências */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Evidências do cliente <span className="text-red-500">*</span>
              <span className="ml-2 font-normal text-gray-400">PDF, JPG, PNG, DOCX, TXT · até {MAX_EV_MB} MB por arquivo</span>
            </label>

            <div
              onClick={() => evInputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDraggingEv(true) }}
              onDragLeave={() => setDraggingEv(false)}
              onDrop={e => { e.preventDefault(); setDraggingEv(false); addEvFiles(e.dataTransfer.files) }}
              className={cn(
                'cursor-pointer rounded-lg border-2 border-dashed p-6 text-center transition-colors',
                draggingEv
                  ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 hover:bg-gray-50 dark:hover:bg-gray-800/50',
                isProcessing && 'pointer-events-none opacity-60'
              )}
            >
              <input
                ref={evInputRef}
                type="file"
                multiple
                accept={ACCEPT_EV}
                className="hidden"
                onChange={e => e.target.files && addEvFiles(e.target.files)}
              />
              <Upload size={24} className="mx-auto mb-2 text-gray-400" />
              <p className="text-sm text-gray-600 dark:text-gray-400">
                <span className="font-medium text-blue-600 dark:text-blue-400">Clique para selecionar</span>
                {' '}ou arraste as evidências aqui
              </p>
              <p className="text-xs text-gray-400 mt-1">Múltiplos arquivos suportados</p>
            </div>

            {evFiles.length > 0 && (
              <ul className="mt-3 space-y-2">
                {evFiles.map(f => (
                  <li key={f.id} className="flex items-center gap-2 rounded-lg bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm">
                    {fileIcon(f.file.name)}
                    <span className="flex-1 truncate text-gray-700 dark:text-gray-300 font-medium">{f.file.name}</span>
                    <span className="text-xs text-gray-400 flex-shrink-0">{fmtSize(f.file.size)}</span>
                    {!isProcessing && (
                      <button onClick={() => removeEvFile(f.id)} className="text-gray-400 hover:text-red-500 transition-colors">
                        <X size={14} />
                      </button>
                    )}
                  </li>
                ))}
                <li className="text-xs text-gray-400 px-1">
                  Total: {evFiles.length} arquivo{evFiles.length > 1 ? 's' : ''} · {fmtSize(evFiles.reduce((s, f) => s + f.file.size, 0))}
                </li>
              </ul>
            )}
          </div>

          {/* Erro geral */}
          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
              <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Botão */}
          <button
            onClick={handleEvaluate}
            disabled={!canSubmit}
            className={cn(
              'w-full flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold transition-all',
              canSubmit
                ? 'bg-green-600 text-white hover:bg-green-700 active:scale-[0.99]'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
            )}
          >
            {isProcessing ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                {stage === 'validating' ? 'Validando planilha…' : 'Analisando evidências com IA…'}
              </>
            ) : (
              <>
                <ClipboardCheck size={16} />
                Avaliar Evidências e Preencher Checklist
              </>
            )}
          </button>

          {stage === 'loading' && (
            <p className="text-center text-xs text-gray-400 -mt-2">
              A IA está cruzando cada evidência com os requisitos do checklist.
              Isso pode levar de 2 a 5 minutos dependendo da quantidade de arquivos.
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
                Avaliação concluída!
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {result.stats.total} itens avaliados — colunas Q–AA preenchidas na planilha
              </p>
            </div>
          </div>

          {/* Resumo de conformidade */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Conforme',   value: result.stats.sim, color: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' },
              { label: 'Não Conf.',  value: result.stats.nao, color: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' },
              { label: 'N/A',        value: result.stats.na,  color: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300' },
              { label: 'N/V',        value: result.stats.nv,  color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' },
            ].map(({ label, value, color }) => (
              <div key={label} className={cn('rounded-lg px-3 py-3 text-center', color)}>
                <p className="text-2xl font-bold">{value}</p>
                <p className="text-xs font-medium mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Arquivo */}
          <div className="rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-4 py-3">
            <div className="flex items-center gap-2 text-sm">
              <FileSpreadsheet size={16} className="text-green-600 flex-shrink-0" />
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
              Baixar Planilha Preenchida (.xlsx)
            </button>
            <button
              onClick={handleReset}
              className="px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Nova Avaliação
            </button>
          </div>

          {result.stats.nao > 0 && (
            <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-xs text-red-700 dark:text-red-400">
              <strong>{result.stats.nao} não conformidade{result.stats.nao > 1 ? 's' : ''} identificada{result.stats.nao > 1 ? 's' : ''}.</strong>
              {' '}As descrições estão na coluna Y da planilha. Utilize os dados para gerar o Relatório de Auditoria (Etapa 3).
            </div>
          )}

          {result.stats.nao === 0 && (
            <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 px-4 py-3 text-xs text-green-700 dark:text-green-400">
              <strong>Nenhuma não conformidade identificada.</strong>
              {' '}Revise as constatações na coluna X e utilize a planilha para gerar o Relatório de Auditoria (Etapa 3).
            </div>
          )}
        </div>
      )}
    </div>
  )
}
