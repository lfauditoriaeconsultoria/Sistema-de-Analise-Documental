'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Download, Edit3, Eye, Save, Loader2,
  Bot, X, Send, AlertTriangle, CheckCircle2,
  FileText,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { AuditReportView } from '@/components/audit/audit-report-view'
import { AuditReportData } from '@/types/audit'
import { createClient } from '@/lib/supabase/client'

/* ─────────────────────────────────────────────
   Helpers
───────────────────────────────────────────── */

interface AiChange {
  field: string
  index?: number
  new_value: unknown
}

/** Aplica lista de mudanças da IA sobre o relatório atual */
function applyChanges(report: AuditReportData, changes: AiChange[]): AuditReportData {
  let r = { ...report }
  for (const c of changes) {
    const parts = c.field.split('.')
    if (parts.length === 1) {
      // Campo simples ou array completo
      if (typeof c.index === 'number' && Array.isArray((r as Record<string, unknown>)[c.field])) {
        const arr = [...((r as Record<string, unknown>)[c.field] as unknown[])]
        arr[c.index] = c.new_value
        r = { ...r, [c.field]: arr }
      } else {
        r = { ...r, [c.field]: c.new_value }
      }
    } else if (parts.length === 2 && parts[0] === 'stats') {
      r = { ...r, stats: { ...r.stats, [parts[1]]: c.new_value as number } }
    }
  }
  return r
}

/* ─────────────────────────────────────────────
   WYSIWYG — conversão Markdown ↔ HTML
───────────────────────────────────────────── */

/** **negrito** → <strong>negrito</strong>  (para exibição no contenteditable) */
function mdToHtml(md: string): string {
  return md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>')
}

/** Extrai markdown do HTML produzido pelo contenteditable */
function htmlToMd(html: string): string {
  if (typeof document === 'undefined') return html
  const tmp = document.createElement('div')
  tmp.innerHTML = html

  function walk(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? ''
    if (node.nodeType !== Node.ELEMENT_NODE) return ''
    const el = node as HTMLElement
    const tag = el.tagName.toLowerCase()
    const inner = Array.from(el.childNodes).map(walk).join('')
    if (tag === 'strong' || tag === 'b') return `**${inner}**`
    if (tag === 'br') return '\n'
    if (tag === 'div' || tag === 'p') return inner ? inner + '\n' : ''
    return inner
  }

  return Array.from(tmp.childNodes).map(walk).join('').replace(/\n+$/, '')
}

/* ─────────────────────────────────────────────
   Sub-componente: Editor rich text (WYSIWYG)
───────────────────────────────────────────── */

interface RichParagraphProps {
  value: string          // armazenado como markdown
  onChange: (val: string) => void
  onRemove?: () => void
}

