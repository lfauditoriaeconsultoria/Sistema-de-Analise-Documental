'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useDropzone } from 'react-dropzone'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Modal } from '@/components/ui/modal'
import { useToast } from '@/components/ui/toast'
import { Theme, Subtopic, OeaCriteria, OeaItem } from '@/types'
import {
  Shield, Lock, FileText, ChevronRight, ChevronLeft,
  X, CheckCircle, Loader2, AlertCircle, Upload, BookOpen,
  MessageSquare, Plus, Trash2, Pencil, Check, File, Globe, DatabaseZap,
  Link as LinkIcon, ExternalLink
} from 'lucide-react'
import { cn, formatFileSize } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

interface Props {
  themes: Theme[]
  subtopics: Subtopic[]
}

type Step = 1 | 2 | 3 | 4 | 5

interface RefDocItem {
  id: string
  name: string
  description: string | null
  file_type: string | null
  oea_criteria_id: string | null
  active: boolean
}

interface SessionPrompt {
  localId: string
  dbId?: string
  title: string
  content: string
  active: boolean
  editing: boolean
}

interface SessionRefDoc {
  localId: string
  name: string
  file_type: string | null
  content: string
  active: boolean
}

interface SessionLink {
  localId: string
  name: string
  url: string
  content: string | null
  active: boolean
  isRegistered: boolean
}

function RefDocRow({ doc, onChange }: { doc: RefDocItem; onChange: React.Dispatch<React.SetStateAction<RefDocItem[]>> }) {
  return (
    <label className={cn(
      'flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all',
      doc.active
        ? 'border-[#1B3A8C] bg-[#EEF2FF] dark:bg-[#1e3570]/40'
        : 'border-[#E2E8F0] dark:border-[#1e3570] bg-[#FAFAFA] dark:bg-[#080f2a] opacity-60'
    )}>
      <input
        type="checkbox"
        checked={doc.active}
        onChange={e => onChange(prev => prev.map(d => d.id === doc.id ? { ...d, active: e.target.checked } : d))}
        className="w-4 h-4 accent-[#1B3A8C] flex-shrink-0"
      />
      <div className="w-8 h-8 rounded-lg bg-white dark:bg-[#0f1d42] flex items-center justify-center flex-shrink-0 border border-[#E2E8F0] dark:border-[#1e3570]">
        <FileText size={14} className="text-[#1B3A8C] dark:text-blue-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[#1a2a5e] dark:text-[#e2e8f0] truncate">{doc.name}</p>
        {doc.description && <p className="text-xs text-[#64748B] dark:text-[#94a3b8] truncate">{doc.description}</p>}
      </div>
      {doc.file_type && <span className="text-xs text-[#94A3B8] flex-shrink-0">{doc.file_type.toUpperCase()}</span>}
    </label>
  )
}

const THEME_ICONS: Record<string, React.ReactNode> = {
  OEA: <Shield size={22} />,
  LGPD: <Lock size={22} />,
}

const STEP_LABELS = ['Tema', 'Subtema', 'Base de Conhecimento', 'Documento', 'Análise']

const inputCls = 'w-full h-10 px-3 rounded-lg border text-sm border-[#E2E8F0] dark:border-[#1e3570] bg-white dark:bg-[#0a1530] text-[#1a2a5e] dark:text-[#e2e8f0] placeholder:text-[#94A3B8] dark:placeholder:text-[#64748b] focus:outline-none focus:ring-2 focus:ring-[#1B3A8C] dark:focus:ring-blue-400 focus:border-transparent transition-colors'

