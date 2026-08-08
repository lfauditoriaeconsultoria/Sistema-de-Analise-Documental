'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  FilePlus, Search, ArrowRight, Shield, Lock, User,
  FileText, ClipboardList, Building2, CalendarDays,
  Trash2, Loader2, ChevronRight, AlertTriangle, Download, FileSpreadsheet,
} from 'lucide-react'
import { Analysis, Theme } from '@/types'
import { Card } from '@/components/ui/card'
import { Badge, ComplianceBadge, StatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDate, cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

/* ── Types ── */

type AnalysisRow = Analysis & {
  theme?: { id: string; name: string; color: string }
  subtopic?: { id: string; name: string } | null
  report?: { overall_compliance?: string; compliance_score?: number }[] | null
  user?: { id: string; full_name: string | null } | null
}

interface AuditRow {
  id: string
  empresa: string
  criterio: string
  emissao: string
  created_at: string
  updated_at: string
  user_id?: string
  user_full_name?: string | null
}

interface ChecklistRow {
  id: string
  cliente: string
  criterio: string
  filename: string
  items_count: number
  created_at: string
  user_id?: string
  user_full_name?: string | null
}

interface Props {
  analyses: AnalysisRow[]
  themes: Array<{ id: string; name: string }>
  isAdmin: boolean
  auditReports: AuditRow[]
  checklists: ChecklistRow[]
}

/* ── Helpers ── */

const inputCls =
  'h-9 px-3 rounded-lg border border-[#E2E8F0] dark:border-[#1e3570] text-sm bg-white dark:bg-[#0a1530] text-[#1a2a5e] dark:text-[#e2e8f0] focus:outline-none focus:ring-2 focus:ring-[#1B3A8C] dark:focus:ring-blue-400 placeholder:text-[#94A3B8] dark:placeholder:text-[#94a3b8]'

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

/* ── Tab: Análises ── */

function AnalysesTab({ analyses, themes, isAdmin }: { analyses: AnalysisRow[]; themes: Array<{ id: string; name: string }>; isAdmin: boolean }) {
  const [search, setSearch] = useState('')
  const [filterTheme, setFilterTheme] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterUser, setFilterUser] = useState('')

  const collaborators = useMemo(() => {
    if (!isAdmin) return []
    const map = new Map<string, string>()
    analyses.forEach(a => { if (a.user?.id && a.user.full_name) map.set(a.user.id, a.user.full_name) })
    return Array.from(map.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
  }, [analyses, isAdmin])

  const filtered = analyses.filter(a => {
    const matchSearch = !search || a.document_name.toLowerCase().includes(search.toLowerCase()) || a.client_name?.toLowerCase().includes(search.toLowerCase())
    const matchTheme = !filterTheme || a.theme_id === filterTheme
    const matchStatus = !filterStatus || a.status === filterStatus
    const matchUser = !filterUser || a.user_id === filterUser
    return matchSearch && matchTheme && matchStatus && matchUser
  })

  const hasFilters = !!(search || filterTheme || filterStatus || filterUser)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[#64748B] dark:text-[#94a3b8]">
          {filtered.length} análise(s)
          {isAdmin && filterUser && collaborators.find(c => c.id === filterUser)
            ? ` de ${collaborators.find(c => c.id === filterUser)?.name}`
            : isAdmin ? ' de todos os colaboradores' : ''}
        </p>
        <Link href="/analysis/new">
          <Button size="sm" className="gap-1.5"><FilePlus size={14} /> Nova Análise</Button>
        </Link>
      </div>

      {/* Filtros */}
      <Card padding="sm">
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-52 relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
            <input
              type="text"
              placeholder="Buscar por documento ou cliente..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className={cn(inputCls, 'w-full pl-9 pr-3')}
            />
          </div>
          {isAdmin && collaborators.length > 0 && (
            <select value={filterUser} onChange={e => setFilterUser(e.target.value)} className={inputCls}>
              <option value="">Todos os colaboradores</option>
              {collaborators.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          <select value={filterTheme} onChange={e => setFilterTheme(e.target.value)} className={inputCls}>
            <option value="">Todos os temas</option>
            {themes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className={inputCls}>
            <option value="">Todos os status</option>
            <option value="completed">Concluídas</option>
          </select>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setFilterTheme(''); setFilterStatus(''); setFilterUser('') }}>
              Limpar filtros
            </Button>
          )}
        </div>
      </Card>

      {/* Lista */}
      {filtered.length === 0 ? (
        <Card className="text-center py-16">
          <div className="flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-[#F0F4FF] dark:bg-[#1e3570]/30 flex items-center justify-center mx-auto">
              <FileText size={24} className="text-[#1B3A8C] dark:text-blue-400" />
            </div>
            <p className="font-semibold text-[#1a2a5e] dark:text-[#e2e8f0]">
              {analyses.length === 0 ? 'Nenhuma análise realizada' : 'Nenhum resultado encontrado'}
            </p>
            <p className="text-sm text-[#64748B] dark:text-[#94a3b8]">
              {analyses.length === 0 ? 'Comece criando sua primeira análise' : 'Tente outros filtros de busca'}
            </p>
            {analyses.length === 0 && (
              <Link href="/analysis/new">
                <Button size="sm" className="mt-2"><FilePlus size={14} /> Nova Análise</Button>
              </Link>
            )}
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {filtered.map(analysis => {
            const report = Array.isArray(analysis.report) ? analysis.report[0] : analysis.report
            const theme = analysis.theme as { id: string; name: string; color: string } | undefined
            const subtopic = analysis.subtopic as { id: string; name: string } | null | undefined
            const collaboratorName = analysis.user?.full_name

            return (
              <Link key={analysis.id} href={`/analysis/${analysis.id}`}>
                <Card hover className="flex items-center gap-4 p-4">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-white flex-shrink-0"
                    style={{ backgroundColor: theme?.color ?? '#1B3A8C' }}
                  >
                    {theme?.name === 'OEA' ? <Shield size={20} /> : <Lock size={20} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-[#1a2a5e] dark:text-[#e2e8f0] truncate">{analysis.document_name}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {theme && <Badge variant="primary" className="text-xs">{theme.name}</Badge>}
                      {subtopic && <span className="text-xs text-[#64748B] dark:text-[#94a3b8]">{subtopic.name}</span>}
                      {analysis.client_name && <span className="text-xs text-[#94A3B8] dark:text-[#94a3b8]">· {analysis.client_name}</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className="text-xs text-[#94A3B8] dark:text-[#94a3b8]">{formatDate(analysis.created_at)}</span>
                      {isAdmin && collaboratorName && (
                        <span className="flex items-center gap-1 text-xs text-[#64748B] dark:text-[#94a3b8]">
                          <User size={11} />{collaboratorName}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    {report?.overall_compliance
                      ? <ComplianceBadge level={report.overall_compliance as 'conforme' | 'parcialmente_conforme' | 'nao_conforme'} />
                      : <StatusBadge status={analysis.status} />
                    }
                    {typeof report?.compliance_score === 'number' && (
                      <span className="text-xs font-bold text-[#64748B] dark:text-[#94a3b8]">{report.compliance_score}%</span>
                    )}
                    <ArrowRight size={14} className="text-[#94A3B8] dark:text-[#94a3b8]" />
                  </div>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ── Tab: Auditoria OEA ── */

function AuditTab({ initialReports, isAdmin }: { initialReports: AuditRow[]; isAdmin: boolean }) {
  const router = useRouter()
  const [reports, setReports] = useState<AuditRow[]>(initialReports)
  const [query, setQuery] = useState('')
  const [filterUser, setFilterUser] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Lista de colaboradores únicos (só para admin)
  const collaborators = useMemo(() => {
    if (!isAdmin) return []
    const map = new Map<string, string>()
    reports.forEach(r => {
      if (r.user_id && r.user_full_name) map.set(r.user_id, r.user_full_name)
    })
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [reports, isAdmin])

  const filtered = useMemo(() => {
    return reports.filter(r => {
      const q = query.toLowerCase()
      const matchQuery = !query.trim() ||
        r.empresa.toLowerCase().includes(q) ||
        r.criterio.toLowerCase().includes(q) ||
        r.emissao.toLowerCase().includes(q) ||
        (r.user_full_name ?? '').toLowerCase().includes(q)
      const matchUser = !filterUser || r.user_id === filterUser
      return matchQuery && matchUser
    })
  }, [reports, query, filterUser])

  const handleDelete = async (id: string, empresa: string) => {
    if (!confirm(`Excluir o relatório de "${empresa}"? Essa ação não pode ser desfeita.`)) return
    setDeletingId(id)
    setError(null)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const res = await fetch(`/api/audit/reports/${id}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (res.ok) {
        setReports(prev => prev.filter(r => r.id !== id))
        router.refresh()
      } else {
        const j = await res.json()
        setError(j.error ?? 'Não foi possível excluir o relatório.')
      }
    } catch {
      setError('Erro de conexão ao tentar excluir.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[#64748B] dark:text-[#94a3b8]">
          {filtered.length} relatório(s)
          {isAdmin && filterUser && collaborators.find(c => c.id === filterUser)
            ? ` de ${collaborators.find(c => c.id === filterUser)?.name}`
            : isAdmin ? ' de todos os colaboradores' : ''}
        </p>
        <Link href="/audit/generate">
          <Button size="sm" className="gap-1.5"><FilePlus size={14} /> Novo Relatório</Button>
        </Link>
      </div>

      {/* Busca + filtro colaborador */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar por empresa, critério…"
            className={cn(inputCls, 'w-full pl-9 pr-3')}
          />
        </div>
        {isAdmin && collaborators.length > 0 && (
          <select value={filterUser} onChange={e => setFilterUser(e.target.value)} className={inputCls}>
            <option value="">Todos os colaboradores</option>
            {collaborators.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
        {(query || filterUser) && (
          <Button variant="ghost" size="sm" onClick={() => { setQuery(''); setFilterUser('') }}>
            Limpar filtros
          </Button>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 rounded-lg p-3">
          <AlertTriangle size={15} className="flex-shrink-0" /> {error}
        </div>
      )}

      {filtered.length === 0 ? (
        <Card className="text-center py-16">
          <div className="flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-[#F0F4FF] dark:bg-[#1e3570]/30 flex items-center justify-center mx-auto">
              <ClipboardList size={24} className="text-[#1B3A8C] dark:text-blue-400" />
            </div>
            <p className="font-semibold text-[#1a2a5e] dark:text-[#e2e8f0]">
              {reports.length === 0 ? 'Nenhum relatório gerado' : 'Nenhum resultado encontrado'}
            </p>
            <p className="text-sm text-[#64748B] dark:text-[#94a3b8]">
              {reports.length === 0 ? 'Gere seu primeiro relatório de auditoria OEA' : 'Tente outra busca'}
            </p>
            {reports.length === 0 && (
              <Link href="/audit/generate">
                <Button size="sm" className="mt-2 gap-1.5"><FilePlus size={14} /> Gerar Relatório</Button>
              </Link>
            )}
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {filtered.map(r => (
            <Card key={r.id} padding="sm" className="group hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-[#EEF2FF] dark:bg-[#1e3570]/40 flex items-center justify-center flex-shrink-0">
                  <ClipboardList size={20} className="text-[#1B3A8C] dark:text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-[#1a2a5e] dark:text-[#e2e8f0] truncate">
                    {r.empresa || 'Empresa não informada'}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                    {r.criterio && (
                      <span className="flex items-center gap-1 text-xs text-[#64748B] dark:text-[#94a3b8]">
                        <Building2 size={11} /> {r.criterio}
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-xs text-[#94A3B8] dark:text-[#94a3b8]">
                      <CalendarDays size={11} /> {fmtDate(r.created_at)}
                    </span>
                    {r.emissao && (
                      <span className="text-xs text-[#94A3B8]">Emissão: {r.emissao}</span>
                    )}
                    {isAdmin && r.user_full_name && (
                      <span className="flex items-center gap-1 text-xs text-[#64748B] dark:text-[#94a3b8]">
                        <User size={11} /> {r.user_full_name}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => handleDelete(r.id, r.empresa)}
                    disabled={deletingId === r.id}
                    title="Excluir relatório"
                  >
                    {deletingId === r.id
                      ? <Loader2 size={14} className="animate-spin" />
                      : <Trash2 size={14} />}
                  </Button>
                  <Link href={`/audit/${r.id}`}>
                    <Button variant="ghost" size="sm" className="gap-1 text-[#1B3A8C] dark:text-blue-400">
                      Abrir <ChevronRight size={14} />
                    </Button>
                  </Link>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Tab: Checklists ── */

function ChecklistTab({ initialChecklists, isAdmin }: { initialChecklists: ChecklistRow[]; isAdmin: boolean }) {
  const [checklists, setChecklists] = useState<ChecklistRow[]>(initialChecklists)
  const [query, setQuery]           = useState('')
  const [filterUser, setFilterUser] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [error, setError]           = useState<string | null>(null)

  const collaborators = useMemo(() => {
    if (!isAdmin) return []
    const map = new Map<string, string>()
    checklists.forEach(c => { if (c.user_id && c.user_full_name) map.set(c.user_id, c.user_full_name) })
    return Array.from(map.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
  }, [checklists, isAdmin])

  const filtered = useMemo(() => {
    return checklists.filter(c => {
      const q = query.toLowerCase()
      const matchQuery = !query.trim() ||
        c.cliente.toLowerCase().includes(q) ||
        c.criterio.toLowerCase().includes(q)
      const matchUser = !filterUser || c.user_id === filterUser
      return matchQuery && matchUser
    })
  }, [checklists, query, filterUser])

  async function handleDownload(id: string) {
    setDownloadingId(id)
    setError(null)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`/api/checklist/download/${id}`, {
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      })
      if (!res.ok) { setError('Não foi possível baixar o arquivo.'); return }
      const { url, filename } = await res.json()
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
    } catch {
      setError('Erro ao gerar link de download.')
    } finally {
      setDownloadingId(null)
    }
  }

  async function handleDelete(id: string, cliente: string) {
    if (!confirm(`Excluir o checklist de "${cliente}"? Essa ação não pode ser desfeita.`)) return
    setDeletingId(id)
    setError(null)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`/api/checklist/download/${id}`, {
        method: 'DELETE',
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      })
      if (res.ok || res.status === 204) {
        setChecklists(prev => prev.filter(c => c.id !== id))
      } else {
        const j = await res.json().catch(() => ({}))
        setError(j.error ?? 'Não foi possível excluir o checklist.')
      }
    } catch {
      setError('Erro de conexão ao tentar excluir.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[#64748B] dark:text-[#94a3b8]">
          {filtered.length} checklist(s)
          {isAdmin && filterUser && collaborators.find(c => c.id === filterUser)
            ? ` de ${collaborators.find(c => c.id === filterUser)?.name}`
            : isAdmin ? ' de todos os colaboradores' : ''}
        </p>
        <Link href="/checklist/generate">
          <Button size="sm" className="gap-1.5"><FilePlus size={14} /> Novo Checklist</Button>
        </Link>
      </div>

      {/* Busca + filtro */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar por cliente ou critério…"
            className={cn(inputCls, 'w-full pl-9 pr-3')}
          />
        </div>
        {isAdmin && collaborators.length > 0 && (
          <select value={filterUser} onChange={e => setFilterUser(e.target.value)} className={inputCls}>
            <option value="">Todos os colaboradores</option>
            {collaborators.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
        {(query || filterUser) && (
          <Button variant="ghost" size="sm" onClick={() => { setQuery(''); setFilterUser('') }}>
            Limpar filtros
          </Button>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 rounded-lg p-3">
          <AlertTriangle size={15} className="flex-shrink-0" /> {error}
        </div>
      )}

      {filtered.length === 0 ? (
        <Card className="text-center py-16">
          <div className="flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-[#F0F4FF] dark:bg-[#1e3570]/30 flex items-center justify-center mx-auto">
              <FileSpreadsheet size={24} className="text-[#1B3A8C] dark:text-blue-400" />
            </div>
            <p className="font-semibold text-[#1a2a5e] dark:text-[#e2e8f0]">
              {checklists.length === 0 ? 'Nenhum checklist gerado' : 'Nenhum resultado encontrado'}
            </p>
            <p className="text-sm text-[#64748B] dark:text-[#94a3b8]">
              {checklists.length === 0 ? 'Gere seu primeiro checklist de auditoria OEA' : 'Tente outra busca'}
            </p>
            {checklists.length === 0 && (
              <Link href="/checklist/generate">
                <Button size="sm" className="mt-2 gap-1.5"><FilePlus size={14} /> Gerar Checklist</Button>
              </Link>
            )}
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {filtered.map(c => (
            <Card key={c.id} padding="sm" className="group hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-[#F0FDF4] dark:bg-green-900/20 flex items-center justify-center flex-shrink-0">
                  <FileSpreadsheet size={20} className="text-green-600 dark:text-green-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-[#1a2a5e] dark:text-[#e2e8f0] truncate">
                    {c.cliente}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                    <span className="flex items-center gap-1 text-xs text-[#64748B] dark:text-[#94a3b8]">
                      <Building2 size={11} /> {c.criterio}
                    </span>
                    <span className="text-xs text-[#94A3B8] dark:text-[#94a3b8]">
                      {c.items_count} {c.items_count === 1 ? 'item' : 'itens'}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-[#94A3B8] dark:text-[#94a3b8]">
                      <CalendarDays size={11} /> {fmtDate(c.created_at)}
                    </span>
                    {isAdmin && c.user_full_name && (
                      <span className="flex items-center gap-1 text-xs text-[#64748B] dark:text-[#94a3b8]">
                        <User size={11} /> {c.user_full_name}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => handleDelete(c.id, c.cliente)}
                    disabled={deletingId === c.id}
                    title="Excluir checklist"
                  >
                    {deletingId === c.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/10"
                    onClick={() => handleDownload(c.id)}
                    disabled={downloadingId === c.id}
                    title="Baixar planilha"
                  >
                    {downloadingId === c.id
                      ? <Loader2 size={14} className="animate-spin" />
                      : <><Download size={14} /> Baixar</>}
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Componente principal ── */

export function UnifiedHistoryClient({ analyses, themes, isAdmin, auditReports, checklists }: Props) {
  const [activeTab, setActiveTab] = useState<'analyses' | 'audit' | 'checklists'>('analyses')

  const tabs = [
    { id: 'analyses'   as const, label: 'Análises de Documentos',     count: analyses.length,     icon: <FileText size={15} /> },
    { id: 'audit'      as const, label: 'Relatórios de Auditoria OEA', count: auditReports.length, icon: <ClipboardList size={15} /> },
    { id: 'checklists' as const, label: 'Checklists',                  count: checklists.length,   icon: <FileSpreadsheet size={15} /> },
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-xl font-bold text-[#1a2a5e] dark:text-[#e2e8f0]">Histórico</h1>
        <p className="text-sm text-[#64748B] dark:text-[#94a3b8] mt-0.5">
          Análises de documentos, relatórios de auditoria e checklists gerados
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[#E2E8F0] dark:border-[#1e3570]">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px',
              activeTab === tab.id
                ? 'border-[#1B3A8C] dark:border-blue-400 text-[#1B3A8C] dark:text-blue-400'
                : 'border-transparent text-[#64748B] dark:text-[#94a3b8] hover:text-[#1a2a5e] dark:hover:text-[#e2e8f0]'
            )}
          >
            {tab.icon}
            {tab.label}
            <span className={cn(
              'ml-1 px-1.5 py-0.5 rounded-full text-xs font-bold',
              activeTab === tab.id
                ? 'bg-[#EEF2FF] dark:bg-[#1e3570]/60 text-[#1B3A8C] dark:text-blue-300'
                : 'bg-[#F1F5F9] dark:bg-[#1e3570]/30 text-[#94A3B8]'
            )}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Conteúdo */}
      {activeTab === 'analyses'   && <AnalysesTab analyses={analyses} themes={themes} isAdmin={isAdmin} />}
      {activeTab === 'audit'      && <AuditTab initialReports={auditReports} isAdmin={isAdmin} />}
      {activeTab === 'checklists' && <ChecklistTab initialChecklists={checklists} isAdmin={isAdmin} />}
    </div>
  )
}
