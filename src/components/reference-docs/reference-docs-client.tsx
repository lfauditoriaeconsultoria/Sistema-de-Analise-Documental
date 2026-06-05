'use client'

import { useState, useCallback, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import { Theme, Subtopic, ReferenceDocument, ReferencePrompt, OeaCriteria } from '@/types'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { useToast } from '@/components/ui/toast'
import { createClient } from '@/lib/supabase/client'
import { formatDate, formatFileSize, cn } from '@/lib/utils'
import {
  BookOpen, Upload, FileText, Trash2, Plus, Shield, Lock,
  X, Search, AlertCircle, MessageSquare, File, Settings, ChevronDown, ChevronRight
} from 'lucide-react'

type DocRow = ReferenceDocument & { theme?: { name: string }; subtopic?: { name: string } | null }
type PromptRow = ReferencePrompt & {
  theme?: { name: string }
  subtopic?: { name: string } | null
  oea_criteria?: { number: number; name: string } | null
  oea_item?: { item_number: string } | null
}

interface Props {
  themes: Theme[]
  subtopics: Subtopic[]
  docs: DocRow[]
  prompts: PromptRow[]
  isAdmin: boolean
}

const THEME_ICONS: Record<string, React.ReactNode> = {
  OEA: <Shield size={18} />,
  LGPD: <Lock size={18} />,
}

async function getAuthHeader(): Promise<Record<string, string>> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.access_token) return { Authorization: `Bearer ${session.access_token}` }
  return {}
}