function RichParagraph({ value, onChange, onRemove }: RichParagraphProps) {
  const divRef    = useRef<HTMLDivElement>(null)
  const [focused, setFocused]     = useState(false)
  const [boldOn,  setBoldOn]      = useState(false)

  /* Sincroniza innerHTML ← value somente quando mudança vem de fora (IA, carga inicial) */
  useEffect(() => {
    const el = divRef.current
    if (!el) return
    // Compara em markdown para não tocar enquanto o usuário digita
    if (htmlToMd(el.innerHTML) !== value) {
      el.innerHTML = mdToHtml(value)
    }
  }, [value])

  function syncToParent() {
    if (divRef.current) onChange(htmlToMd(divRef.current.innerHTML))
  }

  function refreshBold() {
    try { setBoldOn(document.queryCommandState('bold')) } catch { /* ignore */ }
  }

  function toggleBold() {
    divRef.current?.focus()
    document.execCommand('bold')
    // execCommand pode não disparar onInput em todos os browsers — sync manual
    setTimeout(() => { syncToParent(); refreshBold() }, 0)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
      e.preventDefault()
      toggleBold()
    }
  }

  /** Cola somente texto plano, preservando apenas negrito inline */
  function handlePaste(e: React.ClipboardEvent<HTMLDivElement>) {
    e.preventDefault()
    const text = e.clipboardData.getData('text/plain')
    document.execCommand('insertText', false, text)
    setTimeout(() => { syncToParent(); refreshBold() }, 0)
  }

  // Toolbar visível apenas quando em foco (com transição suave)
  // Altura fixa (h-7 + mb-1.5 = 34px) para alinhar o botão de exclusão
  const TOOLBAR_H = 'h-7 mb-1.5'

  return (
    <div className="flex gap-2 items-start w-full">

      {/* Coluna principal: barra de ferramentas + editor */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Barra de ferramentas — sempre ocupa espaço, mas some visualmente quando sem foco */}
        <div className={`${TOOLBAR_H} flex items-center gap-1 transition-opacity duration-150 ${focused ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          <button
            type="button"
            onMouseDown={e => { e.preventDefault(); toggleBold() }}
            title="Negrito (Ctrl+B)"
            className={`h-6 px-2.5 flex items-center justify-center rounded text-xs font-bold
              border transition-colors duration-100 select-none
              ${boldOn
                ? 'bg-[#1B3A8C] text-white border-[#1B3A8C]'
                : 'bg-white dark:bg-[#0d1733] border-[#CBD5E1] dark:border-[#1e3570] text-[#1a2a5e] dark:text-[#94a3b8] hover:bg-[#EEF3FF] dark:hover:bg-[#1e3570] hover:border-[#1B3A8C]/50'
              }`}
          >
            B
          </button>
        </div>

        {/* Editor contenteditable — cresce com o conteúdo, sem scrollbar interna */}
        <div
          ref={divRef}
          contentEditable
          suppressContentEditableWarning
          onFocus={() => { setFocused(true); refreshBold() }}
          onBlur={() => { setFocused(false); syncToParent(); setBoldOn(false) }}
          onInput={() => { syncToParent(); refreshBold() }}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onMouseUp={refreshBold}
          onKeyUp={refreshBold}
          className={`w-full px-3 py-2.5 rounded-lg text-sm leading-relaxed outline-none
            text-[#1a2a5e] dark:text-[#e2e8f0] border transition-all duration-150
            ${focused
              ? 'border-[#1B3A8C]/35 ring-1 ring-[#1B3A8C]/15 bg-white dark:bg-[#0d1733]'
              : 'border-[#E8EDF5] dark:border-[#1e3570]/60 bg-[#FAFCFF] dark:bg-[#0a1530] hover:border-[#CBD5E1] dark:hover:border-[#1e3570]'
            }`}
          style={{ minHeight: '44px', wordBreak: 'break-word' }}
        />
      </div>

      {/* Botão de exclusão — separado, alinhado ao topo do editor (abaixo da toolbar) */}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          title="Remover parágrafo"
          className="flex-shrink-0 mt-[34px] p-1 text-[#CBD5E1] hover:text-red-500 dark:text-[#1e3570] dark:hover:text-red-400 transition-colors"
        >
          <X size={15} />
        </button>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────
   Sub-componente: Painel de edição manual
───────────────────────────────────────────── */

interface EditPanelProps {
  report: AuditReportData
  onChange: (next: AuditReportData) => void
}

function EditPanel({ report: r, onChange }: EditPanelProps) {
  const set = (field: keyof AuditReportData, val: unknown) =>
    onChange({ ...r, [field]: val })

  const setStats = (field: keyof AuditReportData['stats'], val: number) =>
    onChange({ ...r, stats: { ...r.stats, [field]: val } })

  const setArrayItem = (field: 'resumo_executivo' | 'conclusao', idx: number, val: string) => {
    const arr = [...r[field]]
    arr[idx] = val
    onChange({ ...r, [field]: arr })
  }

  const addArrayItem = (field: 'resumo_executivo' | 'conclusao') =>
    onChange({ ...r, [field]: [...r[field], ''] })

  const removeArrayItem = (field: 'resumo_executivo' | 'conclusao', idx: number) => {
    const arr = r[field].filter((_, i) => i !== idx)
    onChange({ ...r, [field]: arr })
  }

  const labelCls = 'block text-xs font-semibold text-[#1a2a5e] dark:text-[#94a3b8] mb-1'
  const inputCls = 'w-full rounded-lg border border-[#CBD5E1] dark:border-[#1e3570] bg-white dark:bg-[#0d1733] text-sm text-[#1a2a5e] dark:text-[#e2e8f0] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1B3A8C]/30'

  return (
    <div className="space-y-6">
      {/* Metadados */}
      <section>
        <h3 className="text-sm font-bold text-[#1a2a5e] dark:text-[#e2e8f0] mb-3 pb-1 border-b border-[#E2E8F0] dark:border-[#1e3570]">
          Metadados
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {([
            ['empresa',                 'Empresa'],
            ['criterio',               'Critério'],
            ['requisitos',             'Requisitos'],
            ['periodo',                'Período'],
            ['metodologia',            'Metodologia'],
            ['auditor',                'Auditor Responsável'],
            ['procedimento_referencia','Procedimento de Referência'],
            ['emissao',                'Data de Emissão'],
          ] as [keyof AuditReportData, string][]).map(([field, label]) => (
            <div key={field}>
              <label className={labelCls}>{label}</label>
              <input
                type="text"
                value={(r[field] as string) ?? ''}
                onChange={e => set(field, e.target.value)}
                className={inputCls}
              />
            </div>
          ))}
        </div>
      </section>

      {/* Estatísticas */}
      <section>
        <h3 className="text-sm font-bold text-[#1a2a5e] dark:text-[#e2e8f0] mb-3 pb-1 border-b border-[#E2E8F0] dark:border-[#1e3570]">
          Estatísticas
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {([
            ['total',               'Total de Itens'],
            ['conforme',            'Conformes'],
            ['nao_conforme',        'Não Conformes'],
            ['nao_aplicavel',       'Não Aplicáveis'],
            ['indice_conformidade', 'Índice (%)'],
          ] as [keyof AuditReportData['stats'], string][]).map(([field, label]) => (
            <div key={field}>
              <label className={labelCls}>{label}</label>
              <input
                type="number"
                step={field === 'indice_conformidade' ? '0.1' : '1'}
                value={r.stats[field] ?? 0}
                onChange={e => setStats(field, parseFloat(e.target.value) || 0)}
                className={inputCls}
              />
            </div>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Total Não Conformidades</label>
            <input type="number" value={r.total_nao_conformidades}
              onChange={e => set('total_nao_conformidades', parseInt(e.target.value) || 0)}
              className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Total Recomendações</label>
            <input type="number" value={r.total_recomendacoes}
              onChange={e => set('total_recomendacoes', parseInt(e.target.value) || 0)}
              className={inputCls} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Item de Maior Atenção</label>
            <input type="text" value={r.item_maior_atencao ?? ''}
              onChange={e => set('item_maior_atencao', e.target.value)}
              className={inputCls} />
          </div>
        </div>
      </section>

      {/* Resumo executivo */}
      <section>
        <h3 className="text-sm font-bold text-[#1a2a5e] dark:text-[#e2e8f0] mb-3 pb-1 border-b border-[#E2E8F0] dark:border-[#1e3570]">
          Resumo Executivo
        </h3>
        <div className="space-y-1">
          {r.resumo_executivo.map((p, i) => (
            <RichParagraph
              key={i}
              value={p}
              onChange={val => setArrayItem('resumo_executivo', i, val)}
              onRemove={() => removeArrayItem('resumo_executivo', i)}
            />
          ))}
          <Button variant="ghost" size="sm" onClick={() => addArrayItem('resumo_executivo')} className="text-[#1B3A8C] mt-1">
            + Adicionar parágrafo
          </Button>
        </div>
      </section>

      {/* Nota de atenção */}
      <section>
        <h3 className="text-sm font-bold text-[#1a2a5e] dark:text-[#e2e8f0] mb-3 pb-1 border-b border-[#E2E8F0] dark:border-[#1e3570]">
          Nota de Atenção
        </h3>
        <div className="space-y-3">
          <div>
            <label className={labelCls}>Descrição do índice de cálculo</label>
            <RichParagraph
              value={r.indice_calculo_descricao ?? ''}
              onChange={val => set('indice_calculo_descricao', val)}
            />
          </div>
          <div>
            <label className={labelCls}>Nota de Atenção</label>
            <RichParagraph
              value={r.nota_atencao ?? ''}
              onChange={val => set('nota_atencao', val)}
            />
          </div>
        </div>
      </section>

      {/* Conclusão */}
      <section>
        <h3 className="text-sm font-bold text-[#1a2a5e] dark:text-[#e2e8f0] mb-3 pb-1 border-b border-[#E2E8F0] dark:border-[#1e3570]">
          Conclusão
        </h3>
        <div className="space-y-1">
          {r.conclusao.map((p, i) => (
            <RichParagraph
              key={i}
              value={p}
              onChange={val => setArrayItem('conclusao', i, val)}
              onRemove={() => removeArrayItem('conclusao', i)}
            />
          ))}
          <Button variant="ghost" size="sm" onClick={() => addArrayItem('conclusao')} className="text-[#1B3A8C]">
            + Adicionar parágrafo
          </Button>
        </div>
      </section>
    </div>
  )
}

/* ─────────────────────────────────────────────
   Sub-componente: Chat IA
───────────────────────────────────────────── */

interface ChatMessage {
  role: 'user' | 'assistant'
  text: string
}

interface AiChatProps {
  reportId: string
  report: AuditReportData
  onApplyChanges: (changes: AiChange[], message: string) => void
  onClose: () => void
}

function AiChat({ reportId, report, onApplyChanges, onClose }: AiChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', text: 'Olá! Descreva qual edição deseja fazer no relatório e eu farei as alterações automaticamente.' },
  ])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  const send = async () => {
    const msg = input.trim()
    if (!msg || sending) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', text: msg }])
    setSending(true)

    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const res = await fetch(`/api/audit/reports/${reportId}/ai-edit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ report, message: msg }),
      })
      const data = await res.json()

      if (!res.ok) {
        setMessages(prev => [...prev, { role: 'assistant', text: data.error ?? 'Ocorreu um erro. Tente novamente.' }])
      } else {
        const { changes, message: aiMsg } = data as { changes: AiChange[]; message: string }
        onApplyChanges(changes, aiMsg)
        setMessages(prev => [...prev, { role: 'assistant', text: `✅ ${aiMsg}` }])
        setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', text: 'Erro de conexão. Tente novamente.' }])
    } finally {
      setSending(false)
    }
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-[#E2E8F0] dark:border-[#1e3570]">
        <div className="flex items-center gap-2">
          <Bot size={18} className="text-[#1B3A8C] dark:text-blue-400" />
          <span className="font-semibold text-sm text-[#1a2a5e] dark:text-[#e2e8f0]">Assistente IA</span>
        </div>
        <button onClick={onClose} className="text-[#94A3B8] hover:text-[#1a2a5e] dark:hover:text-[#e2e8f0]">
          <X size={16} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={[
              'rounded-xl px-3.5 py-2.5 text-sm max-w-[85%] leading-relaxed whitespace-pre-wrap',
              m.role === 'user'
                ? 'bg-[#1B3A8C] text-white rounded-br-none'
                : 'bg-[#F0F4FF] dark:bg-[#1e3570]/40 text-[#1a2a5e] dark:text-[#e2e8f0] rounded-bl-none',
            ].join(' ')}>
              {m.text}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="bg-[#F0F4FF] dark:bg-[#1e3570]/40 rounded-xl rounded-bl-none px-3.5 py-2.5">
              <Loader2 size={16} className="animate-spin text-[#1B3A8C] dark:text-blue-400" />
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 p-3 border-t border-[#E2E8F0] dark:border-[#1e3570]">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Descreva a edição desejada… (Enter para enviar)"
            rows={2}
            className="flex-1 rounded-lg border border-[#CBD5E1] dark:border-[#1e3570] bg-white dark:bg-[#0d1733] text-sm text-[#1a2a5e] dark:text-[#e2e8f0] px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-[#1B3A8C]/30 placeholder:text-[#94A3B8]"
          />
          <Button
            onClick={send}
            disabled={!input.trim() || sending}
            className="self-end gap-1.5 px-3"
            size="sm"
          >
            <Send size={14} /> Enviar
          </Button>
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   Componente principal
───────────────────────────────────────────── */

interface Props {
  reportId: string
  initialReport: AuditReportData
}

export function AuditReportPage({ reportId, initialReport }: Props) {
  const router = useRouter()
  const [report, setReport] = useState<AuditReportData>(initialReport)
  const [mode, setMode] = useState<'view' | 'edit'>('view')
  const [showAi, setShowAi] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveOk, setSaveOk] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [downloadingDocx, setDownloadingDocx] = useState(false)
  // Portal só existe no cliente
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  /* ── Salvar no banco ── */
  const handleSave = async () => {
    setSaving(true)
    setSaveOk(false)
    setSaveError(null)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const res = await fetch(`/api/audit/reports/${reportId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ report }),
      })
      if (res.ok) {
        setSaveOk(true)
        setTimeout(() => setSaveOk(false), 3000)
      } else {
        const j = await res.json()
        setSaveError(j.error ?? 'Erro ao salvar.')
      }
    } catch {
      setSaveError('Erro de conexão ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  /* ── Download PDF ── */
  const handleDownloadPdf = useCallback(() => {
    const el = document.getElementById('audit-report')
    if (!el) { window.print(); return }

    const win = window.open('', '_blank')
    if (!win) { window.print(); return }

    let html = el.outerHTML
    html = html.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    const base = window.location.origin
    html = html.replace(/\bsrc="(\/[^"]*)"/g, `src="${base}$1"`)

    win.document.write(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>Relatório de Auditoria</title>
  <style>
    *, *::before, *::after {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body { margin: 0; padding: 0; background: #fff; }
    #audit-report { max-width: none !important; width: 100% !important; }
    @page { size: A4; margin: 19mm 19mm 19mm 25mm; }
    @page cover-pg { size: A4; margin: 0; }
    .cover-page { page: cover-pg; }
    .print-page  { page-break-after: always;  break-after: page; }
    .section-page { page-break-before: always; break-before: page; }
    table { border-collapse: collapse; }
    @media print {
      .print-page  { min-height: 0 !important; }
      .section-page { min-height: 0 !important; }
      #s3-table-wrap { overflow: visible !important; }
      .stat-card  { break-inside: avoid !important; page-break-inside: avoid !important; }
      .cards-row  { break-inside: avoid !important; page-break-inside: avoid !important; }
      #s3-table tr { break-inside: avoid !important; page-break-inside: avoid !important; }
      .section-page { break-before: page !important; page-break-before: always !important; }
    }
  </style>
</head>
<body>
  ${html}
  <script>
    window.onload = function () { setTimeout(function () { window.print(); }, 600); };
  <\/script>
</body>
</html>`)
    win.document.close()
  }, [])

  /* ── Download DOCX ── */
  const handleDownloadDocx = async () => {
    setDownloadingDocx(true)
    try {
      const res = await fetch('/api/audit/docx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report }),
      })
      if (!res.ok) {
        const j = await res.json()
        setSaveError(j.error ?? 'Erro ao gerar DOCX.')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Relatorio_Executivo_${report.empresa.replace(/\s+/g, '_')}.docx`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setSaveError('Erro ao gerar arquivo Word.')
    } finally {
      setDownloadingDocx(false)
    }
  }

  /* ── Aplicar mudanças da IA ── */
  const handleApplyAiChanges = (changes: AiChange[], _message: string) => {
    setReport(prev => applyChanges(prev, changes))
  }

  return (
    <div className="animate-fade-in">
      {/* ── Barra superior ── */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {/* Breadcrumb */}
        <Link href="/audit">
          <Button variant="ghost" size="sm" className="gap-1.5">
            <ArrowLeft size={14} /> Auditoria OEA
          </Button>
        </Link>
        <span className="text-[#94A3B8]">/</span>
        <Link href="/analysis/history">
          <Button variant="ghost" size="sm" className="gap-1.5">Histórico</Button>
        </Link>
        <span className="text-[#94A3B8]">/</span>
        <span className="text-sm font-semibold text-[#1a2a5e] dark:text-[#e2e8f0] truncate max-w-[200px]">
          {report.empresa}
        </span>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Feedback de salvamento */}
        {saveOk && (
          <span className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400 font-medium">
            <CheckCircle2 size={15} /> Salvo com sucesso
          </span>
        )}
        {saveError && (
          <span className="flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400">
            <AlertTriangle size={15} /> {saveError}
          </span>
        )}

        {/* Ações */}
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={mode === 'view' ? 'secondary' : 'ghost'}
            size="sm"
            className="gap-1.5"
            onClick={() => setMode('view')}
          >
            <Eye size={14} /> Visualizar
          </Button>
          <Button
            variant={mode === 'edit' ? 'secondary' : 'ghost'}
            size="sm"
            className="gap-1.5"
            onClick={() => setMode('edit')}
          >
            <Edit3 size={14} /> Editar
          </Button>
          <Button
            variant={showAi ? 'secondary' : 'ghost'}
            size="sm"
            className="gap-1.5"
            onClick={() => setShowAi(v => !v)}
          >
            <Bot size={14} /> {showAi ? 'Fechar IA' : 'Assistente IA'}
          </Button>
          <Button variant="ghost" size="sm" className="gap-1.5" onClick={handleDownloadPdf}>
            <Download size={14} /> PDF
          </Button>
          <Button variant="ghost" size="sm" className="gap-1.5" onClick={handleDownloadDocx} disabled={downloadingDocx}>
            {downloadingDocx ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            Word
          </Button>
          <Button size="sm" className="gap-1.5" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Salvar
          </Button>
        </div>
      </div>

      {/* ── Conteúdo principal ── */}
      {/* No mobile, oculto quando o painel IA está aberto.
          No desktop, recebe margem direita para não ficar sob o painel. */}
      <div
        className={showAi ? 'hidden md:block' : ''}
        style={showAi ? { marginRight: 400 } : {}}
      >
        {mode === 'view' ? (
          <AuditReportView report={report} />
        ) : (
          <Card padding="md" className="max-w-4xl">
            <EditPanel report={report} onChange={setReport} />
          </Card>
        )}
      </div>

      {/* ── Painel IA via Portal — fora de qualquer ancestral com transform ── */}
      {showAi && mounted && createPortal(
        <div
          style={{
            position: 'fixed',
            top: 0,
            right: 0,
            bottom: 0,
            width: '100%',
            maxWidth: 400,
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
          className="bg-white dark:bg-[#0d1f4a] border-l border-[#E2E8F0] dark:border-[#1e3570] shadow-2xl"
        >
          <AiChat
            reportId={reportId}
            report={report}
            onApplyChanges={handleApplyAiChanges}
            onClose={() => setShowAi(false)}
          />
        </div>,
        document.body
      )}
    </div>
  )
}
