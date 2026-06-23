'use client'

import { Analysis, Report, CompliancePoint, ImprovementSuggestion, PromptResponse } from '@/types'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { ComplianceBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChatInterface } from './chat-interface'
import { formatDate } from '@/lib/utils'
import {
  CheckCircle, XCircle, AlertCircle, ChevronDown, ChevronUp,
  MessageSquare, FileText, Calendar, User, ArrowLeft,
  ArrowUpCircle, ArrowDownCircle, MinusCircle, Lightbulb,
  Pencil, Save, X, Trash2, FileDown, FileType,
} from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  analysis: Analysis & { theme?: { name: string; color: string }; subtopic?: { name: string } | null }
  report: Report | null
}

// ── Helper: auto-resize textarea ──────────────────────────────────────────────
function AutoTextarea({ value, onChange, className }: { value: string; onChange: (v: string) => void; className?: string }) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      rows={3}
      className={`w-full resize-none rounded-lg border border-[#CBD5E1] dark:border-[#1e3570] bg-white dark:bg-[#0a1530] px-3 py-2 text-sm text-[#1a2a5e] dark:text-[#e2e8f0] leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#1B3A8C] dark:focus:ring-blue-400 focus:border-transparent ${className ?? ''}`}
    />
  )
}

// ── PromptResponsesSection ─────────────────────────────────────────────────────
function PromptResponsesSection({
  responses, editMode,
  onDelete, onEditResponse,
}: {
  responses: PromptResponse[]
  editMode?: boolean
  onDelete?: (i: number) => void
  onEditResponse?: (i: number, value: string) => void
}) {
  const [expanded, setExpanded] = useState(true)
  if (!responses || responses.length === 0) return null

  return (
    <div className="rounded-xl border-2 border-[#E0E7FF] dark:border-[#1e3570] overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full px-4 py-3 text-left bg-[#EEF2FF] dark:bg-[#1e3570]/40"
      >
        <div className="flex items-center gap-2 text-[#4338CA] dark:text-indigo-300">
          <Lightbulb size={16} />
          <span className="font-semibold text-sm">Respostas às Instruções do Gestor</span>
          <span className="text-xs bg-[#E0E7FF] dark:bg-indigo-900/40 text-[#4338CA] dark:text-indigo-300 rounded-full px-2 py-0.5 font-bold">{responses.length}</span>
        </div>
        {expanded
          ? <ChevronUp size={16} className="text-[#4338CA] dark:text-indigo-300" />
          : <ChevronDown size={16} className="text-[#4338CA] dark:text-indigo-300" />}
      </button>
      {expanded && (
        <div className="divide-y divide-[#F1F5F9] dark:divide-[#1e3570]">
          {responses.map((r, i) => (
            <div key={i} className="px-4 py-4 bg-white dark:bg-[#0f1d42]">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-sm text-[#1a2a5e] dark:text-[#e2e8f0] mb-1.5 flex-1">{r.prompt}</p>
                {editMode && (
                  <button onClick={() => onDelete?.(i)} className="text-[#94A3B8] hover:text-[#DC2626] transition-colors mt-0.5 flex-shrink-0">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
              {editMode ? (
                <AutoTextarea value={r.response} onChange={v => onEditResponse?.(i, v)} />
              ) : (
                <p className="text-sm text-[#475569] dark:text-[#94a3b8] leading-relaxed whitespace-pre-line">{r.response}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── PointsList ─────────────────────────────────────────────────────────────────
function PointsList({
  points, type, editMode,
  onDelete, onEditItem, onEditDescription,
}: {
  points: CompliancePoint[]
  type: 'conforming' | 'partial' | 'non_conforming'
  editMode?: boolean
  onDelete?: (i: number) => void
  onEditItem?: (i: number, value: string) => void
  onEditDescription?: (i: number, value: string) => void
}) {
  const [expanded, setExpanded] = useState(true)
  const config = {
    conforming: {
      icon: <CheckCircle size={16} />,
      color: '#16A34A',
      headerCls: 'bg-[#F0FDF4] dark:bg-green-900/30',
      borderCls: 'border-[#DCFCE7] dark:border-green-800/50',
      countCls: 'bg-[#DCFCE7] dark:bg-green-800/40 text-[#16A34A] dark:text-green-300',
      iconCls: 'text-[#16A34A]',
      label: 'Pontos em Conformidade',
    },
    partial: {
      icon: <AlertCircle size={16} />,
      color: '#D97706',
      headerCls: 'bg-[#FFFBEB] dark:bg-amber-900/30',
      borderCls: 'border-[#FEF3C7] dark:border-amber-800/50',
      countCls: 'bg-[#FEF3C7] dark:bg-amber-800/40 text-[#D97706] dark:text-amber-300',
      iconCls: 'text-[#D97706]',
      label: 'Parcialmente Conformes',
    },
    non_conforming: {
      icon: <XCircle size={16} />,
      color: '#DC2626',
      headerCls: 'bg-[#FFF5F5] dark:bg-red-900/30',
      borderCls: 'border-[#FEE2E2] dark:border-red-800/50',
      countCls: 'bg-[#FEE2E2] dark:bg-red-800/40 text-[#DC2626] dark:text-red-300',
      iconCls: 'text-[#DC2626]',
      label: 'Não Conformes',
    },
  }[type]

  if (points.length === 0 && !editMode) return null
  if (points.length === 0 && editMode) return (
    <div className={`rounded-xl border-2 overflow-hidden text-center py-4 text-sm text-[#94A3B8] dark:text-[#64748b] ${config.borderCls}`}>
      Todos os itens foram removidos
    </div>
  )

  return (
    <div className={`rounded-xl border-2 overflow-hidden ${config.borderCls}`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className={`flex items-center justify-between w-full px-4 py-3 text-left ${config.headerCls}`}
      >
        <div className={`flex items-center gap-2 ${config.iconCls}`}>
          {config.icon}
          <span className="font-semibold text-sm">{config.label}</span>
          <span className={`text-xs rounded-full px-2 py-0.5 font-bold ${config.countCls}`}>
            {points.length}
          </span>
        </div>
        {expanded
          ? <ChevronUp size={16} className={config.iconCls} />
          : <ChevronDown size={16} className={config.iconCls} />}
      </button>
      {expanded && (
        <div className="divide-y divide-[#F1F5F9] dark:divide-[#1e3570]">
          {points.map((point, i) => (
            <div key={i} className={`px-4 py-3 bg-white dark:bg-[#0f1d42] ${editMode ? 'space-y-2' : ''}`}>
              <div className="flex items-start gap-2">
                <div className="flex-1 space-y-1.5">
                  {editMode ? (
                    <>
                      <AutoTextarea value={point.item} onChange={v => onEditItem?.(i, v)} className="font-medium" />
                      <AutoTextarea value={point.description} onChange={v => onEditDescription?.(i, v)} />
                    </>
                  ) : (
                    <>
                      <p className="font-medium text-sm text-[#1a2a5e] dark:text-[#e2e8f0]">{point.item}</p>
                      <p className="text-xs text-[#64748B] dark:text-[#94a3b8] leading-relaxed">{point.description}</p>
                    </>
                  )}
                  {point.reference && !editMode && (
                    <span className="inline-block text-xs bg-[#EEF2FF] dark:bg-[#1e3570] text-[#1B3A8C] dark:text-blue-300 px-2 py-0.5 rounded-full">
                      {point.reference}
                    </span>
                  )}
                </div>
                {editMode && (
                  <button onClick={() => onDelete?.(i)} className="text-[#94A3B8] hover:text-[#DC2626] transition-colors mt-1 flex-shrink-0">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── SuggestionsList ────────────────────────────────────────────────────────────
function SuggestionsList({
  suggestions, editMode,
  onDelete, onEditItem, onEditSuggestion,
}: {
  suggestions: ImprovementSuggestion[]
  editMode?: boolean
  onDelete?: (i: number) => void
  onEditItem?: (i: number, value: string) => void
  onEditSuggestion?: (i: number, value: string) => void
}) {
  const [expanded, setExpanded] = useState(true)
  if (suggestions.length === 0 && !editMode) return null

  const priorityConfig = {
    alta: { icon: <ArrowUpCircle size={14} />, color: '#DC2626', bg: '#FEE2E2', label: 'Alta' },
    media: { icon: <MinusCircle size={14} />, color: '#D97706', bg: '#FEF3C7', label: 'Média' },
    baixa: { icon: <ArrowDownCircle size={14} />, color: '#16A34A', bg: '#DCFCE7', label: 'Baixa' },
  }

  return (
    <div className="rounded-xl border-2 border-[#DBEAFE] dark:border-[#1e3570] overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full px-4 py-3 text-left bg-[#EEF2FF] dark:bg-[#1e3570]/40"
      >
        <div className="flex items-center gap-2 text-[#1B3A8C] dark:text-blue-300">
          <AlertCircle size={16} />
          <span className="font-semibold text-sm">Sugestões de Melhoria</span>
          <span className="text-xs bg-[#DBEAFE] dark:bg-[#1e3570] text-[#1B3A8C] dark:text-blue-300 rounded-full px-2 py-0.5 font-bold">{suggestions.length}</span>
        </div>
        {expanded
          ? <ChevronUp size={16} className="text-[#1B3A8C] dark:text-blue-300" />
          : <ChevronDown size={16} className="text-[#1B3A8C] dark:text-blue-300" />}
      </button>
      {expanded && (
        <div className="divide-y divide-[#F1F5F9] dark:divide-[#1e3570]">
          {suggestions.length === 0 && (
            <p className="text-center py-4 text-sm text-[#94A3B8] dark:text-[#64748b]">Todas as sugestões foram removidas</p>
          )}
          {suggestions.map((s, i) => {
            const pc = priorityConfig[s.priority] ?? priorityConfig.media
            return (
              <div key={i} className={`px-4 py-3 bg-white dark:bg-[#0f1d42] ${editMode ? 'space-y-2' : ''}`}>
                <div className="flex items-start gap-2">
                  <div className="flex-1 space-y-1.5">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full" style={{ color: pc.color, backgroundColor: pc.bg }}>
                        {pc.icon} Prioridade {pc.label}
                      </span>
                    </div>
                    {editMode ? (
                      <>
                        <AutoTextarea value={s.item} onChange={v => onEditItem?.(i, v)} className="font-medium" />
                        <AutoTextarea value={s.suggestion} onChange={v => onEditSuggestion?.(i, v)} />
                      </>
                    ) : (
                      <>
                        <p className="font-medium text-sm text-[#1a2a5e] dark:text-[#e2e8f0]">{s.item}</p>
                        <p className="text-xs text-[#64748B] dark:text-[#94a3b8] leading-relaxed">{s.suggestion}</p>
                        {s.reference && (
                          <span className="inline-block text-xs bg-[#EEF2FF] dark:bg-[#1e3570] text-[#1B3A8C] dark:text-blue-300 px-2 py-0.5 rounded-full">
                            {s.reference}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                  {editMode && (
                    <button onClick={() => onDelete?.(i)} className="text-[#94A3B8] hover:text-[#DC2626] transition-colors mt-1 flex-shrink-0">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── ReportViewer ───────────────────────────────────────────────────────────────
export function ReportViewer({ analysis, report }: Props) {
  const [showChat, setShowChat] = useState(false)
  const [liveReport, setLiveReport] = useState<Report | null>(report)
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState<Report | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [downloadingDocx, setDownloadingDocx] = useState(false)

  async function handleDocxDownload() {
    setDownloadingDocx(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`/api/reports/${liveReport!.id}/docx`, {
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      })
      if (!res.ok) throw new Error()
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const safe = analysis.document_name.replace(/[^a-zA-Z0-9À-ú\s-]/g, '').trim().replace(/\s+/g, '-')
      a.download = `relatorio-${safe}.docx`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setSaveError('Não foi possível gerar o arquivo DOCX.')
    } finally {
      setDownloadingDocx(false)
    }
  }

  const theme = analysis.theme as unknown as { name: string; color: string } | undefined
  const subtopic = analysis.subtopic as unknown as { name: string } | null | undefined

  const displayed = isEditing ? draft : liveReport

  function startEdit() {
    if (!liveReport) return
    setDraft(JSON.parse(JSON.stringify(liveReport)))
    setIsEditing(true)
    setSaveError(null)
  }

  function cancelEdit() {
    setDraft(null)
    setIsEditing(false)
    setSaveError(null)
  }

  async function saveEdit() {
    if (!draft || !liveReport) return
    setSaving(true)
    setSaveError(null)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`/api/reports/${liveReport.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          summary: draft.summary,
          criteria_used: draft.criteria_used,
          conforming_points: draft.conforming_points,
          partial_points: draft.partial_points,
          non_conforming_points: draft.non_conforming_points,
          improvement_suggestions: draft.improvement_suggestions,
          conclusion: draft.conclusion,
          prompt_responses: draft.prompt_responses,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao salvar')
      setLiveReport(data.report)
      setIsEditing(false)
      setDraft(null)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Erro ao salvar alterações')
    } finally {
      setSaving(false)
    }
  }

  function setField<K extends keyof Report>(key: K, value: Report[K]) {
    setDraft(d => d ? { ...d, [key]: value } : d)
  }

  function deleteFromArray(key: 'conforming_points' | 'partial_points' | 'non_conforming_points' | 'improvement_suggestions' | 'prompt_responses', index: number) {
    setDraft(d => {
      if (!d) return d
      const arr = [...(d[key] as unknown[])]
      arr.splice(index, 1)
      return { ...d, [key]: arr }
    })
  }

  function editPoint(key: 'conforming_points' | 'partial_points' | 'non_conforming_points', index: number, field: 'item' | 'description', value: string) {
    setDraft(d => {
      if (!d) return d
      const arr = [...d[key]] as CompliancePoint[]
      arr[index] = { ...arr[index], [field]: value }
      return { ...d, [key]: arr }
    })
  }

  function editSuggestion(index: number, field: 'item' | 'suggestion', value: string) {
    setDraft(d => {
      if (!d) return d
      const arr = [...d.improvement_suggestions]
      arr[index] = { ...arr[index], [field]: value }
      return { ...d, improvement_suggestions: arr }
    })
  }

  function editPromptResponse(index: number, value: string) {
    setDraft(d => {
      if (!d) return d
      const arr = [...(d.prompt_responses ?? [])]
      arr[index] = { ...arr[index], response: value }
      return { ...d, prompt_responses: arr }
    })
  }

  async function applyAiPatch(patch: Partial<Report>) {
    if (!liveReport || isEditing) return
    const updated = { ...liveReport, ...patch }
    setLiveReport(updated)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      await fetch(`/api/reports/${liveReport.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify(patch),
      })
    } catch {
      // optimistic update already applied — silently ignore save errors
    }
  }

  return (
    <div className="max-w-4xl mx-auto animate-fade-in space-y-6">
      {/* Header */}
      <div>
        {/* Row 1 — back button + document name */}
        <div className="flex items-start gap-3">
          <Link href="/analysis/history" className="flex-shrink-0 mt-0.5">
            <Button variant="ghost" size="icon" className="rounded-xl">
              <ArrowLeft size={18} />
            </Button>
          </Link>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-[#1a2a5e] dark:text-[#e2e8f0] leading-tight break-words">{analysis.document_name}</h2>
            <p className="text-sm text-[#64748B] dark:text-[#94a3b8] mt-0.5">
              {theme?.name}{subtopic?.name && ` › ${subtopic.name}`}
            </p>
          </div>
        </div>

        {/* Row 2 — action toolbar */}
        <div className="mt-3 ml-11 flex items-center gap-1 flex-wrap">
          {!isEditing && (
            <>
              {liveReport && (
                <>
                  <button
                    onClick={startEdit}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#475569] dark:text-[#94a3b8] hover:text-[#1a2a5e] dark:hover:text-[#e2e8f0] hover:bg-[#F1F5F9] dark:hover:bg-white/10 transition-colors"
                  >
                    <Pencil size={13} /> Editar
                  </button>
                  <button
                    onClick={() => window.open(`/print/${analysis.id}`, '_blank')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#475569] dark:text-[#94a3b8] hover:text-[#1a2a5e] dark:hover:text-[#e2e8f0] hover:bg-[#F1F5F9] dark:hover:bg-white/10 transition-colors"
                  >
                    <FileDown size={13} /> Gerar PDF
                  </button>
                  <button
                    onClick={handleDocxDownload}
                    disabled={downloadingDocx}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#475569] dark:text-[#94a3b8] hover:text-[#1a2a5e] dark:hover:text-[#e2e8f0] hover:bg-[#F1F5F9] dark:hover:bg-white/10 transition-colors disabled:opacity-50"
                  >
                    <FileType size={13} /> {downloadingDocx ? 'Gerando...' : 'Baixar DOCX'}
                  </button>
                  <div className="w-px h-4 bg-[#E2E8F0] dark:bg-[#1e3570] mx-1" />
                </>
              )}
              <button
                onClick={() => setShowChat(!showChat)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  showChat
                    ? 'bg-[#EEF2FF] dark:bg-[#1e3570]/60 text-[#1B3A8C] dark:text-blue-300'
                    : 'text-[#475569] dark:text-[#94a3b8] hover:text-[#1a2a5e] dark:hover:text-[#e2e8f0] hover:bg-[#F1F5F9] dark:hover:bg-white/10'
                }`}
              >
                <MessageSquare size={13} /> Assistente IA
              </button>
            </>
          )}
          {isEditing && (
            <>
              <button
                onClick={cancelEdit}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#475569] dark:text-[#94a3b8] hover:text-[#1a2a5e] dark:hover:text-[#e2e8f0] hover:bg-[#F1F5F9] dark:hover:bg-white/10 transition-colors disabled:opacity-50"
              >
                <X size={13} /> Cancelar
              </button>
              <button
                onClick={saveEdit}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#1B3A8C] text-white hover:bg-[#2D6BE4] transition-colors disabled:opacity-60"
              >
                <Save size={13} /> {saving ? 'Salvando...' : 'Salvar alterações'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Edit mode banner */}
      {isEditing && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#FEF3C7] dark:bg-amber-900/30 border border-[#FDE68A] dark:border-amber-700 text-[#92400E] dark:text-amber-200">
          <Pencil size={14} className="flex-shrink-0" />
          <p className="text-sm font-medium">Modo de edição — altere textos ou remova apontamentos. Clique em <strong>Salvar alterações</strong> para confirmar.</p>
        </div>
      )}

      {saveError && (
        <div className="px-4 py-3 rounded-xl bg-[#FEE2E2] dark:bg-red-900/30 border border-[#FECACA] dark:border-red-700 text-[#991B1B] dark:text-red-200 text-sm">
          {saveError}
        </div>
      )}

      {analysis.status === 'processing' && (
        <Card className="text-center py-10">
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#DBEAFE] dark:bg-[#1e3570]/50 flex items-center justify-center animate-pulse">
              <FileText size={24} className="text-[#1B3A8C] dark:text-blue-300" />
            </div>
            <p className="font-semibold text-[#1a2a5e] dark:text-[#e2e8f0]">Análise em andamento...</p>
            <p className="text-sm text-[#64748B] dark:text-[#94a3b8]">O relatório estará disponível em breve.</p>
          </div>
        </Card>
      )}

      {analysis.status === 'failed' && (
        <Card className="text-center py-10 border-[#FEE2E2] dark:border-red-800/50">
          <div className="flex flex-col items-center gap-3">
            <XCircle size={32} className="text-[#DC2626]" />
            <p className="font-semibold text-[#1a2a5e] dark:text-[#e2e8f0]">Erro na análise</p>
            <p className="text-sm text-[#64748B] dark:text-[#94a3b8]">{analysis.error_message ?? 'Ocorreu um erro ao processar o documento.'}</p>
          </div>
        </Card>
      )}

      {displayed && (
        <>
          {/* Prompt Responses */}
          <PromptResponsesSection
            responses={displayed.prompt_responses ?? []}
            editMode={isEditing}
            onDelete={i => deleteFromArray('prompt_responses', i)}
            onEditResponse={(i, v) => editPromptResponse(i, v)}
          />

          {/* Summary Card */}
          <Card>
            <div className="flex flex-col sm:flex-row sm:items-center gap-6">
              {/* Score */}
              <div className="flex flex-col items-center justify-center w-full sm:w-40 flex-shrink-0">
                <div className="relative w-28 h-28">
                  <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                    <circle cx="50" cy="50" r="40" fill="none" stroke="#E2E8F0" strokeWidth="8" />
                    <circle
                      cx="50" cy="50" r="40" fill="none"
                      stroke={displayed.compliance_score! >= 70 ? '#16A34A' : displayed.compliance_score! >= 40 ? '#D97706' : '#DC2626'}
                      strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 40 * (displayed.compliance_score ?? 0) / 100} ${2 * Math.PI * 40}`}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold text-[#1a2a5e] dark:text-[#e2e8f0]">{displayed.compliance_score ?? 0}%</span>
                    <span className="text-xs text-[#64748B] dark:text-[#94a3b8]">conformidade</span>
                  </div>
                </div>
              </div>

              {/* Info */}
              <div className="flex-1 space-y-3">
                <div className="flex items-center gap-3 flex-wrap">
                  {displayed.overall_compliance && <ComplianceBadge level={displayed.overall_compliance} />}
                </div>
                {isEditing ? (
                  <AutoTextarea
                    value={draft?.summary ?? ''}
                    onChange={v => setField('summary', v)}
                  />
                ) : (
                  <p className="text-sm text-[#64748B] dark:text-[#94a3b8] leading-relaxed">{displayed.summary}</p>
                )}
                <div className="flex flex-wrap gap-4 text-xs text-[#94A3B8]">
                  <div className="flex items-center gap-1.5">
                    <Calendar size={12} />
                    <span>{formatDate(displayed.created_at)}</span>
                  </div>
                  {analysis.client_name && (
                    <div className="flex items-center gap-1.5">
                      <User size={12} />
                      <span>{analysis.client_name}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Card>

          {/* Stats Row */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Conformes', count: displayed.conforming_points?.length ?? 0, color: '#16A34A', bg: '#DCFCE7' },
              { label: 'Parciais', count: displayed.partial_points?.length ?? 0, color: '#D97706', bg: '#FEF3C7' },
              { label: 'Não Conformes', count: displayed.non_conforming_points?.length ?? 0, color: '#DC2626', bg: '#FEE2E2' },
            ].map(s => (
              <Card key={s.label} className="text-center" padding="sm">
                <p className="text-2xl font-bold" style={{ color: s.color }}>{s.count}</p>
                <p className="text-xs text-[#64748B] dark:text-[#94a3b8] mt-0.5">{s.label}</p>
              </Card>
            ))}
          </div>

          {/* Criteria */}
          {(displayed.criteria_used || isEditing) && (
            <Card padding="sm">
              <p className="text-xs font-semibold text-[#1B3A8C] dark:text-blue-400 mb-1.5">Critérios utilizados na avaliação:</p>
              {isEditing ? (
                <AutoTextarea
                  value={draft?.criteria_used ?? ''}
                  onChange={v => setField('criteria_used', v)}
                />
              ) : (
                <p className="text-xs text-[#64748B] dark:text-[#94a3b8] leading-relaxed">{displayed.criteria_used}</p>
              )}
            </Card>
          )}

          {/* Points */}
          <div className="space-y-3">
            <PointsList
              points={displayed.conforming_points ?? []}
              type="conforming"
              editMode={isEditing}
              onDelete={i => deleteFromArray('conforming_points', i)}
              onEditItem={(i, v) => editPoint('conforming_points', i, 'item', v)}
              onEditDescription={(i, v) => editPoint('conforming_points', i, 'description', v)}
            />
            <PointsList
              points={displayed.partial_points ?? []}
              type="partial"
              editMode={isEditing}
              onDelete={i => deleteFromArray('partial_points', i)}
              onEditItem={(i, v) => editPoint('partial_points', i, 'item', v)}
              onEditDescription={(i, v) => editPoint('partial_points', i, 'description', v)}
            />
            <PointsList
              points={displayed.non_conforming_points ?? []}
              type="non_conforming"
              editMode={isEditing}
              onDelete={i => deleteFromArray('non_conforming_points', i)}
              onEditItem={(i, v) => editPoint('non_conforming_points', i, 'item', v)}
              onEditDescription={(i, v) => editPoint('non_conforming_points', i, 'description', v)}
            />
          </div>

          {/* Suggestions */}
          <SuggestionsList
            suggestions={displayed.improvement_suggestions ?? []}
            editMode={isEditing}
            onDelete={i => deleteFromArray('improvement_suggestions', i)}
            onEditItem={(i, v) => editSuggestion(i, 'item', v)}
            onEditSuggestion={(i, v) => editSuggestion(i, 'suggestion', v)}
          />

          {/* Conclusion */}
          {(displayed.conclusion || isEditing) && (
            <Card>
              <CardHeader>
                <CardTitle>Conclusão da Análise</CardTitle>
              </CardHeader>
              <CardContent>
                {isEditing ? (
                  <AutoTextarea
                    value={draft?.conclusion ?? ''}
                    onChange={v => setField('conclusion', v)}
                    className="min-h-[120px]"
                  />
                ) : (
                  <p className="text-sm text-[#475569] dark:text-[#94a3b8] leading-relaxed whitespace-pre-line">{displayed.conclusion}</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Save button at bottom when editing (convenience) */}
          {isEditing && (
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" onClick={cancelEdit} disabled={saving}>Cancelar</Button>
              <Button onClick={saveEdit} loading={saving} className="gap-2">
                <Save size={15} />
                {saving ? 'Salvando...' : 'Salvar alterações'}
              </Button>
            </div>
          )}
        </>
      )}

      {/* Chat */}
      {showChat && liveReport && (
        <ChatInterface
          analysisId={analysis.id}
          analysisContext={liveReport.raw_analysis ?? ''}
          documentContent={analysis.document_content ?? ''}
          themeId={analysis.theme_id}
          subtopicId={analysis.subtopic_id}
          currentReport={liveReport}
          onReportPatch={applyAiPatch}
          onClose={() => setShowChat(false)}
        />
      )}
    </div>
  )
}