// ── Upload form as isolated component so useDropzone remounts each time ──
function UploadForm({
  themes, subtopics, oeaCriteriaList, onSuccess, onCancel,
  defaultThemeId = '', defaultSubtopicId = '',
}: {
  themes: Theme[]
  subtopics: Subtopic[]
  oeaCriteriaList: OeaCriteria[]
  onSuccess: (doc: DocRow) => void
  onCancel: () => void
  defaultThemeId?: string
  defaultSubtopicId?: string
}) {
  const { toast } = useToast()
  const [file, setFile] = useState<File | null>(null)
  const [docName, setDocName] = useState('')
  const [docDesc, setDocDesc] = useState('')
  const [selectedThemeId, setSelectedThemeId] = useState(defaultThemeId)
  const [selectedSubtopicId, setSelectedSubtopicId] = useState(defaultSubtopicId)
  const [selectedOeaCriteriaId, setSelectedOeaCriteriaId] = useState('')
  const [selectedOeaItemId, setSelectedOeaItemId] = useState('')
  const [uploading, setUploading] = useState(false)

  const filteredSubs = subtopics.filter(s => s.theme_id === selectedThemeId)
  const selectedTheme = themes.find(t => t.id === selectedThemeId)
  const isOeaTheme = selectedTheme?.name === 'OEA'
  const selectedOeaCriteria = oeaCriteriaList.find(c => c.id === selectedOeaCriteriaId)

  const onDrop = useCallback((accepted: File[]) => {
    if (accepted[0]) {
      setFile(accepted[0])
      if (!docName) setDocName(accepted[0].name.replace(/\.[^.]+$/, ''))
    }
  }, [docName])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt'],
    },
    maxFiles: 1,
    maxSize: 30 * 1024 * 1024,
  })

  async function handleUpload() {
    if (!file || !selectedThemeId || !docName.trim()) {
      toast({ type: 'error', title: 'Preencha todos os campos obrigatórios' })
      return
    }
    setUploading(true)
    try {
      const headers = await getAuthHeader()
      const formData = new FormData()
      formData.append('file', file)
      formData.append('name', docName)
      formData.append('description', docDesc)
      formData.append('themeId', selectedThemeId)
      if (selectedSubtopicId) formData.append('subtopicId', selectedSubtopicId)
      if (selectedOeaCriteriaId) formData.append('oeaCriteriaId', selectedOeaCriteriaId)
      if (selectedOeaItemId) formData.append('oeaItemId', selectedOeaItemId)
      const res = await fetch('/api/documents', { method: 'POST', headers, body: formData })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro ao enviar')
      toast({ type: 'success', title: 'Documento cadastrado!' })
      onSuccess(json.document)
    } catch (err: unknown) {
      toast({ type: 'error', title: 'Erro', description: err instanceof Error ? err.message : 'Tente novamente.' })
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Nome + Tema — sempre visíveis */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-[#1a2a5e] dark:text-[#e2e8f0]">Nome do documento *</label>
        <input
          type="text"
          placeholder="Ex: IN SRF 476 - Critérios OEA"
          value={docName}
          onChange={e => setDocName(e.target.value)}
          className="w-full h-10 px-3 rounded-lg border text-sm border-[#E2E8F0] bg-white text-[#1a2a5e] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#1B3A8C] focus:border-transparent transition-colors"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-[#1a2a5e] block mb-1.5">Tema *</label>
        <select
          value={selectedThemeId}
          onChange={e => { setSelectedThemeId(e.target.value); setSelectedSubtopicId(''); setSelectedOeaCriteriaId(''); setSelectedOeaItemId('') }}
          className="w-full h-10 px-3 rounded-lg border border-[#E2E8F0] dark:border-[#1e3570] text-sm bg-white dark:bg-[#0a1530] text-[#1a2a5e] dark:text-[#e2e8f0] focus:outline-none focus:ring-2 focus:ring-[#1B3A8C] dark:focus:ring-blue-400"
        >
          <option value="">Selecione o tema</option>
          {themes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>

      {/* OEA: critério + item/subitem */}
      {isOeaTheme && oeaCriteriaList.length > 0 && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-[#1a2a5e] block mb-1.5">Critério OEA <span className="font-normal text-[#64748B] dark:text-[#94a3b8]">(opcional)</span></label>
            <select
              value={selectedOeaCriteriaId}
              onChange={e => { setSelectedOeaCriteriaId(e.target.value); setSelectedOeaItemId('') }}
              className="w-full h-10 px-3 rounded-lg border border-[#E2E8F0] dark:border-[#1e3570] text-sm bg-white dark:bg-[#0a1530] text-[#1a2a5e] dark:text-[#e2e8f0] focus:outline-none focus:ring-2 focus:ring-[#1B3A8C] dark:focus:ring-blue-400"
            >
              <option value="">Todos os critérios</option>
              {(['geral', 'seguranca', 'conformidade'] as const).map(cat => {
                const items = oeaCriteriaList.filter(c => c.category === cat)
                if (items.length === 0) return null
                const label = cat === 'geral' ? 'Critérios Gerais' : cat === 'seguranca' ? 'Critérios de Segurança' : 'Critérios de Conformidade'
                return (
                  <optgroup key={cat} label={label}>
                    {items.map(c => <option key={c.id} value={c.id}>{c.number}. {c.name}</option>)}
                  </optgroup>
                )
              })}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-[#1a2a5e] block mb-1.5">Item/Subitem <span className="font-normal text-[#64748B] dark:text-[#94a3b8]">(opcional)</span></label>
            <select
              value={selectedOeaItemId}
              onChange={e => setSelectedOeaItemId(e.target.value)}
              disabled={!selectedOeaCriteriaId}
              className="w-full h-10 px-3 rounded-lg border border-[#E2E8F0] text-sm bg-white text-[#1a2a5e] focus:outline-none focus:ring-2 focus:ring-[#1B3A8C] disabled:opacity-50"
            >
              <option value="">Todos os itens</option>
              {(selectedOeaCriteria?.items ?? []).map(item => (
                <option key={item.id} value={item.id}>{item.item_number} – {item.description.substring(0, 60)}{item.description.length > 60 ? '...' : ''}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Não-OEA: subtema */}
      {selectedThemeId && !isOeaTheme && (
        <div>
          <label className="text-sm font-medium text-[#1a2a5e] block mb-1.5">Subtema <span className="font-normal text-[#64748B] dark:text-[#94a3b8]">(opcional)</span></label>
          <select
            value={selectedSubtopicId}
            onChange={e => setSelectedSubtopicId(e.target.value)}
            className="w-full h-10 px-3 rounded-lg border border-[#E2E8F0] dark:border-[#1e3570] text-sm bg-white dark:bg-[#0a1530] text-[#1a2a5e] dark:text-[#e2e8f0] focus:outline-none focus:ring-2 focus:ring-[#1B3A8C] dark:focus:ring-blue-400"
          >
            <option value="">Geral (sem subtema)</option>
            {filteredSubs.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      )}

      {/* Descrição — sempre visível após o tema */}
      {selectedThemeId && (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-[#1a2a5e] dark:text-[#e2e8f0]">Descrição <span className="text-[#94A3B8] font-normal">(opcional)</span></label>
          <textarea
            placeholder="Breve descrição do conteúdo..."
            value={docDesc}
            onChange={e => setDocDesc(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 rounded-lg border text-sm resize-none border-[#E2E8F0] bg-white text-[#1a2a5e] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#1B3A8C] focus:border-transparent transition-colors"
          />
        </div>
      )}

      {!file ? (
        <div {...getRootProps()} className={cn('drop-zone rounded-xl p-8 text-center cursor-pointer', isDragActive && 'active')}>
          <input {...getInputProps()} />
          <Upload size={24} className="mx-auto text-[#1B3A8C] mb-2" />
          <p className="text-sm font-medium text-[#1a2a5e] dark:text-[#e2e8f0]">Arraste o arquivo ou clique aqui</p>
          <p className="text-xs text-[#64748B] mt-1">PDF, DOCX ou TXT — máx. 30MB</p>
        </div>
      ) : (
        <div className="flex items-center gap-3 p-3 rounded-xl border-2 border-[#16A34A] bg-[#F0FDF4]">
          <FileText size={20} className="text-[#16A34A]" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[#1a2a5e] truncate">{file.name}</p>
            <p className="text-xs text-[#64748B] dark:text-[#94a3b8]">{formatFileSize(file.size)}</p>
          </div>
          <button onClick={() => setFile(null)} className="text-[#94A3B8] hover:text-[#DC2626]"><X size={16} /></button>
        </div>
      )}

      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={onCancel}>Cancelar</Button>
        <Button onClick={handleUpload} loading={uploading} disabled={!file || !selectedThemeId || !docName.trim()}>
          {uploading ? 'Enviando...' : 'Cadastrar Documento'}
        </Button>
      </div>
    </div>
  )
}

export function ReferenceDocsClient({ themes: initialThemes, subtopics: initialSubtopics, docs: initialDocs, prompts: initialPrompts, isAdmin }: Props) {
  const { toast } = useToast()
  const [pageTab, setPageTab] = useState<'docs' | 'prompts' | 'config'>('docs')

  // ── Docs state ──
  const [docs, setDocs] = useState(initialDocs)
  const [filterTheme, setFilterTheme] = useState('')
  const [search, setSearch] = useState('')
  const [showUpload, setShowUpload] = useState(false)
  const [uploadModalKey, setUploadModalKey] = useState(0)
  const [uploadDefaultThemeId, setUploadDefaultThemeId] = useState('')
  const [uploadDefaultSubtopicId, setUploadDefaultSubtopicId] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)

  // ── OEA criteria state ──
  const [oeaCriteriaList, setOeaCriteriaList] = useState<OeaCriteria[]>([])

  useEffect(() => {
    void (async () => {
      try {
        const headers = await getAuthHeader()
        const res = await fetch('/api/oea-criteria', { headers })
        if (res.ok) {
          const json = await res.json()
          setOeaCriteriaList(json.criteria ?? [])
        }
      } catch { /* silently fail */ }
    })()
  }, [])

  // ── Prompts state ──
  const [prompts, setPrompts] = useState(initialPrompts)
  const [promptFilterTheme, setPromptFilterTheme] = useState('')
  const [showNewPrompt, setShowNewPrompt] = useState(false)
  const [savingPrompt, setSavingPrompt] = useState(false)
  const [promptContent, setPromptContent] = useState('')
  const [promptThemeId, setPromptThemeId] = useState('')
  const [promptSubtopicId, setPromptSubtopicId] = useState('')
  const [promptOeaCriteriaId, setPromptOeaCriteriaId] = useState('')
  const [promptOeaItemId, setPromptOeaItemId] = useState('')
  const [deletingPrompt, setDeletingPrompt] = useState<string | null>(null)

  // ── Config state ──
  const [themesList, setThemesList] = useState(initialThemes)
  const [subtopicsList, setSubtopicsList] = useState(initialSubtopics)
  const [showNewTheme, setShowNewTheme] = useState(false)
  const [newThemeName, setNewThemeName] = useState('')
  const [newThemeDesc, setNewThemeDesc] = useState('')
  const [newThemeColor, setNewThemeColor] = useState('#1B3A8C')
  const [savingTheme, setSavingTheme] = useState(false)
  const [deletingTheme, setDeletingTheme] = useState<string | null>(null)
  const [showNewSubtopic, setShowNewSubtopic] = useState(false)
  const [newSubtopicName, setNewSubtopicName] = useState('')
  const [newSubtopicDesc, setNewSubtopicDesc] = useState('')
  const [newSubtopicThemeId, setNewSubtopicThemeId] = useState('')
  const [savingSubtopic, setSavingSubtopic] = useState(false)
  const [deletingSubtopic, setDeletingSubtopic] = useState<string | null>(null)
  const [expandedThemes, setExpandedThemes] = useState<Record<string, boolean>>({})

  const filteredSubtopicsForPrompt = subtopicsList.filter(s => s.theme_id === promptThemeId)
  const promptThemeIsOea = themesList.find(t => t.id === promptThemeId)?.name === 'OEA'
  const promptOeaCriteriaObj = oeaCriteriaList.find(c => c.id === promptOeaCriteriaId)

  function openUploadModal(themeId = '', subtopicId = '') {
    setUploadDefaultThemeId(themeId)
    setUploadDefaultSubtopicId(subtopicId)
    setUploadModalKey(k => k + 1)
    setShowUpload(true)
  }

  function handleUploadSuccess(doc: DocRow) {
    setDocs(prev => [doc, ...prev])
    setShowUpload(false)
    setUploadModalKey(k => k + 1)
    setUploadDefaultThemeId('')
    setUploadDefaultSubtopicId('')
  }

  async function handleDeleteDoc(docId: string) {
    setDeleting(docId)
    try {
      const headers = await getAuthHeader()
      const res = await fetch(`/api/documents?id=${docId}`, { method: 'DELETE', headers })
      if (!res.ok) throw new Error()
      setDocs(prev => prev.filter(d => d.id !== docId))
      toast({ type: 'success', title: 'Documento excluído' })
    } catch {
      toast({ type: 'error', title: 'Erro ao excluir documento' })
    } finally {
      setDeleting(null)
    }
  }

  async function handleCreatePrompt() {
    if (!promptContent.trim() || !promptThemeId) {
      toast({ type: 'error', title: 'Preencha a instrução e o tema' })
      return
    }
    const trimmed = promptContent.trim()
    const autoTitle = trimmed.length > 80 ? trimmed.slice(0, 77) + '...' : trimmed
    setSavingPrompt(true)
    try {
      const headers = await getAuthHeader()
      const res = await fetch('/api/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ title: autoTitle, content: trimmed, themeId: promptThemeId, subtopicId: promptSubtopicId || null, oeaCriteriaId: promptOeaCriteriaId || null, oeaItemId: promptOeaItemId || null }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro ao criar')
      toast({ type: 'success', title: 'Prompt criado!' })
      setPrompts(prev => [...prev, json.prompt])
      setShowNewPrompt(false)
      setPromptContent(''); setPromptThemeId(''); setPromptSubtopicId(''); setPromptOeaCriteriaId(''); setPromptOeaItemId('')
    } catch (err: unknown) {
      toast({ type: 'error', title: 'Erro', description: err instanceof Error ? err.message : '' })
    } finally {
      setSavingPrompt(false)
    }
  }

  async function handleDeletePrompt(promptId: string) {
    setDeletingPrompt(promptId)
    try {
      const headers = await getAuthHeader()
      const res = await fetch(`/api/prompts?id=${promptId}`, { method: 'DELETE', headers })
      if (!res.ok) throw new Error()
      setPrompts(prev => prev.filter(p => p.id !== promptId))
      toast({ type: 'success', title: 'Prompt excluído' })
    } catch {
      toast({ type: 'error', title: 'Erro ao excluir prompt' })
    } finally {
      setDeletingPrompt(null)
    }
  }

  async function handleCreateTheme() {
    if (!newThemeName.trim()) { toast({ type: 'error', title: 'Nome obrigatório' }); return }
    setSavingTheme(true)
    try {
      const headers = await getAuthHeader()
      const res = await fetch('/api/themes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ name: newThemeName, description: newThemeDesc, color: newThemeColor }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setThemesList(prev => [...prev, json.theme])
      setShowNewTheme(false)
      setNewThemeName(''); setNewThemeDesc(''); setNewThemeColor('#1B3A8C')
      toast({ type: 'success', title: 'Tema criado!' })
    } catch (err: unknown) {
      toast({ type: 'error', title: 'Erro ao criar tema', description: err instanceof Error ? err.message : '' })
    } finally {
      setSavingTheme(false)
    }
  }

  async function handleDeleteTheme(id: string) {
    setDeletingTheme(id)
    try {
      const headers = await getAuthHeader()
      const res = await fetch(`/api/themes?id=${id}`, { method: 'DELETE', headers })
      if (!res.ok) throw new Error()
      setThemesList(prev => prev.filter(t => t.id !== id))
      toast({ type: 'success', title: 'Tema removido' })
    } catch {
      toast({ type: 'error', title: 'Erro ao remover tema' })
    } finally {
      setDeletingTheme(null)
    }
  }

  async function handleCreateSubtopic() {
    if (!newSubtopicName.trim() || !newSubtopicThemeId) { toast({ type: 'error', title: 'Nome e tema obrigatórios' }); return }
    setSavingSubtopic(true)
    try {
      const headers = await getAuthHeader()
      const res = await fetch('/api/subtopics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ name: newSubtopicName, description: newSubtopicDesc, themeId: newSubtopicThemeId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setSubtopicsList(prev => [...prev, json.subtopic])
      setShowNewSubtopic(false)
      setNewSubtopicName(''); setNewSubtopicDesc(''); setNewSubtopicThemeId('')
      toast({ type: 'success', title: 'Subtema criado!' })
    } catch (err: unknown) {
      toast({ type: 'error', title: 'Erro ao criar subtema', description: err instanceof Error ? err.message : '' })
    } finally {
      setSavingSubtopic(false)
    }
  }

  async function handleDeleteSubtopic(id: string) {
    setDeletingSubtopic(id)
    try {
      const headers = await getAuthHeader()
      const res = await fetch(`/api/subtopics?id=${id}`, { method: 'DELETE', headers })
      if (!res.ok) throw new Error()
      setSubtopicsList(prev => prev.filter(s => s.id !== id))
      toast({ type: 'success', title: 'Subtema removido' })
    } catch {
      toast({ type: 'error', title: 'Erro ao remover subtema' })
    } finally {
      setDeletingSubtopic(null)
    }
  }

  const filteredDocs = docs.filter(d => {
    const matchTheme = !filterTheme || d.theme_id === filterTheme
    const matchSearch = !search || d.name.toLowerCase().includes(search.toLowerCase())
    return matchTheme && matchSearch
  })

  const filteredPrompts = promptFilterTheme ? prompts.filter(p => p.theme_id === promptFilterTheme) : prompts

  const groupedDocs = themesList.reduce<Record<string, typeof filteredDocs>>((acc, t) => {
    acc[t.id] = filteredDocs.filter(d => d.theme_id === t.id)
    return acc
  }, {})

  const groupedPrompts = themesList.reduce<Record<string, typeof filteredPrompts>>((acc, t) => {
    acc[t.id] = filteredPrompts.filter(p => p.theme_id === t.id)
    return acc
  }, {})

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-[#1a2a5e] dark:text-[#e2e8f0]">Base de Conhecimento</h2>
          <p className="text-sm text-[#64748B] mt-0.5">Materiais e instruções utilizados pela IA nas análises</p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            {pageTab === 'docs' && <Button onClick={() => openUploadModal()} className="gap-2"><Plus size={16} /> Novo Documento</Button>}
            {pageTab === 'prompts' && <Button onClick={() => setShowNewPrompt(true)} className="gap-2"><Plus size={16} /> Novo Prompt</Button>}
            {pageTab === 'config' && (
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setShowNewSubtopic(true)} className="gap-2"><Plus size={16} /> Novo Subtema</Button>
                <Button onClick={() => setShowNewTheme(true)} className="gap-2"><Plus size={16} /> Novo Tema</Button>
              </div>
            )}
          </div>
        )}
      </div>

      {!isAdmin && (
        <div className="p-4 bg-[#EEF2FF] rounded-xl flex items-start gap-3 text-sm">
          <AlertCircle size={16} className="text-[#1B3A8C] mt-0.5 flex-shrink-0" />
          <p className="text-[#1B3A8C]">Somente administradores podem adicionar ou remover materiais.</p>
        </div>
      )}

      {/* Page tabs */}
      <div className="flex gap-1 p-1 bg-[#F1F5F9] rounded-xl">
        {(['docs', 'prompts'] as const).map(tab => (
          <button key={tab} onClick={() => setPageTab(tab)}
            className={cn('flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all',
              pageTab === tab ? 'bg-white text-[#1a2a5e] shadow-sm' : 'text-[#64748B] hover:text-[#1a2a5e]')}
          >
            {tab === 'docs' ? <><BookOpen size={16} /> Documentos <span className="text-xs px-1.5 py-0.5 rounded-full bg-[#E2E8F0] text-[#64748B] font-bold">{docs.length}</span></> : <><MessageSquare size={16} /> Prompts <span className="text-xs px-1.5 py-0.5 rounded-full bg-[#E2E8F0] text-[#64748B] font-bold">{prompts.length}</span></>}
          </button>
        ))}
        {isAdmin && (
          <button onClick={() => setPageTab('config')}
            className={cn('flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all',
              pageTab === 'config' ? 'bg-white text-[#1a2a5e] shadow-sm' : 'text-[#64748B] hover:text-[#1a2a5e]')}
          >
            <Settings size={16} /> Configuração
          </button>
        )}
      </div>

      {/* ── Docs tab ── */}
      {pageTab === 'docs' && (
        <>
          <Card padding="sm">
            <div className="flex flex-wrap gap-3">
              <div className="flex-1 min-w-52 relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                <input type="text" placeholder="Buscar documento..." value={search} onChange={e => setSearch(e.target.value)}
                  className="w-full h-9 pl-9 pr-3 rounded-lg border border-[#E2E8F0] text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1B3A8C] text-[#1a2a5e] placeholder:text-[#94A3B8]" />
              </div>
              <select value={filterTheme} onChange={e => setFilterTheme(e.target.value)}
                className="h-9 px-3 rounded-lg border border-[#E2E8F0] dark:border-[#1e3570] text-sm bg-white dark:bg-[#0a1530] text-[#64748B] dark:text-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#1B3A8C] dark:focus:ring-blue-400">
                <option value="">Todos os temas</option>
                {themesList.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </Card>

          {themesList.map(theme => {
            if (filterTheme && filterTheme !== theme.id) return null
            const themeDocs = groupedDocs[theme.id] ?? []
            const subtopicGroups = subtopicsList.filter(s => s.theme_id === theme.id)
              .reduce<Record<string, typeof themeDocs>>((acc, sub) => {
                acc[sub.id] = themeDocs.filter(d => d.subtopic_id === sub.id)
                return acc
              }, {})
            const noSubtopic = themeDocs.filter(d => !d.subtopic_id)

            return (
              <Card key={theme.id} padding="none">
                <div className="flex items-center gap-3 p-5 border-b border-[#E2E8F0] dark:border-[#1e3570]" style={{ background: `linear-gradient(to right, ${theme.color}15, transparent)` }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white" style={{ backgroundColor: theme.color }}>
                    {THEME_ICONS[theme.name] ?? <File size={18} />}
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-[#1a2a5e] dark:text-[#e2e8f0]">{theme.name}</p>
                    <p className="text-xs text-[#64748B] dark:text-[#94a3b8]">{themeDocs.length} documento(s)</p>
                  </div>
                </div>
                <div className="p-4 space-y-6">
                  {noSubtopic.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wide">Geral</p>
                      {noSubtopic.map(doc => <DocRowItem key={doc.id} doc={doc} isAdmin={isAdmin} deleting={deleting === doc.id} onDelete={() => handleDeleteDoc(doc.id)} />)}
                      {isAdmin && <AddDocRow onClick={() => openUploadModal(theme.id)} />}
                    </div>
                  )}
                  {Object.entries(subtopicGroups).map(([subId, subDocs]) => {
                    const sub = subtopicsList.find(s => s.id === subId)
                    if (!sub) return null
                    return (
                      <div key={subId} className="space-y-2">
                        <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wide">{sub.name}</p>
                        {subDocs.map(doc => <DocRowItem key={doc.id} doc={doc} isAdmin={isAdmin} deleting={deleting === doc.id} onDelete={() => handleDeleteDoc(doc.id)} />)}
                        {isAdmin && <AddDocRow onClick={() => openUploadModal(theme.id, sub.id)} />}
                      </div>
                    )
                  })}
                  {themeDocs.length === 0 && subtopicsList.filter(s => s.theme_id === theme.id).length === 0 && (
                    <div className="text-center py-6 text-[#94A3B8]">
                      <BookOpen size={24} className="mx-auto mb-2 opacity-40" />
                      <p className="text-sm">Nenhum documento cadastrado para {theme.name}</p>
                      {isAdmin && <Button variant="ghost" size="sm" onClick={() => openUploadModal(theme.id)} className="mt-2"><Plus size={14} /> Adicionar</Button>}
                    </div>
                  )}
                </div>
              </Card>
            )
          })}
        </>
      )}

      {/* ── Prompts tab ── */}
      {pageTab === 'prompts' && (
        <>
          <Card padding="sm">
            <select value={promptFilterTheme} onChange={e => setPromptFilterTheme(e.target.value)}
              className="h-9 px-3 rounded-lg border border-[#E2E8F0] dark:border-[#1e3570] text-sm bg-white dark:bg-[#0a1530] text-[#64748B] dark:text-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#1B3A8C] dark:focus:ring-blue-400">
              <option value="">Todos os temas</option>
              {themesList.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </Card>

          {themesList.map(theme => {
            if (promptFilterTheme && promptFilterTheme !== theme.id) return null
            const themePrompts = groupedPrompts[theme.id] ?? []
            return (
              <Card key={theme.id} padding="none">
                <div className="flex items-center gap-3 p-5 border-b border-[#E2E8F0] dark:border-[#1e3570]" style={{ background: `linear-gradient(to right, ${theme.color}15, transparent)` }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white" style={{ backgroundColor: theme.color }}>
                    {THEME_ICONS[theme.name] ?? <File size={18} />}
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-[#1a2a5e] dark:text-[#e2e8f0]">{theme.name}</p>
                    <p className="text-xs text-[#64748B] dark:text-[#94a3b8]">{themePrompts.length} prompt(s)</p>
                  </div>
                </div>
                <div className="p-4 space-y-2">
                  {themePrompts.length === 0 && (
                    <div className="text-center py-6 text-[#94A3B8]">
                      <MessageSquare size={24} className="mx-auto mb-2 opacity-40" />
                      <p className="text-sm">Nenhum prompt configurado para {theme.name}</p>
                    </div>
                  )}
                  {themePrompts.map(prompt => {
                    const scopeTag = prompt.oea_item
                      ? `Critério ${prompt.oea_criteria?.number} › Item ${prompt.oea_item.item_number}`
                      : prompt.oea_criteria
                      ? `Critério ${prompt.oea_criteria.number} — ${prompt.oea_criteria.name}`
                      : prompt.subtopic
                      ? prompt.subtopic.name
                      : 'Geral'
                    return (
                      <div key={prompt.id} className="rounded-xl border border-[#E2E8F0] overflow-hidden">
                        <div className="flex items-center gap-2 px-3 py-2 bg-[#F8FAFC] border-b border-[#E2E8F0] dark:border-[#1e3570]">
                          <MessageSquare size={14} className="text-[#1B3A8C] flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-[#1a2a5e] truncate">{prompt.title}</p>
                            <span className="inline-block text-xs bg-[#EEF2FF] text-[#1B3A8C] px-2 py-0.5 rounded-full mt-0.5">{scopeTag}</span>
                          </div>
                          <span className="text-xs text-[#94A3B8] flex-shrink-0">{formatDate(prompt.created_at)}</span>
                          {isAdmin && (
                            <button onClick={() => handleDeletePrompt(prompt.id)} disabled={deletingPrompt === prompt.id}
                              className="p-1.5 rounded-lg text-[#94A3B8] hover:text-[#DC2626] hover:bg-[#FEE2E2] transition-colors disabled:opacity-50 flex-shrink-0">
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                        <p className="px-3 py-2 text-sm text-[#64748B] whitespace-pre-wrap line-clamp-4">{prompt.content}</p>
                      </div>
                    )
                  })}
                  {isAdmin && (
                    <button
                      onClick={() => { setShowNewPrompt(true); setPromptThemeId(theme.id) }}
                      className="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl border-2 border-dashed border-[#CBD5E1] hover:border-[#1B3A8C] hover:bg-[#EEF2FF] text-[#94A3B8] hover:text-[#1B3A8C] transition-all text-sm font-medium"
                    >
                      <Plus size={14} /> Adicionar prompt
                    </button>
                  )}
                </div>
              </Card>
            )
          })}
        </>
      )}

      {/* ── Config tab (admin only) ── */}
      {pageTab === 'config' && isAdmin && (
        <div className="space-y-6">
          {/* Themes section */}
          <Card padding="none">
            <div className="flex items-center justify-between p-5 border-b border-[#E2E8F0] dark:border-[#1e3570]">
              <div>
                <p className="font-bold text-[#1a2a5e] dark:text-[#e2e8f0]">Temas</p>
                <p className="text-xs text-[#64748B] dark:text-[#94a3b8]">{themesList.length} tema(s) cadastrado(s)</p>
              </div>
            </div>
            <div className="p-4 space-y-2">
              {themesList.map(theme => {
                const isExpanded = expandedThemes[theme.id]
                const themeSubs = subtopicsList.filter(s => s.theme_id === theme.id)
                return (
                  <div key={theme.id} className="rounded-xl border border-[#E2E8F0] overflow-hidden">
                    <div className="flex items-center gap-3 p-3 bg-[#F8FAFC] dark:bg-[#0a1530]">
                      <div className="w-7 h-7 rounded-lg flex-shrink-0" style={{ backgroundColor: theme.color }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[#1a2a5e] dark:text-[#e2e8f0]">{theme.name}</p>
                        {theme.description && <p className="text-xs text-[#64748B] truncate">{theme.description}</p>}
                      </div>
                      <span className="text-xs text-[#94A3B8]">{themeSubs.length} subtema(s)</span>
                      <button onClick={() => setExpandedThemes(prev => ({ ...prev, [theme.id]: !prev[theme.id] }))}
                        className="p-1.5 rounded-lg text-[#94A3B8] hover:bg-[#F1F5F9] transition-colors">
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </button>
                      <button onClick={() => handleDeleteTheme(theme.id)} disabled={deletingTheme === theme.id}
                        className="p-1.5 rounded-lg text-[#94A3B8] hover:text-[#DC2626] hover:bg-[#FEE2E2] transition-colors disabled:opacity-50">
                        <Trash2 size={14} />
                      </button>
                    </div>
                    {isExpanded && (
                      <div className="px-4 pb-3 pt-2 space-y-1 bg-white border-t border-[#F1F5F9]">
                        {themeSubs.length === 0 ? (
                          <p className="text-xs text-[#94A3B8] py-2">Nenhum subtema cadastrado</p>
                        ) : (
                          themeSubs.map(sub => (
                            <div key={sub.id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-[#F8FAFC] dark:bg-[#0a1530]">
                              <span className="text-sm text-[#1a2a5e] flex-1">{sub.name}</span>
                              {sub.description && <span className="text-xs text-[#94A3B8] truncate max-w-xs">{sub.description}</span>}
                              <button onClick={() => handleDeleteSubtopic(sub.id)} disabled={deletingSubtopic === sub.id}
                                className="p-1 rounded text-[#94A3B8] hover:text-[#DC2626] hover:bg-[#FEE2E2] transition-colors disabled:opacity-50">
                                <Trash2 size={13} />
                              </button>
                            </div>
                          ))
                        )}
                        <button onClick={() => { setShowNewSubtopic(true); setNewSubtopicThemeId(theme.id) }}
                          className="flex items-center gap-1.5 text-xs text-[#1B3A8C] hover:text-[#2D6BE4] mt-1 px-2">
                          <Plus size={12} /> Adicionar subtema
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
              {themesList.length === 0 && (
                <p className="text-sm text-[#94A3B8] text-center py-6">Nenhum tema cadastrado</p>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* ── Upload Document Modal ── */}
      <Modal key={uploadModalKey} open={showUpload} onOpenChange={open => { setShowUpload(open) }} title="Novo Documento de Referência" size="lg">
        <UploadForm
          themes={themesList}
          subtopics={subtopicsList}
          oeaCriteriaList={oeaCriteriaList}
          onSuccess={handleUploadSuccess}
          onCancel={() => setShowUpload(false)}
          defaultThemeId={uploadDefaultThemeId}
          defaultSubtopicId={uploadDefaultSubtopicId}
        />
      </Modal>

      {/* ── New Prompt Modal ── */}
      <Modal open={showNewPrompt} onOpenChange={open => { setShowNewPrompt(open); if (!open) { setPromptContent(''); setPromptThemeId(''); setPromptSubtopicId(''); setPromptOeaCriteriaId(''); setPromptOeaItemId('') } }} title="Novo Prompt Auxiliar" size="lg">
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-[#1a2a5e] block mb-1.5">Tema *</label>
            <select value={promptThemeId} onChange={e => { setPromptThemeId(e.target.value); setPromptSubtopicId(''); setPromptOeaCriteriaId(''); setPromptOeaItemId('') }}
              className="w-full h-10 px-3 rounded-lg border border-[#E2E8F0] dark:border-[#1e3570] text-sm bg-white dark:bg-[#0a1530] text-[#1a2a5e] dark:text-[#e2e8f0] focus:outline-none focus:ring-2 focus:ring-[#1B3A8C] dark:focus:ring-blue-400">
              <option value="">Selecione o tema</option>
              {themesList.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>

          {promptThemeId && promptThemeIsOea && oeaCriteriaList.length > 0 && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-[#1a2a5e] block mb-1.5">Critério OEA (opcional)</label>
                <select value={promptOeaCriteriaId} onChange={e => { setPromptOeaCriteriaId(e.target.value); setPromptOeaItemId('') }}
                  className="w-full h-10 px-3 rounded-lg border border-[#E2E8F0] dark:border-[#1e3570] text-sm bg-white dark:bg-[#0a1530] text-[#1a2a5e] dark:text-[#e2e8f0] focus:outline-none focus:ring-2 focus:ring-[#1B3A8C] dark:focus:ring-blue-400">
                  <option value="">Todos os critérios</option>
                  {(['geral', 'seguranca', 'conformidade'] as const).map(cat => {
                    const items = oeaCriteriaList.filter(c => c.category === cat)
                    if (items.length === 0) return null
                    const label = cat === 'geral' ? 'Critérios Gerais' : cat === 'seguranca' ? 'Critérios de Segurança' : 'Critérios de Conformidade'
                    return (
                      <optgroup key={cat} label={label}>
                        {items.map(c => <option key={c.id} value={c.id}>{c.number}. {c.name}</option>)}
                      </optgroup>
                    )
                  })}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-[#1a2a5e] block mb-1.5">Item/Subitem (opcional)</label>
                <select value={promptOeaItemId} onChange={e => setPromptOeaItemId(e.target.value)} disabled={!promptOeaCriteriaId}
                  className="w-full h-10 px-3 rounded-lg border border-[#E2E8F0] text-sm bg-white text-[#1a2a5e] focus:outline-none focus:ring-2 focus:ring-[#1B3A8C] disabled:opacity-50">
                  <option value="">Todos os itens</option>
                  {(promptOeaCriteriaObj?.items ?? []).map(item => (
                    <option key={item.id} value={item.id}>{item.item_number}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {promptThemeId && !promptThemeIsOea && (
            <div>
              <label className="text-sm font-medium text-[#1a2a5e] block mb-1.5">Subtema (opcional)</label>
              <select value={promptSubtopicId} onChange={e => setPromptSubtopicId(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-[#E2E8F0] dark:border-[#1e3570] text-sm bg-white dark:bg-[#0a1530] text-[#1a2a5e] dark:text-[#e2e8f0] focus:outline-none focus:ring-2 focus:ring-[#1B3A8C] dark:focus:ring-blue-400">
                <option value="">Geral (todos os subtemas)</option>
                {filteredSubtopicsForPrompt.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[#1a2a5e] dark:text-[#e2e8f0]">Instrução *</label>
            <textarea
              placeholder="Escreva a instrução que guiará a análise da IA..."
              value={promptContent}
              onChange={e => setPromptContent(e.target.value)}
              rows={5}
              className="w-full px-3 py-2 rounded-lg border text-sm resize-none border-[#E2E8F0] bg-white text-[#1a2a5e] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#1B3A8C] focus:border-transparent transition-colors"
            />
          </div>
          <p className="text-xs text-[#64748B] dark:text-[#94a3b8]">Prompts sem subtema ou critério OEA são carregados para qualquer análise do tema. Com critério/item OEA, aparecem apenas para análises daquele requisito específico.</p>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setShowNewPrompt(false)}>Cancelar</Button>
            <Button onClick={handleCreatePrompt} loading={savingPrompt} disabled={!promptContent.trim() || !promptThemeId}>
              {savingPrompt ? 'Salvando...' : 'Criar Prompt'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── New Theme Modal ── */}
      <Modal open={showNewTheme} onOpenChange={open => { setShowNewTheme(open); if (!open) { setNewThemeName(''); setNewThemeDesc(''); setNewThemeColor('#1B3A8C') } }} title="Novo Tema">
        <div className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[#1a2a5e] dark:text-[#e2e8f0]">Nome do tema *</label>
            <input type="text" placeholder="Ex: ISO 27001" value={newThemeName} onChange={e => setNewThemeName(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border text-sm border-[#E2E8F0] bg-white text-[#1a2a5e] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#1B3A8C] focus:border-transparent transition-colors" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[#1a2a5e] dark:text-[#e2e8f0]">Descrição <span className="text-[#94A3B8] font-normal">(opcional)</span></label>
            <input type="text" placeholder="Breve descrição..." value={newThemeDesc} onChange={e => setNewThemeDesc(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border text-sm border-[#E2E8F0] bg-white text-[#1a2a5e] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#1B3A8C] focus:border-transparent transition-colors" />
          </div>
          <div>
            <label className="text-sm font-medium text-[#1a2a5e] block mb-1.5">Cor do tema</label>
            <div className="flex items-center gap-3">
              <input type="color" value={newThemeColor} onChange={e => setNewThemeColor(e.target.value)}
                className="w-10 h-10 rounded-lg border border-[#E2E8F0] cursor-pointer p-0.5" />
              <span className="text-sm text-[#64748B] dark:text-[#94a3b8]">{newThemeColor}</span>
              <div className="flex gap-2 ml-2">
                {['#1B3A8C', '#7C3AED', '#DC2626', '#16A34A', '#D97706', '#0891B2'].map(c => (
                  <button key={c} onClick={() => setNewThemeColor(c)}
                    className="w-6 h-6 rounded-full border-2 transition-all"
                    style={{ backgroundColor: c, borderColor: newThemeColor === c ? '#1B3A8C' : 'transparent' }} />
                ))}
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setShowNewTheme(false)}>Cancelar</Button>
            <Button onClick={handleCreateTheme} loading={savingTheme} disabled={!newThemeName.trim()}>Criar Tema</Button>
          </div>
        </div>
      </Modal>

      {/* ── New Subtopic Modal ── */}
      <Modal open={showNewSubtopic} onOpenChange={open => { setShowNewSubtopic(open); if (!open) { setNewSubtopicName(''); setNewSubtopicDesc(''); setNewSubtopicThemeId('') } }} title="Novo Subtema">
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-[#1a2a5e] block mb-1.5">Tema *</label>
            <select value={newSubtopicThemeId} onChange={e => setNewSubtopicThemeId(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-[#E2E8F0] dark:border-[#1e3570] text-sm bg-white dark:bg-[#0a1530] text-[#1a2a5e] dark:text-[#e2e8f0] focus:outline-none focus:ring-2 focus:ring-[#1B3A8C] dark:focus:ring-blue-400">
              <option value="">Selecione o tema</option>
              {themesList.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[#1a2a5e] dark:text-[#e2e8f0]">Nome do subtema *</label>
            <input type="text" placeholder="Ex: 05 - Segurança da Informação" value={newSubtopicName} onChange={e => setNewSubtopicName(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border text-sm border-[#E2E8F0] bg-white text-[#1a2a5e] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#1B3A8C] focus:border-transparent transition-colors" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[#1a2a5e] dark:text-[#e2e8f0]">Descrição <span className="text-[#94A3B8] font-normal">(opcional)</span></label>
            <input type="text" placeholder="Breve descrição..." value={newSubtopicDesc} onChange={e => setNewSubtopicDesc(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border text-sm border-[#E2E8F0] bg-white text-[#1a2a5e] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#1B3A8C] focus:border-transparent transition-colors" />
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setShowNewSubtopic(false)}>Cancelar</Button>
            <Button onClick={handleCreateSubtopic} loading={savingSubtopic} disabled={!newSubtopicName.trim() || !newSubtopicThemeId}>Criar Subtema</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function AddDocRow({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3 rounded-xl border-2 border-dashed border-[#CBD5E1] hover:border-[#1B3A8C] hover:bg-[#EEF2FF] text-[#94A3B8] hover:text-[#1B3A8C] transition-all group"
    >
      <div className="w-9 h-9 rounded-lg border-2 border-dashed border-[#CBD5E1] group-hover:border-[#1B3A8C] flex items-center justify-center flex-shrink-0 transition-colors">
        <Plus size={16} />
      </div>
      <span className="text-sm font-medium">Adicionar documento</span>
    </button>
  )
}

function DocRowItem({ doc, isAdmin, deleting, onDelete }: { doc: DocRow; isAdmin: boolean; deleting: boolean; onDelete: () => void }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-[#E2E8F0] bg-[#FAFAFA] hover:bg-white transition-colors">
      <div className="w-9 h-9 rounded-lg bg-[#EEF2FF] flex items-center justify-center flex-shrink-0">
        <FileText size={16} className="text-[#1B3A8C]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm text-[#1a2a5e] truncate">{doc.name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {doc.file_type && <Badge variant="muted" className="text-xs">{doc.file_type.toUpperCase()}</Badge>}
          {doc.file_size && <span className="text-xs text-[#94A3B8]">{formatFileSize(doc.file_size)}</span>}
          <span className="text-xs text-[#94A3B8]">{formatDate(doc.created_at)}</span>
        </div>
      </div>
      {isAdmin && (
        <button onClick={onDelete} disabled={deleting}
          className="p-1.5 rounded-lg text-[#94A3B8] hover:text-[#DC2626] hover:bg-[#FEE2E2] transition-colors disabled:opacity-50">
          <Trash2 size={14} />
        </button>
      )}
    </div>
  )
}
