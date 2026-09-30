'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, IdCard, Loader2, Upload, FileText, Trash2, Eye, Link2,
  CheckCircle2, AlertTriangle, Circle, XCircle, Download, Printer,
  Sparkles, Save, RotateCcw, ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Modal } from '@/components/ui/modal'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { PerfilOperadorDocTipo, PerfilOperadorElaborationFull, PerfilOperadorItem } from '@/types/perfil-operador'

type Tab = 'documentos' | 'gerar' | 'revisar' | 'exportar'

const TIPO_LABEL: Record<PerfilOperadorDocTipo, string> = {
  politica: 'Políticas, Procedimentos e Instruções de Trabalho',
  evidencia: 'Evidências',
}

function fmtSize(bytes: number | null): string {
  if (!bytes) return '—'
  return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fmtTime(s: number): string {
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`
}

async function authHeaders(): Promise<Record<string, string>> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
}

/* ── Badge de status por item ── */
function ItemStatusIcon({ item }: { item: PerfilOperadorItem }) {
  if (item.status === 'erro') return <XCircle size={15} className="text-red-500 flex-shrink-0" />
  if (item.status === 'pendente') return <Circle size={13} className="text-gray-300 dark:text-gray-600 flex-shrink-0" />
  return item.pendencias.length > 0
    ? <AlertTriangle size={15} className="text-amber-500 flex-shrink-0" />
    : <CheckCircle2 size={15} className="text-green-500 flex-shrink-0" />
}

/* ── Modal genérico de vínculo N:N (checkboxes) ── */
function LinkPickerModal({
  open, onOpenChange, title, options, initialSelected, onConfirm, groupLabel,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  title: string
  options: { id: string; label: string; sublabel?: string; group?: string }[]
  initialSelected: string[]
  // Precisa devolver uma Promise: o modal só fecha DEPOIS de confirmar que salvou —
  // se rejeitar, o erro é mostrado aqui dentro e o modal permanece aberto.
  onConfirm: (ids: string[]) => Promise<void>
  groupLabel?: (group: string) => string
}) {
  // Inicialização preguiçosa: este componente só é renderizado enquanto existir um alvo
  // (documento/item) selecionado — o chamador desmonta e remonta a cada abertura/troca de
  // alvo, então o estado inicial abaixo já reflete sempre o alvo correto, sem precisar de effect.
  const [selected, setSelected] = useState<Set<string>>(() => new Set(initialSelected))
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')

  const groups = Array.from(new Set(options.map(o => o.group ?? '')))

  async function handleSave() {
    setError('')
    setSaving(true)
    try {
      await onConfirm(Array.from(selected))
      onOpenChange(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar vínculos.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onOpenChange={v => !saving && onOpenChange(v)} title={title} size="md">
      <div className="space-y-4">
        <div className="max-h-80 overflow-y-auto space-y-4">
          {groups.map(g => (
            <div key={g}>
              {groupLabel && g && (
                <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide mb-1.5">{groupLabel(g)}</p>
              )}
              <div className="space-y-1">
                {options.filter(o => (o.group ?? '') === g).map(o => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setSelected(prev => {
                      const next = new Set(prev)
                      if (next.has(o.id)) next.delete(o.id); else next.add(o.id)
                      return next
                    })}
                    className="w-full flex items-start gap-2.5 px-2 py-1.5 rounded-md text-left hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <span className={cn(
                      'flex-shrink-0 w-[18px] h-[18px] mt-0.5 rounded border flex items-center justify-center',
                      selected.has(o.id) ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300 dark:border-gray-600'
                    )}>
                      {selected.has(o.id) && <CheckCircle2 size={12} />}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm text-gray-800 dark:text-gray-200 truncate">{o.label}</span>
                      {o.sublabel && <span className="block text-xs text-gray-400">{o.sublabel}</span>}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
          {options.length === 0 && <p className="text-sm text-gray-400 text-center py-6">Nenhuma opção disponível.</p>}
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2 text-xs text-red-700 dark:text-red-400">
            <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" /><span>{error}</span>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
          <Button variant="muted" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button size="sm" onClick={handleSave} loading={saving}>Salvar vínculos</Button>
        </div>
      </div>
    </Modal>
  )
}

export function PerfilOperadorWorkspace({ id }: { id: string }) {
  const [elaboration, setElaboration] = useState<PerfilOperadorElaborationFull | null>(null)
  const [loading, setLoading]         = useState(true)
  const [tab, setTab]                 = useState<Tab>('documentos')

  const reload = useCallback(async () => {
    const res = await fetch(`/api/perfil-operador/elaborations/${id}`, { headers: await authHeaders() })
    if (res.ok) {
      const json = await res.json()
      setElaboration(json.elaboration)
    }
  }, [id])

  useEffect(() => { (async () => { setLoading(true); await reload(); setLoading(false) })() }, [reload])

  if (loading || !elaboration) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-400">
        <Loader2 size={20} className="animate-spin mr-2" /> Carregando elaboração…
      </div>
    )
  }

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'documentos', label: 'Documentos', count: elaboration.documents.length },
    { key: 'gerar',      label: 'Gerar' },
    { key: 'revisar',    label: 'Revisar', count: elaboration.items.filter(i => i.status === 'gerado').length },
    { key: 'exportar',   label: 'Exportar' },
  ]

  return (
    <div className="max-w-5xl mx-auto space-y-5 animate-fade-in">
      <div className="flex items-center gap-3">
        <Link href="/perfil-operador">
          <Button variant="ghost" size="sm" className="gap-1.5"><ArrowLeft size={14} /> Perfil Operador</Button>
        </Link>
        <span className="text-[#94A3B8]">/</span>
        <div className="flex items-center gap-2">
          <IdCard size={16} className="text-blue-500" />
          <h1 className="text-lg font-bold text-[#1a2a5e] dark:text-[#e2e8f0]">{elaboration.cliente}</h1>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-1.5',
              tab === t.key
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            )}
          >
            {t.label}
            {typeof t.count === 'number' && t.count > 0 && (
              <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded-full">
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === 'documentos' && <DocumentosTab elaboration={elaboration} onReload={reload} />}
      {tab === 'gerar'      && <GerarTab elaboration={elaboration} onReload={reload} onDone={() => setTab('revisar')} />}
      {tab === 'revisar'    && <RevisarTab elaboration={elaboration} onReload={reload} />}
      {tab === 'exportar'   && <ExportarTab elaboration={elaboration} />}
    </div>
  )
}

/* ═══════════════════════════════ TAB: DOCUMENTOS ═══════════════════════════════ */

function DocumentosTab({ elaboration, onReload }: { elaboration: PerfilOperadorElaborationFull; onReload: () => Promise<void> }) {
  const [uploading, setUploading] = useState<PerfilOperadorDocTipo | null>(null)
  const [dragging, setDragging]   = useState<PerfilOperadorDocTipo | null>(null)
  const [error, setError]         = useState('')
  const [linkDoc, setLinkDoc]     = useState<string | null>(null)   // doc id sendo editado
  const [linkItem, setLinkItem]   = useState<string | null>(null)   // item id sendo editado
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const inputRefs = { politica: useRef<HTMLInputElement>(null), evidencia: useRef<HTMLInputElement>(null) }

  async function handleUpload(tipo: PerfilOperadorDocTipo, files: FileList | File[]) {
    setError('')
    setUploading(tipo)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) throw new Error('Sessão expirada. Faça login novamente.')

      for (const file of Array.from(files)) {
        const safeName    = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')
        const storagePath = `${session.user.id}/${elaboration.id}/${crypto.randomUUID()}-${safeName}`

        const { error: upErr } = await supabase.storage.from('perfil-operador-uploads').upload(storagePath, file)
        if (upErr) throw new Error(`Erro ao enviar "${file.name}": ${upErr.message}`)

        const res = await fetch('/api/perfil-operador/documents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
          body: JSON.stringify({
            elaboration_id: elaboration.id, tipo,
            file_path: storagePath, filename: file.name, file_size: file.size,
          }),
        })
        if (!res.ok) {
          const j = await res.json().catch(() => ({}))
          throw new Error(j.error ?? `Erro ao registrar "${file.name}".`)
        }
      }
      await onReload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao enviar documento.')
    } finally {
      setUploading(null)
    }
  }

  async function handleDeleteDoc(docId: string) {
    const doc = elaboration.documents.find(d => d.id === docId)
    const usedIn = doc?.item_ids?.length ?? 0
    if (usedIn > 1 && !confirm(`Este documento está vinculado a ${usedIn} itens. Remover mesmo assim?`)) return
    setDeletingId(docId)
    try {
      const res = await fetch(`/api/perfil-operador/documents/${docId}`, { method: 'DELETE', headers: await authHeaders() })
      if (res.ok) await onReload()
    } finally {
      setDeletingId(null)
    }
  }

  async function handleView(docId: string) {
    const res = await fetch(`/api/perfil-operador/documents/${docId}`, { headers: await authHeaders() })
    if (res.ok) {
      const j = await res.json()
      window.open(j.signedUrl, '_blank')
    }
  }

  async function saveDocLinks(docId: string, itemIds: string[]) {
    const res = await fetch(`/api/perfil-operador/documents/${docId}/link`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify({ item_ids: itemIds }),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      throw new Error(j.error ?? `Erro ${res.status} ao salvar vínculos.`)
    }
    await onReload()
  }

  async function saveItemLinks(itemId: string, documentIds: string[]) {
    const res = await fetch(`/api/perfil-operador/items/${itemId}/link`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify({ document_ids: documentIds }),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      throw new Error(j.error ?? `Erro ${res.status} ao salvar vínculos.`)
    }
    await onReload()
  }

  function itemLabel(itemId: string): string {
    const it = elaboration.items.find(i => i.id === itemId)
    return it ? `${it.item_number}` : '?'
  }

  const linkDocRow = elaboration.documents.find(d => d.id === linkDoc)
  const linkItemRow = elaboration.items.find(i => i.id === linkItem)

  return (
    <div className="space-y-6">
      {/* Dropzones */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(['politica', 'evidencia'] as PerfilOperadorDocTipo[]).map(tipo => (
          <Card key={tipo} padding="md">
            <h3 className="font-semibold text-sm text-[#1a2a5e] dark:text-[#e2e8f0] mb-1">{TIPO_LABEL[tipo]}</h3>
            <p className="text-xs text-[#64748B] dark:text-[#94a3b8] mb-3">
              {tipo === 'politica'
                ? 'Adicione as políticas, procedimentos, instruções de trabalho e demais documentos que descrevem os processos e controles da organização.'
                : 'Adicione as evidências que comprovam a execução dos processos e controles da organização.'}
            </p>
            <div
              onClick={() => inputRefs[tipo].current?.click()}
              onDragOver={e => { e.preventDefault(); setDragging(tipo) }}
              onDragLeave={() => setDragging(null)}
              onDrop={e => { e.preventDefault(); setDragging(null); if (e.dataTransfer.files.length) handleUpload(tipo, e.dataTransfer.files) }}
              className={cn(
                'cursor-pointer rounded-lg border-2 border-dashed p-5 text-center transition-colors',
                dragging === tipo ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 hover:bg-gray-50 dark:hover:bg-gray-800/50',
                uploading === tipo && 'pointer-events-none opacity-60'
              )}
            >
              <input
                ref={inputRefs[tipo]}
                type="file"
                multiple
                className="hidden"
                onChange={e => { if (e.target.files?.length) handleUpload(tipo, e.target.files); e.target.value = '' }}
              />
              {uploading === tipo ? (
                <Loader2 size={20} className="mx-auto text-blue-500 animate-spin" />
              ) : (
                <>
                  <Upload size={20} className="mx-auto mb-1.5 text-gray-400" />
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    <span className="font-medium text-blue-600 dark:text-blue-400">Clique</span> ou arraste os arquivos
                  </p>
                </>
              )}
            </div>
          </Card>
        ))}
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" /><span>{error}</span>
        </div>
      )}

      {/* Biblioteca de documentos */}
      {(['politica', 'evidencia'] as PerfilOperadorDocTipo[]).map(tipo => {
        const docs = elaboration.documents.filter(d => d.tipo === tipo)
        if (!docs.length) return null
        return (
          <div key={tipo}>
            <h4 className="text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wide mb-2">{TIPO_LABEL[tipo]}</h4>
            <div className="space-y-2">
              {docs.map(doc => (
                <div key={doc.id} className="flex items-center gap-3 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-3 py-2.5">
                  <FileText size={16} className="text-gray-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{doc.filename}</p>
                    <p className="text-xs text-gray-400">
                      {fmtSize(doc.file_size)}
                      {doc.item_ids && doc.item_ids.length > 0 && (
                        <> · Utilizado em: {doc.item_ids.map(itemLabel).join(', ')}</>
                      )}
                      {(!doc.item_ids || doc.item_ids.length === 0) && <> · Não vinculado a nenhum item ainda</>}
                    </p>
                  </div>
                  <button onClick={() => handleView(doc.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20" title="Visualizar">
                    <Eye size={15} />
                  </button>
                  <button onClick={() => setLinkDoc(doc.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20" title="Editar itens vinculados">
                    <Link2 size={15} />
                  </button>
                  <button
                    onClick={() => handleDeleteDoc(doc.id)}
                    disabled={deletingId === doc.id}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                    title="Remover"
                  >
                    {deletingId === doc.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {/* Vínculo por item */}
      <div>
        <h4 className="text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wide mb-2">Itens desta elaboração</h4>
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-100 dark:divide-gray-700">
          {elaboration.items.map(item => (
            <div key={item.id} className="flex items-center gap-3 px-3 py-2.5">
              <span className="text-xs font-mono font-semibold text-blue-700 dark:text-blue-400 w-12 flex-shrink-0">{item.item_number}</span>
              <p className="flex-1 text-xs text-gray-600 dark:text-gray-400 truncate">{item.item_description}</p>
              <span className="text-xs text-gray-400 flex-shrink-0">
                {item.document_ids?.length ?? 0} documento{(item.document_ids?.length ?? 0) !== 1 ? 's' : ''}
              </span>
              <button
                onClick={() => setLinkItem(item.id)}
                className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline flex-shrink-0"
              >
                Vincular documentos
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Modal: vincular itens a um documento */}
      {linkDocRow && (
        <LinkPickerModal
          key={linkDocRow.id}
          open={!!linkDoc}
          onOpenChange={v => !v && setLinkDoc(null)}
          title={`Itens que usam "${linkDocRow.filename}"`}
          options={elaboration.items.map(it => ({
            id: it.id, label: `${it.item_number} — ${it.item_description}`, group: `${it.criteria_number}. ${it.criteria_name}`,
          }))}
          groupLabel={g => g}
          initialSelected={linkDocRow.item_ids ?? []}
          onConfirm={ids => saveDocLinks(linkDocRow.id, ids)}
        />
      )}

      {/* Modal: vincular documentos existentes a um item */}
      {linkItemRow && (
        <LinkPickerModal
          key={linkItemRow.id}
          open={!!linkItem}
          onOpenChange={v => !v && setLinkItem(null)}
          title={`Documentos usados no item ${linkItemRow.item_number}`}
          options={elaboration.documents.map(d => ({
            id: d.id, label: d.filename, group: TIPO_LABEL[d.tipo],
          }))}
          groupLabel={g => g}
          initialSelected={linkItemRow.document_ids ?? []}
          onConfirm={ids => saveItemLinks(linkItemRow.id, ids)}
        />
      )}
    </div>
  )
}

/* ═══════════════════════════════ TAB: GERAR ═══════════════════════════════ */

function GerarTab({
  elaboration, onReload, onDone,
}: { elaboration: PerfilOperadorElaborationFull; onReload: () => Promise<void>; onDone: () => void }) {
  const [generating, setGenerating]     = useState(false)
  const [progress, setProgress]         = useState('')
  const [progressPct, setProgressPct]   = useState(0)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [error, setError]               = useState('')
  const [itemErrors, setItemErrors]     = useState<{ item_number: string; error: string }[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current) }, [])

  const total     = elaboration.items.length
  const pendentes = elaboration.items.filter(i => i.status !== 'gerado').length
  const gerados   = total - pendentes

  async function handleGenerate(itemIds: string[]) {
    setError('')
    setItemErrors([])
    setGenerating(true)
    setProgress('Iniciando...')
    setProgressPct(0)
    setElapsedSeconds(0)
    timerRef.current = setInterval(() => setElapsedSeconds(s => s + 1), 1_000)

    let doneCount = 0
    const totalToGen = itemIds.length

    try {
      const res = await fetch('/api/perfil-operador/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({ elaboration_id: elaboration.id, item_ids: itemIds }),
      })
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error ?? 'Erro ao iniciar geração.')
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      let hadErrors = false
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const parts = buf.split('\n\n')
        buf = parts.pop() ?? ''
        for (const part of parts) {
          const line = part.trim()
          if (!line.startsWith('data:')) continue
          let evt: {
            type: string; message?: string; item_id?: string; item_number?: string
            error?: string; errors?: number
          } | null = null
          try { evt = JSON.parse(line.slice(5).trim()) } catch { continue }
          if (!evt) continue
          if (evt.type === 'progress' && evt.message) setProgress(evt.message)
          if (evt.type === 'item_done') {
            doneCount++
            setProgressPct(Math.round((doneCount / totalToGen) * 100))
            if (evt.error) {
              hadErrors = true
              setItemErrors(prev => [...prev, { item_number: evt.item_number ?? '?', error: evt.error! }])
            }
          }
          if (evt.type === 'error') throw new Error(evt.message ?? 'Erro na geração.')
          if (evt.type === 'done') {
            setProgressPct(100)
            await onReload()
            // Só troca de aba automaticamente quando TODOS os itens foram gerados com sucesso —
            // se algo falhou, o usuário precisa ver o motivo aqui antes de seguir para revisão.
            if (!hadErrors && !(evt.errors ?? 0)) onDone()
          }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'A geração foi interrompida. Tente novamente.')
    } finally {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
      setGenerating(false)
    }
  }

  return (
    <Card padding="md" className="space-y-5 max-w-2xl">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
          <Sparkles size={20} className="text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h3 className="font-semibold text-[#1a2a5e] dark:text-[#e2e8f0]">Gerar respostas com IA</h3>
          <p className="text-xs text-[#64748B] dark:text-[#94a3b8]">
            {total} item{total !== 1 ? 's' : ''} selecionado{total !== 1 ? 's' : ''} · {gerados} já gerado{gerados !== 1 ? 's' : ''} · {pendentes} pendente{pendentes !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400">
        Cada item será elaborado usando somente os documentos que você vinculou a ele na aba Documentos.
        Itens sem nenhum documento vinculado ainda serão gerados com base apenas na descrição oficial do requisito.
      </p>

      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" /><span>{error}</span>
        </div>
      )}

      <div className="flex gap-3">
        <Button
          onClick={() => handleGenerate(elaboration.items.filter(i => i.status !== 'gerado').map(i => i.id))}
          disabled={generating || pendentes === 0}
          loading={generating}
          className="gap-2"
        >
          <Sparkles size={15} /> Gerar respostas pendentes ({pendentes})
        </Button>
        {gerados > 0 && (
          <Button
            variant="secondary"
            onClick={() => { if (confirm('Isso vai substituir todas as respostas já geradas. Continuar?')) handleGenerate(elaboration.items.map(i => i.id)) }}
            disabled={generating}
            className="gap-2"
          >
            <RotateCcw size={15} /> Gerar novamente todos
          </Button>
        )}
      </div>

      {generating && (
        <div className="space-y-2">
          <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1.5 overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full transition-[width] duration-500 ease-out" style={{ width: `${progressPct}%` }} />
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-blue-600 dark:text-blue-400 truncate">{progress || 'Iniciando…'}</p>
            <span className="text-xs text-gray-400 flex-shrink-0 ml-3 tabular-nums font-mono">⏱ {fmtTime(elapsedSeconds)}</span>
          </div>
        </div>
      )}

      {!generating && itemErrors.length > 0 && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 space-y-2">
          <p className="text-sm font-semibold text-red-700 dark:text-red-400 flex items-center gap-1.5">
            <AlertTriangle size={15} /> {itemErrors.length} item{itemErrors.length !== 1 ? 's' : ''} falharam ao gerar
          </p>
          <ul className="text-xs text-red-700 dark:text-red-400 space-y-1">
            {itemErrors.map((e, i) => (
              <li key={i}><strong className="font-mono">{e.item_number}</strong> — {e.error}</li>
            ))}
          </ul>
          <p className="text-xs text-red-600/80 dark:text-red-400/80">
            Os demais itens (se houver) foram gerados normalmente. Veja os detalhes na aba Revisar, ou tente
            &quot;Regenerar resposta&quot; ali para os itens com erro.
          </p>
        </div>
      )}
    </Card>
  )
}

/* ═══════════════════════════════ TAB: REVISAR ═══════════════════════════════ */

function RevisarTab({ elaboration, onReload }: { elaboration: PerfilOperadorElaborationFull; onReload: () => Promise<void> }) {
  const [selectedId, setSelectedId] = useState<string | null>(elaboration.items[0]?.id ?? null)

  const item = elaboration.items.find(i => i.id === selectedId) ?? null

  const byCriterio = new Map<string, PerfilOperadorItem[]>()
  for (const it of elaboration.items) {
    const key = `${it.criteria_number}. ${it.criteria_name}`
    if (!byCriterio.has(key)) byCriterio.set(key, [])
    byCriterio.get(key)!.push(it)
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5">
      {/* Árvore */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-100 dark:divide-gray-700 max-h-[600px] overflow-y-auto">
        {Array.from(byCriterio.entries()).map(([label, items]) => (
          <div key={label}>
            <p className="px-3 py-2 text-xs font-semibold text-gray-400 bg-gray-50 dark:bg-gray-900/50">{label}</p>
            {items.map(it => (
              <button
                key={it.id}
                onClick={() => setSelectedId(it.id)}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 text-left text-xs transition-colors',
                  selectedId === it.id ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                )}
              >
                <ItemStatusIcon item={it} />
                <span className="font-mono font-semibold text-blue-700 dark:text-blue-400">{it.item_number}</span>
                <ChevronRight size={12} className="text-gray-300 ml-auto flex-shrink-0" />
              </button>
            ))}
          </div>
        ))}
      </div>

      {/* Painel do item — key={item.id} garante estado (rascunho, painel de regeração) sempre
          fresco ao trocar de item, sem precisar sincronizar via effect. */}
      {item ? (
        <ItemDetailPanel key={item.id} item={item} elaboration={elaboration} onReload={onReload} />
      ) : (
        <Card padding="lg" className="flex items-center justify-center text-gray-400 text-sm">
          Selecione um item para revisar.
        </Card>
      )}
    </div>
  )
}

function ItemDetailPanel({
  item, elaboration, onReload,
}: { item: PerfilOperadorItem; elaboration: PerfilOperadorElaborationFull; onReload: () => Promise<void> }) {
  const [draft, setDraft]           = useState(item.resposta)
  const [saving, setSaving]         = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [showRegenPanel, setShowRegenPanel] = useState(false)
  const [instruction, setInstruction] = useState('')
  const [linkOpen, setLinkOpen]     = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      await fetch(`/api/perfil-operador/items/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({ resposta: draft }),
      })
      await onReload()
    } finally {
      setSaving(false)
    }
  }

  async function doRegenerate() {
    setRegenerating(true)
    try {
      const res = await fetch(`/api/perfil-operador/items/${item.id}/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({ instruction: instruction.trim() || undefined }),
      })
      const j = await res.json()
      if (res.ok) { await onReload(); setShowRegenPanel(false); setInstruction('') }
      else alert(j.error ?? 'Erro ao regenerar resposta.')
    } finally {
      setRegenerating(false)
    }
  }

  async function saveItemLinks(documentIds: string[]) {
    const res = await fetch(`/api/perfil-operador/items/${item.id}/link`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify({ document_ids: documentIds }),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      throw new Error(j.error ?? `Erro ${res.status} ao salvar vínculos.`)
    }
    await onReload()
  }

  const linkedDocs = elaboration.documents.filter(d => item.document_ids?.includes(d.id))

  return (
    <Card padding="md" className="space-y-4">
      <div>
        <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">{item.criteria_name} · Item {item.item_number}</p>
        <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">{item.item_description}</p>
      </div>

      {item.status === 'erro' && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2.5 text-sm text-red-700 dark:text-red-400">
          <XCircle size={15} className="mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium">Falha ao gerar esta resposta</p>
            <p className="text-xs mt-0.5">{item.error_message ?? 'Erro desconhecido. Clique em "Regenerar resposta" para tentar novamente.'}</p>
          </div>
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Resposta</label>
        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          rows={10}
          placeholder="Ainda não gerada — vá até a aba Gerar."
          className="w-full rounded-lg border px-3 py-2.5 text-sm bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed"
        />
      </div>

      {item.pendencias.length > 0 && (
        <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-3 py-2.5">
          <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1">Informações que precisam ser confirmadas</p>
          <ul className="text-xs text-amber-700 dark:text-amber-400 list-disc pl-4 space-y-0.5">
            {item.pendencias.map((p, i) => <li key={i}>{p}</li>)}
          </ul>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Documentos utilizados</label>
          <button onClick={() => setLinkOpen(true)} className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline">
            Editar vínculos
          </button>
        </div>
        {linkedDocs.length === 0 ? (
          <p className="text-xs text-gray-400">Nenhum documento vinculado.</p>
        ) : (
          <div className="space-y-2">
            {(['politica', 'evidencia'] as PerfilOperadorDocTipo[]).map(tipo => {
              const docs = linkedDocs.filter(d => d.tipo === tipo)
              if (!docs.length) return null
              return (
                <div key={tipo}>
                  <p className="text-[10px] font-semibold text-blue-700 dark:text-blue-400 uppercase mb-1">{TIPO_LABEL[tipo]}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {docs.map(d => (
                      <span key={d.id} className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full">
                        {d.filename}
                      </span>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showRegenPanel && (
        <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/10 p-3 space-y-2">
          {item.manually_edited && (
            <p className="text-xs text-amber-700 dark:text-amber-400 flex items-start gap-1.5">
              <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" />
              Esta resposta possui alterações manuais. Ao regenerar, o conteúdo atual será substituído.
            </p>
          )}
          <textarea
            value={instruction}
            onChange={e => setInstruction(e.target.value)}
            placeholder='Instrução opcional — ex.: "deixe a resposta mais objetiva"'
            rows={2}
            className="w-full rounded-lg border px-3 py-2 text-xs bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <div className="flex justify-end gap-2">
            <Button variant="muted" size="sm" onClick={() => setShowRegenPanel(false)}>Cancelar</Button>
            <Button size="sm" loading={regenerating} onClick={doRegenerate} className="gap-1.5">
              <RotateCcw size={13} /> Regenerar mesmo assim
            </Button>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center pt-2 border-t border-gray-100 dark:border-gray-700">
        <button
          onClick={() => setShowRegenPanel(true)}
          className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1.5"
        >
          <RotateCcw size={14} /> Regenerar resposta
        </button>
        <Button onClick={handleSave} loading={saving} className="gap-2"><Save size={14} /> Salvar</Button>
      </div>

      {linkOpen && (
        <LinkPickerModal
          key={item.id}
          open={linkOpen}
          onOpenChange={setLinkOpen}
          title={`Documentos usados no item ${item.item_number}`}
          options={elaboration.documents.map(d => ({ id: d.id, label: d.filename, group: TIPO_LABEL[d.tipo] }))}
          groupLabel={g => g}
          initialSelected={item.document_ids ?? []}
          onConfirm={saveItemLinks}
        />
      )}
    </Card>
  )
}

/* ═══════════════════════════════ TAB: EXPORTAR ═══════════════════════════════ */

function ExportarTab({ elaboration }: { elaboration: PerfilOperadorElaborationFull }) {
  const [exporting, setExporting] = useState(false)

  async function handleDocx() {
    setExporting(true)
    try {
      const res = await fetch('/api/perfil-operador/export/docx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({ cliente: elaboration.cliente, items: elaboration.items }),
      })
      if (!res.ok) { alert('Erro ao gerar DOCX.'); return }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Perfil_Operador_${elaboration.cliente.replace(/[^a-zA-Z0-9]/g, '_')}.docx`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  const gerados = elaboration.items.filter(i => i.status === 'gerado').length

  return (
    <Card padding="md" className="max-w-xl space-y-4">
      <div>
        <h3 className="font-semibold text-[#1a2a5e] dark:text-[#e2e8f0]">Exportar Perfil do Operador</h3>
        <p className="text-xs text-[#64748B] dark:text-[#94a3b8] mt-1">
          {gerados} de {elaboration.items.length} itens com resposta elaborada. Itens sem resposta aparecerão
          marcados no documento exportado.
        </p>
      </div>
      <div className="flex gap-3">
        <Button onClick={handleDocx} loading={exporting} className="gap-2"><Download size={15} /> Exportar DOCX</Button>
        <a href={`/print/perfil-operador/${elaboration.id}`} target="_blank" rel="noopener noreferrer">
          <Button variant="secondary" className="gap-2"><Printer size={15} /> Exportar PDF</Button>
        </a>
      </div>
    </Card>
  )
}