export function NewAnalysisWizard({ themes, subtopics }: Props) {
  const router = useRouter()
  const { toast } = useToast()

  const [step, setStep] = useState<Step>(1)

  // Step 1
  const [selectedTheme, setSelectedTheme] = useState<Theme | null>(null)
  const [customThemeName, setCustomThemeName] = useState('')

  // Step 2
  const [selectedSubtopic, setSelectedSubtopic] = useState<Subtopic | null>(null)
  const [isCustomSubtopic, setIsCustomSubtopic] = useState(false)
  const [customSubtopicName, setCustomSubtopicName] = useState('')
  const [oeaCriteriaList, setOeaCriteriaList] = useState<OeaCriteria[]>([])
  const [loadingOeaCriteria, setLoadingOeaCriteria] = useState(false)
  const [selectedOeaCriteriaIds, setSelectedOeaCriteriaIds] = useState<string[]>([])
  const [selectedOeaItem, setSelectedOeaItem] = useState<OeaItem | null>(null)

  // Derived helpers
  const selectedOeaCriteriaList = oeaCriteriaList.filter(c => selectedOeaCriteriaIds.includes(c.id))
  const singleSelectedCriteria = selectedOeaCriteriaList.length === 1 ? selectedOeaCriteriaList[0] : null

  // Step 3
  const [kbTab, setKbTab] = useState<'docs' | 'prompts' | 'links'>('docs')
  const [useExternalKnowledge, setUseExternalKnowledge] = useState(false)
  const [loadingKB, setLoadingKB] = useState(false)
  const [refDocs, setRefDocs] = useState<RefDocItem[]>([])
  const [sessionDocs, setSessionDocs] = useState<SessionRefDoc[]>([])
  const [showAddDoc, setShowAddDoc] = useState(false)
  const [uploadingDoc, setUploadingDoc] = useState(false)
  const [sessionPrompts, setSessionPrompts] = useState<SessionPrompt[]>([])
  const [showAddPrompt, setShowAddPrompt] = useState(false)
  const [newPromptContent, setNewPromptContent] = useState('')
  const [sessionLinks, setSessionLinks] = useState<SessionLink[]>([])
  const [showAddLink, setShowAddLink] = useState(false)
  const [newLinkUrl, setNewLinkUrl] = useState('')
  const [newLinkName, setNewLinkName] = useState('')
  const [showKbConfirm, setShowKbConfirm] = useState(false)

  // Step 4
  const [clientName, setClientName] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [workType, setWorkType] = useState<'report' | 'adequacy'>('report')

  // Step 5
  const [analyzing, setAnalyzing] = useState(false)

  const isOthersTheme = selectedTheme?.name === 'Outros'
  const isLgpdTheme = selectedTheme?.name === 'LGPD'
  const filteredSubtopics = subtopics.filter(s => s.theme_id === selectedTheme?.id)

  useEffect(() => {
    if (step === 3 && selectedTheme) {
      void loadKnowledgeBase()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  useEffect(() => {
    if (selectedTheme?.name === 'OEA' && oeaCriteriaList.length === 0) {
      void loadOeaCriteria()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTheme])

  async function loadOeaCriteria() {
    setLoadingOeaCriteria(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const headers: HeadersInit = session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
      const res = await fetch('/api/oea-criteria', { headers })
      const json = await res.json()
      if (res.ok) setOeaCriteriaList(json.criteria ?? [])
    } catch {
      // silently fail — OEA selector is optional
    } finally {
      setLoadingOeaCriteria(false)
    }
  }

  async function loadKnowledgeBase() {
    setLoadingKB(true)
    setRefDocs([])
    setSessionPrompts([])
    setSessionLinks([])
    // sessionDocs are preserved — user additions survive step navigation
    try {
      const params = new URLSearchParams({ themeId: selectedTheme!.id })
      if (selectedSubtopic) params.set('subtopicId', selectedSubtopic.id)
      if (selectedOeaItem && singleSelectedCriteria) {
        params.set('oeaItemId', selectedOeaItem.id)
      } else if (selectedOeaCriteriaIds.length > 1) {
        params.set('oeaCriteriaIds', selectedOeaCriteriaIds.join(','))
      } else if (singleSelectedCriteria) {
        params.set('oeaCriteriaId', singleSelectedCriteria.id)
      }

      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const headers: HeadersInit = session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}

      const [docsRes, promptsRes, linksRes] = await Promise.all([
        fetch(`/api/documents?${params}`, { headers }),
        fetch(`/api/prompts?${params}`, { headers }),
        fetch(`/api/links?${params}`, { headers }),
      ])

      const docsJson = await docsRes.json()
      const promptsJson = await promptsRes.json()
      const linksJson = linksRes.ok ? await linksRes.json() : { links: [] }

      setRefDocs(
        (docsJson.documents ?? []).map((d: RefDocItem) => ({ ...d, active: false }))
      )
      setSessionPrompts(
        (promptsJson.prompts ?? []).map((p: { id: string; title: string; content: string }) => ({
          localId: crypto.randomUUID(),
          dbId: p.id,
          title: p.title,
          content: p.content,
          active: false,
          editing: false,
        }))
      )
      setSessionLinks(
        (linksJson.links ?? []).map((l: { id: string; name: string; url: string }) => ({
          localId: l.id,
          name: l.name,
          url: l.url,
          content: null,
          active: false,
          isRegistered: true,
        }))
      )
    } catch {
      toast({ type: 'error', title: 'Erro ao carregar base de conhecimento' })
    } finally {
      setLoadingKB(false)
    }
  }

  const onDrop = useCallback((accepted: File[]) => {
    if (accepted[0]) setFile(accepted[0])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt'],
      'text/csv': ['.csv'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
    },
    maxFiles: 1,
    maxSize: 4 * 1024 * 1024,
  })

  function canProceed(fromStep: Step): boolean {
    if (fromStep === 1) return !!selectedTheme && (!isOthersTheme || !!customThemeName.trim())
    if (fromStep === 2) return !isCustomSubtopic || !!customSubtopicName.trim()
    if (fromStep === 4) return !!file
    return true
  }

  async function handleStartAnalysis() {
    if (!file || !selectedTheme) return
    setStep(5)
    setAnalyzing(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('themeId', selectedTheme.id)
      if (selectedSubtopic) formData.append('subtopicId', selectedSubtopic.id)
      if (isOthersTheme && customThemeName) formData.append('customThemeName', customThemeName)
      if (isCustomSubtopic && customSubtopicName) formData.append('customSubtopicName', customSubtopicName)
      if (clientName) formData.append('clientName', clientName)
      formData.append('selectedOeaCriteriaIds', JSON.stringify(selectedOeaCriteriaIds))
      if (singleSelectedCriteria) formData.append('selectedOeaCriteriaId', singleSelectedCriteria.id)
      if (selectedOeaItem && singleSelectedCriteria) formData.append('selectedOeaItemId', selectedOeaItem.id)

      formData.append('useExternalKnowledge', String(useExternalKnowledge))
      formData.append('workType', isLgpdTheme ? workType : 'report')

      const activeDocIds = refDocs.filter(d => d.active).map(d => d.id)
      formData.append('activeRefDocIds', JSON.stringify(activeDocIds))

      const activeSessionDocs = sessionDocs
        .filter(d => d.active)
        .map(d => ({ name: d.name, file_type: d.file_type, content: d.content }))
      formData.append('sessionDocs', JSON.stringify(activeSessionDocs))

      const activePrompts = sessionPrompts
        .filter(p => p.active)
        .map(p => ({ title: p.title, content: p.content }))
      formData.append('customPrompts', JSON.stringify(activePrompts))

      const activeLinks = sessionLinks
        .filter(l => l.active)
        .map(l => ({ name: l.name, url: l.url, content: l.content }))
      formData.append('sessionLinks', JSON.stringify(activeLinks))

      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
        body: formData,
      })

      if (res.status === 413) throw new Error('Arquivo muito grande. O limite é 4MB. Reduza o tamanho do PDF ou divida o documento.')
      if (!res.headers.get('content-type')?.includes('application/json')) {
        throw new Error(`Erro no servidor (${res.status}). Tente novamente ou use um arquivo menor.`)
      }
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro na análise')

      toast({ type: 'success', title: 'Análise concluída!', description: 'O relatório foi gerado com sucesso.' })
      router.push(`/analysis/${json.analysisId}`)
    } catch (err: unknown) {
      toast({ type: 'error', title: 'Erro na análise', description: err instanceof Error ? err.message : 'Tente novamente.' })
      setStep(4)
      setAnalyzing(false)
    }
  }

  async function addSessionDoc(file: File) {
    setUploadingDoc(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/documents/extract', {
        method: 'POST',
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
        body: fd,
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro ao processar arquivo')
      setSessionDocs(prev => [...prev, {
        localId: crypto.randomUUID(),
        name: json.name,
        file_type: json.file_type,
        content: json.content,
        active: true,
      }])
      setShowAddDoc(false)
    } catch (err: unknown) {
      toast({ type: 'error', title: 'Erro ao processar documento', description: err instanceof Error ? err.message : 'Tente novamente.' })
    } finally {
      setUploadingDoc(false)
    }
  }

  function removeSessionDoc(localId: string) {
    setSessionDocs(prev => prev.filter(d => d.localId !== localId))
  }

  function addSessionPrompt() {
    if (!newPromptContent.trim()) return
    const trimmed = newPromptContent.trim()
    const autoTitle = trimmed.length > 60 ? trimmed.slice(0, 57) + '...' : trimmed
    setSessionPrompts(prev => [
      ...prev,
      {
        localId: crypto.randomUUID(),
        title: autoTitle,
        content: trimmed,
        active: true,
        editing: false,
      },
    ])
    setNewPromptContent('')
    setShowAddPrompt(false)
  }

  function updatePrompt(localId: string, patch: Partial<SessionPrompt>) {
    setSessionPrompts(prev => prev.map(p => p.localId === localId ? { ...p, ...patch } : p))
  }

  function removePrompt(localId: string) {
    setSessionPrompts(prev => prev.filter(p => p.localId !== localId))
  }

  function addOnTheFlyLink() {
    const url = newLinkUrl.trim()
    const name = newLinkName.trim() || url
    if (!url) return
    setSessionLinks(prev => [
      ...prev,
      { localId: crypto.randomUUID(), name, url, content: null, active: true, isRegistered: false },
    ])
    setNewLinkUrl('')
    setNewLinkName('')
    setShowAddLink(false)
  }

  function removeSessionLink(localId: string) {
    setSessionLinks(prev => prev.filter(l => l.localId !== localId))
  }

  const activeDocsCount = refDocs.filter(d => d.active).length + sessionDocs.filter(d => d.active).length
  const activePromptsCount = sessionPrompts.filter(p => p.active).length
  const activeLinksCount = sessionLinks.filter(l => l.active).length

  return (
    <div className="max-w-3xl mx-auto animate-fade-in">
      {/* Step indicator */}
      <div className="flex items-center justify-center gap-1 mb-8 overflow-x-auto pb-1">
        {STEP_LABELS.map((label, idx) => {
          const n = (idx + 1) as Step
          const done = step > n
          const active = step === n
          return (
            <div key={n} className="flex items-center gap-1 flex-shrink-0">
              <div className="flex flex-col items-center gap-1">
                <div
                  className={cn(
                    'flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold transition-all',
                    done ? 'bg-[#16A34A] text-white' : active ? 'bg-[#1B3A8C] text-white shadow-lg' : 'bg-[#E2E8F0] dark:bg-[#1e3570] text-[#94A3B8] dark:text-[#64748b]'
                  )}
                >
                  {done ? <CheckCircle size={14} /> : n}
                </div>
                <span className={cn('text-xs hidden sm:block whitespace-nowrap', active ? 'text-[#1B3A8C] dark:text-blue-400 font-medium' : 'text-[#94A3B8]')}>
                  {label}
                </span>
              </div>
              {idx < STEP_LABELS.length - 1 && (
                <div className={cn('w-6 h-0.5 mb-4', done ? 'bg-[#16A34A]' : 'bg-[#E2E8F0] dark:bg-[#1e3570]')} />
              )}
            </div>
          )
        })}
      </div>

      {/* ── Step 1: Theme ── */}
      {step === 1 && (
        <Card>
          <div className="mb-6">
            <h2 className="text-xl font-bold text-[#1a2a5e] dark:text-[#e2e8f0]">Selecione o tema da análise</h2>
            <p className="text-[#64748B] dark:text-[#94a3b8] text-sm mt-1">Qual é o tema principal do documento do cliente?</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {themes.map(theme => (
              <button
                key={theme.id}
                onClick={() => { setSelectedTheme(theme); setSelectedSubtopic(null); setIsCustomSubtopic(false); setCustomThemeName(''); setSelectedOeaCriteriaIds([]); setSelectedOeaItem(null) }}
                className={cn(
                  'flex flex-col items-center gap-3 p-5 rounded-xl border-2 text-center transition-all',
                  selectedTheme?.id === theme.id
                    ? 'border-[#1B3A8C] bg-[#EEF2FF] dark:bg-[#1e3570]/50'
                    : 'border-[#E2E8F0] dark:border-[#1e3570] hover:border-[#1B3A8C] hover:bg-[#F8FAFC] dark:hover:bg-[#1e3570]/30'
                )}
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-white"
                  style={{ backgroundColor: theme.color ?? '#64748B' }}
                >
                  {THEME_ICONS[theme.name] ?? <File size={22} />}
                </div>
                <div>
                  <p className="font-bold text-[#1a2a5e] dark:text-[#e2e8f0]">{theme.name}</p>
                  <p className="text-xs text-[#64748B] dark:text-[#94a3b8] mt-0.5 leading-tight">{theme.description}</p>
                </div>
                {selectedTheme?.id === theme.id && (
                  <CheckCircle size={16} className="text-[#1B3A8C] dark:text-blue-400" />
                )}
              </button>
            ))}
          </div>

          {isOthersTheme && (
            <div className="mt-4 flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[#1a2a5e] dark:text-[#e2e8f0]">Especifique o tema *</label>
              <input
                type="text"
                placeholder="Ex: Compliance Ambiental, Norma ISO 9001..."
                value={customThemeName}
                onChange={e => setCustomThemeName(e.target.value)}
                className={inputCls}
              />
            </div>
          )}

          <div className="flex justify-end mt-6">
            <Button onClick={() => setStep(2)} disabled={!canProceed(1)}>
              Próximo <ChevronRight size={16} />
            </Button>
          </div>
        </Card>
      )}

      {/* ── Step 2: Subtopic / OEA Criteria ── */}
      {step === 2 && (
        <Card>
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-1">
              <div
                className="w-6 h-6 rounded-md flex items-center justify-center text-white text-xs font-bold"
                style={{ backgroundColor: selectedTheme?.color ?? '#64748B' }}
              >
                {selectedTheme?.name?.charAt(0)}
              </div>
              <span className="text-xs font-medium text-[#64748B] dark:text-[#94a3b8]">{isOthersTheme ? customThemeName : selectedTheme?.name}</span>
            </div>
            {selectedTheme?.name === 'OEA' ? (
              <>
                <h2 className="text-xl font-bold text-[#1a2a5e] dark:text-[#e2e8f0]">Selecione os critérios</h2>
                <p className="text-[#64748B] dark:text-[#94a3b8] text-sm mt-1">Pode selecionar mais de um critério OEA. (opcional)</p>
              </>
            ) : (
              <>
                <h2 className="text-xl font-bold text-[#1a2a5e] dark:text-[#e2e8f0]">Selecione o subtema</h2>
                <p className="text-[#64748B] dark:text-[#94a3b8] text-sm mt-1">Qual aspecto será analisado? (opcional)</p>
              </>
            )}
          </div>

          {/* OEA theme: criteria list */}
          {selectedTheme?.name === 'OEA' ? (
            loadingOeaCriteria ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-[#64748B] dark:text-[#94a3b8]">
                <Loader2 size={16} className="animate-spin text-[#1B3A8C]" />
                Carregando critérios...
              </div>
            ) : (
              <div>
                {selectedOeaCriteriaIds.length > 0 && (
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#1B3A8C] dark:text-blue-400">
                      {selectedOeaCriteriaIds.length} critério(s) selecionado(s)
                    </span>
                    <button
                      onClick={() => { setSelectedOeaCriteriaIds([]); setSelectedOeaItem(null) }}
                      className="text-xs text-[#64748B] dark:text-[#94a3b8] hover:text-[#DC2626] underline"
                    >
                      Limpar seleção
                    </button>
                  </div>
                )}

                <div className="max-h-72 overflow-y-auto pr-1">
                  {(['geral', 'seguranca', 'conformidade'] as const).map(cat => {
                    const criteria = oeaCriteriaList.filter(c => c.category === cat)
                    if (!criteria.length) return null
                    const catLabel = cat === 'geral' ? 'Critérios Gerais' : cat === 'seguranca' ? 'Critérios de Segurança' : 'Critérios de Conformidade'
                    return (
                      <div key={cat}>
                        <p className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wide px-1 pt-3 pb-1.5">{catLabel}</p>
                        <div className="space-y-1">
                          {criteria.map(criterion => {
                            const isSelected = selectedOeaCriteriaIds.includes(criterion.id)
                            return (
                              <button
                                key={criterion.id}
                                onClick={() => {
                                  setSelectedOeaCriteriaIds(prev =>
                                    prev.includes(criterion.id)
                                      ? prev.filter(id => id !== criterion.id)
                                      : [...prev, criterion.id]
                                  )
                                  if (isSelected) setSelectedOeaItem(null)
                                }}
                                className={cn(
                                  'w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all',
                                  isSelected
                                    ? 'border-[#1B3A8C] bg-[#EEF2FF] dark:bg-[#1e3570]/50'
                                    : 'border-[#E2E8F0] dark:border-[#1e3570] hover:border-[#1B3A8C] hover:bg-[#F8FAFC] dark:hover:bg-[#1e3570]/30'
                                )}
                              >
                                <div className={cn(
                                  'w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors',
                                  isSelected
                                    ? 'bg-[#1B3A8C] border-[#1B3A8C]'
                                    : 'bg-white dark:bg-[#0a1530] border-[#CBD5E1] dark:border-[#1e3570]'
                                )}>
                                  {isSelected && <Check size={10} className="text-white" />}
                                </div>
                                <span className="text-sm font-medium text-[#1a2a5e] dark:text-[#e2e8f0]">{criterion.number}. {criterion.name}</span>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Items sub-selection: only when exactly 1 criteria selected */}
                {singleSelectedCriteria && (
                  <div className="mt-4 p-4 rounded-xl bg-[#F8FAFC] dark:bg-[#0a1530] border border-[#E2E8F0] dark:border-[#1e3570]">
                    <p className="text-sm font-semibold text-[#1a2a5e] dark:text-[#e2e8f0] mb-0.5">
                      Item/Subitem do Critério {singleSelectedCriteria.number} <span className="font-normal text-[#64748B] dark:text-[#94a3b8]">(opcional)</span>
                    </p>
                    <p className="text-xs text-[#64748B] dark:text-[#94a3b8] mb-3">Especifique um requisito para focar a análise</p>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                      {(singleSelectedCriteria.items ?? []).map(item => (
                        <button
                          key={item.id}
                          onClick={() => setSelectedOeaItem(prev => prev?.id === item.id ? null : item)}
                          className={cn(
                            'w-full flex items-start gap-3 px-3 py-2.5 rounded-lg border text-left transition-all',
                            selectedOeaItem?.id === item.id
                              ? 'border-[#1B3A8C] bg-[#EEF2FF] dark:bg-[#1e3570]/50'
                              : 'border-[#E2E8F0] dark:border-[#1e3570] bg-white dark:bg-[#0f1d42] hover:border-[#1B3A8C] hover:bg-[#F8FAFC] dark:hover:bg-[#1e3570]/30'
                          )}
                        >
                          <span className={cn(
                            'text-xs font-bold mt-0.5 flex-shrink-0 min-w-[2rem]',
                            selectedOeaItem?.id === item.id ? 'text-[#1B3A8C] dark:text-blue-400' : 'text-[#94A3B8]'
                          )}>
                            {item.item_number}
                          </span>
                          <span className="text-xs text-[#1a2a5e] dark:text-[#e2e8f0] line-clamp-2">{item.description}</span>
                          {selectedOeaItem?.id === item.id && (
                            <CheckCircle size={12} className="text-[#1B3A8C] dark:text-blue-400 ml-auto flex-shrink-0 mt-0.5" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          ) : isOthersTheme ? (
            /* Outros theme: custom text input */
            <div className="space-y-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-[#1a2a5e] dark:text-[#e2e8f0]">Subtema (opcional)</label>
                <input
                  type="text"
                  placeholder="Ex: Gestão de Resíduos, Certificação..."
                  value={customSubtopicName}
                  onChange={e => setCustomSubtopicName(e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>
          ) : (
            /* Other themes: subtopics list */
            <div>
              {filteredSubtopics.length === 0 && (
                <div className="text-center py-8 text-[#94A3B8]">
                  <AlertCircle size={28} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Nenhum subtema cadastrado para este tema</p>
                </div>
              )}
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {filteredSubtopics.map(sub => (
                  <button
                    key={sub.id}
                    onClick={() => { setSelectedSubtopic(sub); setIsCustomSubtopic(false); setCustomSubtopicName('') }}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all',
                      selectedSubtopic?.id === sub.id && !isCustomSubtopic
                        ? 'border-[#1B3A8C] bg-[#EEF2FF] dark:bg-[#1e3570]/50'
                        : 'border-[#E2E8F0] dark:border-[#1e3570] hover:border-[#1B3A8C] hover:bg-[#F8FAFC] dark:hover:bg-[#1e3570]/30'
                    )}
                  >
                    <div className={cn(
                      'w-2 h-2 rounded-full flex-shrink-0',
                      selectedSubtopic?.id === sub.id && !isCustomSubtopic ? 'bg-[#1B3A8C]' : 'bg-[#CBD5E1] dark:bg-[#1e3570]'
                    )} />
                    <span className="text-sm font-medium text-[#1a2a5e] dark:text-[#e2e8f0]">{sub.name}</span>
                    {selectedSubtopic?.id === sub.id && !isCustomSubtopic && (
                      <CheckCircle size={14} className="text-[#1B3A8C] dark:text-blue-400 ml-auto flex-shrink-0" />
                    )}
                  </button>
                ))}

                <button
                  onClick={() => { setIsCustomSubtopic(true); setSelectedSubtopic(null) }}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all',
                    isCustomSubtopic
                      ? 'border-[#1B3A8C] bg-[#EEF2FF] dark:bg-[#1e3570]/50'
                      : 'border-[#E2E8F0] dark:border-[#1e3570] hover:border-[#1B3A8C] hover:bg-[#F8FAFC] dark:hover:bg-[#1e3570]/30'
                  )}
                >
                  <div className={cn('w-2 h-2 rounded-full flex-shrink-0', isCustomSubtopic ? 'bg-[#1B3A8C]' : 'bg-[#CBD5E1] dark:bg-[#1e3570]')} />
                  <span className="text-sm font-medium text-[#1a2a5e] dark:text-[#e2e8f0]">Outros (especificar)</span>
                  {isCustomSubtopic && <CheckCircle size={14} className="text-[#1B3A8C] dark:text-blue-400 ml-auto flex-shrink-0" />}
                </button>

                {isCustomSubtopic && (
                  <div className="pl-1 pt-1 flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-[#1a2a5e] dark:text-[#e2e8f0]">Especifique o subtema *</label>
                    <input
                      type="text"
                      placeholder="Ex: Habilitação Aduaneira Especial..."
                      value={customSubtopicName}
                      onChange={e => setCustomSubtopicName(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-between mt-6">
            <Button variant="secondary" onClick={() => setStep(1)}>
              <ChevronLeft size={16} /> Voltar
            </Button>
            <Button onClick={() => setStep(3)} disabled={!canProceed(2)}>
              {selectedTheme?.name === 'OEA'
                ? (selectedOeaCriteriaIds.length === 0 ? 'Pular' : 'Próximo')
                : (!selectedSubtopic && !isCustomSubtopic && !customSubtopicName ? 'Pular' : 'Próximo')
              } <ChevronRight size={16} />
            </Button>
          </div>
        </Card>
      )}

      {/* ── Step 3: Knowledge Base ── */}
      {step === 3 && (
        <Card>
          <div className="mb-5">
            <h2 className="text-xl font-bold text-[#1a2a5e] dark:text-[#e2e8f0]">Base de Conhecimento</h2>
            <p className="text-[#64748B] dark:text-[#94a3b8] text-sm mt-1">
              Revise os documentos e prompts que guiarão a análise. Você pode ajustá-los para esta sessão sem alterar os padrões.
            </p>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 p-1 bg-[#F1F5F9] dark:bg-[#0a1530] rounded-xl mb-5">
            <button
              onClick={() => setKbTab('docs')}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all',
                kbTab === 'docs'
                  ? 'bg-white dark:bg-[#0f1d42] text-[#1a2a5e] dark:text-[#e2e8f0] shadow-sm'
                  : 'text-[#64748B] dark:text-[#94a3b8] hover:text-[#1a2a5e] dark:hover:text-[#e2e8f0]'
              )}
            >
              <BookOpen size={15} />
              Documentos de Referência
              <span className={cn(
                'text-xs px-1.5 py-0.5 rounded-full font-bold',
                kbTab === 'docs'
                  ? 'bg-[#EEF2FF] dark:bg-[#1e3570] text-[#1B3A8C] dark:text-blue-300'
                  : 'bg-[#E2E8F0] dark:bg-[#1e3570]/60 text-[#64748B] dark:text-[#94a3b8]'
              )}>
                {activeDocsCount}
              </span>
            </button>
            <button
              onClick={() => setKbTab('prompts')}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all',
                kbTab === 'prompts'
                  ? 'bg-white dark:bg-[#0f1d42] text-[#1a2a5e] dark:text-[#e2e8f0] shadow-sm'
                  : 'text-[#64748B] dark:text-[#94a3b8] hover:text-[#1a2a5e] dark:hover:text-[#e2e8f0]'
              )}
            >
              <MessageSquare size={15} />
              Prompts Auxiliares
              <span className={cn(
                'text-xs px-1.5 py-0.5 rounded-full font-bold',
                kbTab === 'prompts'
                  ? 'bg-[#EEF2FF] dark:bg-[#1e3570] text-[#1B3A8C] dark:text-blue-300'
                  : 'bg-[#E2E8F0] dark:bg-[#1e3570]/60 text-[#64748B] dark:text-[#94a3b8]'
              )}>
                {activePromptsCount}
              </span>
            </button>
            <button
              onClick={() => setKbTab('links')}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all',
                kbTab === 'links'
                  ? 'bg-white dark:bg-[#0f1d42] text-[#1a2a5e] dark:text-[#e2e8f0] shadow-sm'
                  : 'text-[#64748B] dark:text-[#94a3b8] hover:text-[#1a2a5e] dark:hover:text-[#e2e8f0]'
              )}
            >
              <LinkIcon size={15} />
              Links
              <span className={cn(
                'text-xs px-1.5 py-0.5 rounded-full font-bold',
                kbTab === 'links'
                  ? 'bg-[#EEF2FF] dark:bg-[#1e3570] text-[#1B3A8C] dark:text-blue-300'
                  : 'bg-[#E2E8F0] dark:bg-[#1e3570]/60 text-[#64748B] dark:text-[#94a3b8]'
              )}>
                {activeLinksCount}
              </span>
            </button>
          </div>

          {/* Docs tab */}
          {kbTab === 'docs' && (
            <div className="space-y-2 min-h-32">
              {loadingKB ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 size={24} className="animate-spin text-[#1B3A8C]" />
                </div>
              ) : (
                <>
                  {refDocs.length === 0 && sessionDocs.length === 0 && !showAddDoc && (
                    <div className="text-center py-8 text-[#94A3B8]">
                      <BookOpen size={28} className="mx-auto mb-2 opacity-40" />
                      <p className="text-sm">Nenhum documento de referência configurado para este tema/subtema</p>
                      <p className="text-xs mt-1">Adicione documentos abaixo ou peça a um administrador para configurar os padrões</p>
                    </div>
                  )}

                  {/* Admin default docs — grouped by criteria when multiple selected */}
                  {(() => {
                    const showGrouped = selectedOeaCriteriaIds.length > 1
                    if (!showGrouped) {
                      return refDocs.map(doc => <RefDocRow key={doc.id} doc={doc} onChange={setRefDocs} />)
                    }
                    // Build groups: one per selected criteria + one "Geral" for unassigned docs
                    const groups: Array<{ label: string; docs: RefDocItem[] }> = selectedOeaCriteriaList.map(c => ({
                      label: `Critério ${c.number} — ${c.name}`,
                      docs: refDocs.filter(d => d.oea_criteria_id === c.id),
                    }))
                    const generalDocs = refDocs.filter(d => !d.oea_criteria_id)
                    if (generalDocs.length > 0) groups.push({ label: 'Documentos Gerais', docs: generalDocs })
                    return groups.map(group => group.docs.length === 0 ? null : (
                      <div key={group.label}>
                        <p className="text-xs font-semibold text-[#1B3A8C] dark:text-blue-400 uppercase tracking-wide px-1 pt-3 pb-1.5 border-t border-[#E2E8F0] dark:border-[#1e3570] first:border-t-0 first:pt-0">
                          {group.label}
                        </p>
                        <div className="space-y-2">
                          {group.docs.map(doc => <RefDocRow key={doc.id} doc={doc} onChange={setRefDocs} />)}
                        </div>
                      </div>
                    ))
                  })()}

                  {/* Session docs added by user — toggle + delete */}
                  {sessionDocs.map(doc => (
                    <div
                      key={doc.localId}
                      className={cn(
                        'flex items-center gap-3 p-3 rounded-xl border-2 transition-all',
                        doc.active
                          ? 'border-[#1B3A8C] bg-[#EEF2FF] dark:bg-[#1e3570]/40'
                          : 'border-[#E2E8F0] dark:border-[#1e3570] bg-[#FAFAFA] dark:bg-[#080f2a] opacity-60'
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={doc.active}
                        onChange={e => setSessionDocs(prev => prev.map(d => d.localId === doc.localId ? { ...d, active: e.target.checked } : d))}
                        className="w-4 h-4 accent-[#1B3A8C] flex-shrink-0"
                      />
                      <div className="w-8 h-8 rounded-lg bg-white dark:bg-[#0f1d42] flex items-center justify-center flex-shrink-0 border border-[#E2E8F0] dark:border-[#1e3570]">
                        <FileText size={14} className="text-[#1B3A8C] dark:text-blue-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#1a2a5e] dark:text-[#e2e8f0] truncate">{doc.name}</p>
                        <p className="text-xs text-[#94A3B8]">Adicionado nesta sessão</p>
                      </div>
                      {doc.file_type && (
                        <span className="text-xs text-[#94A3B8] flex-shrink-0">{doc.file_type.toUpperCase()}</span>
                      )}
                      <button
                        onClick={() => removeSessionDoc(doc.localId)}
                        className="p-1.5 rounded-lg text-[#64748B] dark:text-[#94a3b8] hover:text-[#DC2626] hover:bg-[#FEE2E2] dark:hover:bg-red-900/30 transition-colors flex-shrink-0"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}

                </>
              )}
            </div>
          )}

          {/* Prompts tab */}
          {kbTab === 'prompts' && (
            <div className="space-y-3 min-h-32">
              {loadingKB ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 size={24} className="animate-spin text-[#1B3A8C]" />
                </div>
              ) : (
                <>
                  {sessionPrompts.length === 0 && !showAddPrompt && (
                    <div className="text-center py-8 text-[#94A3B8]">
                      <MessageSquare size={28} className="mx-auto mb-2 opacity-40" />
                      <p className="text-sm">Nenhum prompt auxiliar configurado</p>
                      <p className="text-xs mt-1">Adicione instruções específicas para guiar a análise</p>
                    </div>
                  )}

                  {sessionPrompts.map(prompt => (
                    <div
                      key={prompt.localId}
                      className={cn(
                        'rounded-xl border-2 overflow-hidden transition-all',
                        prompt.active ? 'border-[#E2E8F0] dark:border-[#1e3570]' : 'border-[#E2E8F0] dark:border-[#1e3570] opacity-50'
                      )}
                    >
                      <div className="flex items-center gap-2 px-3 py-2 bg-[#F8FAFC] dark:bg-[#0a1530]">
                        <input
                          type="checkbox"
                          checked={prompt.active}
                          onChange={e => updatePrompt(prompt.localId, { active: e.target.checked })}
                          className="w-4 h-4 accent-[#1B3A8C] flex-shrink-0"
                        />
                        <span className="text-sm font-semibold text-[#1a2a5e] dark:text-[#e2e8f0] flex-1 truncate">{prompt.title}</span>
                        <button
                          onClick={() => updatePrompt(prompt.localId, { editing: !prompt.editing })}
                          className="p-1.5 rounded-lg text-[#64748B] dark:text-[#94a3b8] hover:text-[#1B3A8C] dark:hover:text-blue-400 hover:bg-[#EEF2FF] dark:hover:bg-[#1e3570]/50 transition-colors"
                        >
                          {prompt.editing ? <Check size={14} /> : <Pencil size={14} />}
                        </button>
                        <button
                          onClick={() => removePrompt(prompt.localId)}
                          className="p-1.5 rounded-lg text-[#64748B] dark:text-[#94a3b8] hover:text-[#DC2626] hover:bg-[#FEE2E2] dark:hover:bg-red-900/30 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      {prompt.editing ? (
                        <textarea
                          value={prompt.content}
                          onChange={e => updatePrompt(prompt.localId, { content: e.target.value })}
                          rows={4}
                          className="w-full px-3 py-2 text-sm text-[#1a2a5e] dark:text-[#e2e8f0] border-t border-[#E2E8F0] dark:border-[#1e3570] bg-white dark:bg-[#0f1d42] resize-none focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#1B3A8C] dark:focus:ring-blue-400"
                        />
                      ) : (
                        <p className="px-3 py-2 text-sm text-[#64748B] dark:text-[#94a3b8] whitespace-pre-wrap line-clamp-3">{prompt.content}</p>
                      )}
                    </div>
                  ))}

                  {showAddPrompt ? (
                    <div className="rounded-xl border-2 border-dashed border-[#1B3A8C] dark:border-blue-500/50 p-4 space-y-3">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium text-[#1a2a5e] dark:text-[#e2e8f0]">Instrução</label>
                        <textarea
                          // eslint-disable-next-line jsx-a11y/no-autofocus
                          autoFocus
                          placeholder="Escreva aqui a instrução específica para guiar a análise..."
                          value={newPromptContent}
                          onChange={e => setNewPromptContent(e.target.value)}
                          rows={3}
                          className="w-full px-3 py-2 rounded-lg border text-sm resize-none border-[#E2E8F0] dark:border-[#1e3570] bg-white dark:bg-[#0a1530] text-[#1a2a5e] dark:text-[#e2e8f0] placeholder:text-[#94A3B8] dark:placeholder:text-[#64748b] focus:outline-none focus:ring-2 focus:ring-[#1B3A8C] dark:focus:ring-blue-400 focus:border-transparent transition-colors"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={addSessionPrompt}
                          disabled={!newPromptContent.trim()}
                        >
                          <Check size={14} /> Adicionar
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => { setShowAddPrompt(false); setNewPromptContent('') }}
                        >
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button variant="secondary" size="sm" onClick={() => setShowAddPrompt(true)} className="w-full">
                      <Plus size={14} /> Adicionar prompt para esta sessão
                    </Button>
                  )}
                </>
              )}
            </div>
          )}

          {/* Links tab */}
          {kbTab === 'links' && (
            <div className="space-y-2 min-h-32">
              {loadingKB ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 size={24} className="animate-spin text-[#1B3A8C]" />
                </div>
              ) : (
                <>
                  {sessionLinks.length === 0 && !showAddLink && (
                    <div className="text-center py-8 text-[#94A3B8]">
                      <LinkIcon size={28} className="mx-auto mb-2 opacity-40" />
                      <p className="text-sm">Nenhum link externo cadastrado</p>
                      <p className="text-xs mt-1">Adicione um link abaixo para a IA acessar durante a análise</p>
                    </div>
                  )}

                  {/* Registered links — toggle only */}
                  {sessionLinks.filter(l => l.isRegistered).map(link => (
                    <label
                      key={link.localId}
                      className={cn(
                        'flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all',
                        link.active
                          ? 'border-[#1B3A8C] bg-[#EEF2FF] dark:bg-[#1e3570]/40'
                          : 'border-[#E2E8F0] dark:border-[#1e3570] bg-[#FAFAFA] dark:bg-[#080f2a] opacity-60'
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={link.active}
                        onChange={e => setSessionLinks(prev => prev.map(l => l.localId === link.localId ? { ...l, active: e.target.checked } : l))}
                        className="w-4 h-4 accent-[#1B3A8C] flex-shrink-0"
                      />
                      <div className="w-8 h-8 rounded-lg bg-white dark:bg-[#0f1d42] flex items-center justify-center flex-shrink-0 border border-[#E2E8F0] dark:border-[#1e3570]">
                        <Globe size={14} className="text-[#1B3A8C] dark:text-blue-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#1a2a5e] dark:text-[#e2e8f0] truncate">{link.name}</p>
                        <p className="text-xs text-[#64748B] dark:text-[#94a3b8] truncate">{link.url}</p>
                      </div>
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="p-1.5 rounded-lg text-[#64748B] dark:text-[#94a3b8] hover:text-[#1B3A8C] dark:hover:text-blue-400 transition-colors flex-shrink-0"
                      >
                        <ExternalLink size={13} />
                      </a>
                    </label>
                  ))}

                  {/* On-the-fly links — toggle + delete */}
                  {sessionLinks.filter(l => !l.isRegistered).map(link => (
                    <div
                      key={link.localId}
                      className={cn(
                        'flex items-center gap-3 p-3 rounded-xl border-2 transition-all',
                        link.active
                          ? 'border-[#1B3A8C] bg-[#EEF2FF] dark:bg-[#1e3570]/40'
                          : 'border-[#E2E8F0] dark:border-[#1e3570] bg-[#FAFAFA] dark:bg-[#080f2a] opacity-60'
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={link.active}
                        onChange={e => setSessionLinks(prev => prev.map(l => l.localId === link.localId ? { ...l, active: e.target.checked } : l))}
                        className="w-4 h-4 accent-[#1B3A8C] flex-shrink-0"
                      />
                      <div className="w-8 h-8 rounded-lg bg-white dark:bg-[#0f1d42] flex items-center justify-center flex-shrink-0 border border-[#E2E8F0] dark:border-[#1e3570]">
                        <LinkIcon size={14} className="text-[#1B3A8C] dark:text-blue-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#1a2a5e] dark:text-[#e2e8f0] truncate">{link.name}</p>
                        <p className="text-xs text-[#64748B] dark:text-[#94a3b8] truncate">{link.url}</p>
                      </div>
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-lg text-[#64748B] dark:text-[#94a3b8] hover:text-[#1B3A8C] dark:hover:text-blue-400 transition-colors flex-shrink-0"
                      >
                        <ExternalLink size={13} />
                      </a>
                      <button
                        onClick={() => removeSessionLink(link.localId)}
                        className="p-1.5 rounded-lg text-[#64748B] dark:text-[#94a3b8] hover:text-[#DC2626] hover:bg-[#FEE2E2] dark:hover:bg-red-900/30 transition-colors flex-shrink-0"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}

                  {/* Add link form or button */}
                  {showAddLink ? (
                    <div className="rounded-xl border-2 border-dashed border-[#1B3A8C] dark:border-blue-500/50 p-4 space-y-3">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium text-[#1a2a5e] dark:text-[#e2e8f0]">URL</label>
                        <input
                          type="url"
                          // eslint-disable-next-line jsx-a11y/no-autofocus
                          autoFocus
                          placeholder="https://exemplo.com/norma"
                          value={newLinkUrl}
                          onChange={e => setNewLinkUrl(e.target.value)}
                          className={inputCls}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium text-[#1a2a5e] dark:text-[#e2e8f0]">
                          Nome <span className="text-[#94A3B8] font-normal">(opcional)</span>
                        </label>
                        <input
                          type="text"
                          placeholder="Nome do link"
                          value={newLinkName}
                          onChange={e => setNewLinkName(e.target.value)}
                          className={inputCls}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={addOnTheFlyLink} disabled={!newLinkUrl.trim()}>
                          <Check size={14} /> Adicionar
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => { setShowAddLink(false); setNewLinkUrl(''); setNewLinkName('') }}>
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button variant="secondary" size="sm" onClick={() => setShowAddLink(true)} className="w-full">
                      <Plus size={14} /> Adicionar link para esta sessão
                    </Button>
                  )}
                </>
              )}
            </div>
          )}

          {/* Fonte de conhecimento da IA */}
          <div className="mt-5 pt-5 border-t border-[#E2E8F0] dark:border-[#1e3570]">
            <p className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wide mb-3">Fonte de Conhecimento da IA</p>
            <button
              type="button"
              onClick={() => setUseExternalKnowledge(prev => !prev)}
              className={cn(
                'w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all',
                useExternalKnowledge
                  ? 'border-[#1B3A8C] bg-[#EEF2FF] dark:bg-[#1e3570]/40'
                  : 'border-[#E2E8F0] dark:border-[#1e3570] bg-[#F8FAFC] dark:bg-[#0a1530]'
              )}
            >
              <div className={cn(
                'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors',
                useExternalKnowledge ? 'bg-[#1B3A8C] text-white' : 'bg-[#E2E8F0] dark:bg-[#1e3570] text-[#94A3B8] dark:text-[#64748b]'
              )}>
                {useExternalKnowledge ? <Globe size={18} /> : <DatabaseZap size={18} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#1a2a5e] dark:text-[#e2e8f0]">
                  Conhecimento externo habilitado
                </p>
                <p className="text-xs text-[#64748B] dark:text-[#94a3b8] mt-0.5 leading-relaxed">
                  A IA poderá consultar o conhecimento externo armazenado no Claude AI.
                </p>
              </div>
              <div className={cn(
                'relative w-11 h-6 rounded-full transition-colors flex-shrink-0',
                useExternalKnowledge ? 'bg-[#1B3A8C]' : 'bg-[#CBD5E1] dark:bg-[#475569]'
              )}>
                <span className={cn(
                  'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform',
                  useExternalKnowledge ? 'translate-x-5' : 'translate-x-0.5'
                )} />
              </div>
            </button>
          </div>

          <div className="flex justify-between mt-6">
            <Button variant="secondary" onClick={() => setStep(2)}>
              <ChevronLeft size={16} /> Voltar
            </Button>
            <Button onClick={() => {
              const hasSelection = activeDocsCount > 0 || activePromptsCount > 0 || activeLinksCount > 0
              if (!hasSelection) {
                setShowKbConfirm(true)
              } else {
                setStep(4)
              }
            }}>
              Próximo <ChevronRight size={16} />
            </Button>
          </div>
        </Card>
      )}

      {/* ── Confirmation: proceed without KB ── */}
      <Modal
        open={showKbConfirm}
        onOpenChange={setShowKbConfirm}
        title="Continuar sem Base de Conhecimento?"
        size="sm"
      >
        <div className="space-y-5">
          <p className="text-sm text-[#64748B] dark:text-[#94a3b8] leading-relaxed">
            Deseja prosseguir com a análise sem utilizar nenhuma fonte de conhecimento cadastrada na Base de Conhecimento?
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setShowKbConfirm(false)}>
              Cancelar
            </Button>
            <Button onClick={() => {
              setShowKbConfirm(false)
              if (useExternalKnowledge) {
                setStep(4)
              } else {
                toast({
                  type: 'error',
                  title: 'Não é possível prosseguir',
                  description: 'Nenhuma fonte de conhecimento foi selecionada e a busca externa de informações está desabilitada. Selecione ao menos uma fonte da Base de Conhecimento ou habilite a busca externa para continuar.',
                })
              }
            }}>
              Sim, prosseguir
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Step 4: Document Upload ── */}
      {step === 4 && (
        <Card>
          <div className="mb-6">
            <h2 className="text-xl font-bold text-[#1a2a5e] dark:text-[#e2e8f0]">Envie o documento do cliente</h2>
            <p className="text-[#64748B] dark:text-[#94a3b8] text-sm mt-1">
              {isOthersTheme ? customThemeName : selectedTheme?.name}
              {(selectedSubtopic || customSubtopicName) && (
                <> › {isCustomSubtopic ? customSubtopicName : selectedSubtopic?.name}</>
              )}
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[#1a2a5e] dark:text-[#e2e8f0]">
                Nome / Empresa do cliente <span className="text-[#94A3B8] font-normal">(opcional)</span>
              </label>
              <input
                type="text"
                placeholder="Ex: Empresa ABC Ltda"
                value={clientName}
                onChange={e => setClientName(e.target.value)}
                className={inputCls}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-[#1a2a5e] dark:text-[#e2e8f0] block mb-1.5">Documento para análise *</label>
              {!file ? (
                <div
                  {...getRootProps()}
                  className={cn('drop-zone rounded-xl p-10 text-center cursor-pointer', isDragActive && 'active')}
                >
                  <input {...getInputProps()} />
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-14 h-14 rounded-2xl bg-[#EEF2FF] dark:bg-[#1e3570]/60 flex items-center justify-center">
                      <Upload size={24} className="text-[#1B3A8C] dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[#1a2a5e] dark:text-[#e2e8f0]">
                        {isDragActive ? 'Solte o arquivo aqui' : 'Arraste o arquivo ou clique para selecionar'}
                      </p>
                      <p className="text-xs text-[#64748B] dark:text-[#94a3b8] mt-1">PDF, DOCX, TXT, CSV, JPG, PNG, WEBP — máx. 4MB</p>
                    </div>
                    <Button type="button" variant="secondary" size="sm">Selecionar arquivo</Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-4 p-4 rounded-xl border-2 border-[#16A34A] bg-[#F0FDF4] dark:bg-green-900/20">
                  <div className="w-12 h-12 rounded-xl bg-[#16A34A] flex items-center justify-center text-white flex-shrink-0">
                    <FileText size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-[#1a2a5e] dark:text-[#e2e8f0] truncate">{file.name}</p>
                    <p className="text-xs text-[#64748B] dark:text-[#94a3b8]">{formatFileSize(file.size)}</p>
                  </div>
                  <button
                    onClick={() => setFile(null)}
                    className="p-1.5 rounded-lg text-[#64748B] dark:text-[#94a3b8] hover:text-[#DC2626] hover:bg-[#FEE2E2] dark:hover:bg-red-900/30 transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}
            </div>

            {/* Work type selector — LGPD only */}
            {isLgpdTheme && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-[#1a2a5e] dark:text-[#e2e8f0] block">
                  Tipo de trabalho <span className="text-[#DC2626]">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setWorkType('report')}
                    className={cn(
                      'p-4 rounded-xl border-2 text-left transition-all',
                      workType === 'report'
                        ? 'border-[#1B3A8C] bg-[#EEF2FF] dark:bg-[#1e3570]/40'
                        : 'border-[#E2E8F0] dark:border-[#1e3570] bg-[#F8FAFC] dark:bg-[#0a1530]'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5',
                        workType === 'report' ? 'bg-[#1B3A8C] text-white' : 'bg-[#E2E8F0] dark:bg-[#1e3570] text-[#94A3B8]'
                      )}>
                        <FileText size={16} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[#1a2a5e] dark:text-[#e2e8f0]">Relatório de Análise</p>
                        <p className="text-xs text-[#64748B] dark:text-[#94a3b8] mt-0.5 leading-relaxed">
                          A IA realizará a análise do documento e gerará um relatório com os apontamentos identificados.
                        </p>
                      </div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setWorkType('adequacy')}
                    className={cn(
                      'p-4 rounded-xl border-2 text-left transition-all',
                      workType === 'adequacy'
                        ? 'border-[#1B3A8C] bg-[#EEF2FF] dark:bg-[#1e3570]/40'
                        : 'border-[#E2E8F0] dark:border-[#1e3570] bg-[#F8FAFC] dark:bg-[#0a1530]'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5',
                        workType === 'adequacy' ? 'bg-[#1B3A8C] text-white' : 'bg-[#E2E8F0] dark:bg-[#1e3570] text-[#94A3B8]'
                      )}>
                        <Pencil size={16} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[#1a2a5e] dark:text-[#e2e8f0]">Proposta de Adequação</p>
                        <p className="text-xs text-[#64748B] dark:text-[#94a3b8] mt-0.5 leading-relaxed">
                          A IA analisará o documento e apresentará uma proposta de reescrita das cláusulas que necessitem de adequação à LGPD.
                        </p>
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            )}

            <div className="p-4 bg-[#F0F4FF] dark:bg-[#1e3570]/30 rounded-xl text-xs text-[#64748B] dark:text-[#94a3b8] space-y-1">
              <p className="font-medium text-[#1B3A8C] dark:text-blue-400">Resumo da análise</p>
              <p>
                Tema: <span className="font-medium">{isOthersTheme ? customThemeName : selectedTheme?.name}</span>
                {(selectedSubtopic || customSubtopicName) && (
                  <> · Subtema: <span className="font-medium">{isCustomSubtopic ? customSubtopicName : selectedSubtopic?.name}</span></>
                )}
              </p>
              {selectedOeaCriteriaIds.length > 0 && (
                <p>
                  OEA: <span className="font-medium">
                    {selectedOeaCriteriaList.map(c => `Critério ${c.number}`).join(', ')}
                  </span>
                  {selectedOeaItem && singleSelectedCriteria && <> · Item <span className="font-medium">{selectedOeaItem.item_number}</span></>}
                </p>
              )}
              <p>
                Base: <span className="font-medium">{activeDocsCount} documento(s)</span> e <span className="font-medium">{activePromptsCount} prompt(s)</span> de referência
              </p>
            </div>
          </div>

          <div className="flex justify-between mt-6">
            <Button variant="secondary" onClick={() => setStep(3)}>
              <ChevronLeft size={16} /> Voltar
            </Button>
            <Button onClick={handleStartAnalysis} disabled={!canProceed(4)}>
              Iniciar Análise
            </Button>
          </div>
        </Card>
      )}

      {/* ── Step 5: Processing ── */}
      {step === 5 && (
        <Card className="text-center py-16">
          <div className="flex flex-col items-center gap-6">
            {analyzing ? (
              <>
                <div className="w-20 h-20 rounded-3xl bg-[#EEF2FF] dark:bg-[#1e3570]/40 flex items-center justify-center animate-pulse-glow">
                  <Loader2 size={36} className="text-[#1B3A8C] dark:text-blue-400 animate-spin" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-[#1a2a5e] dark:text-[#e2e8f0]">
                    {workType === 'adequacy' ? 'Gerando proposta de adequação...' : 'Analisando documento...'}
                  </h3>
                  <p className="text-[#64748B] dark:text-[#94a3b8] text-sm mt-2">
                    {workType === 'adequacy'
                      ? 'A IA está elaborando a proposta de reescrita das cláusulas com base nos requisitos da LGPD'
                      : 'A IA está avaliando o conteúdo com base na base de conhecimento configurada'}
                  </p>
                </div>
                <div className="w-full max-w-xs space-y-2">
                  <div className="flex justify-between text-xs text-[#64748B] dark:text-[#94a3b8]">
                    <span>Processando</span>
                    <span>Em andamento...</span>
                  </div>
                  <div className="h-2 bg-[#E2E8F0] dark:bg-[#1e3570] rounded-full overflow-hidden">
                    <div className="h-full bg-[#1B3A8C] rounded-full animate-pulse" style={{ width: '70%' }} />
                  </div>
                </div>
                <p className="text-xs text-[#94A3B8] max-w-sm">
                  Este processo pode levar alguns segundos. Por favor, aguarde sem fechar a página.
                </p>
              </>
            ) : (
              <>
                <div className="w-20 h-20 rounded-3xl bg-[#DCFCE7] dark:bg-green-900/40 flex items-center justify-center">
                  <CheckCircle size={36} className="text-[#16A34A]" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-[#1a2a5e] dark:text-[#e2e8f0]">Análise concluída!</h3>
                  <p className="text-[#64748B] dark:text-[#94a3b8] text-sm mt-2">O relatório foi gerado. Redirecionando...</p>
                </div>
              </>
            )}
          </div>
        </Card>
      )}
    </div>
  )
}
