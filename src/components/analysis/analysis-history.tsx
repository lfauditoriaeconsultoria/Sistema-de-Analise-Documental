'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Analysis, Theme } from '@/types'
import { Card } from '@/components/ui/card'
import { Badge, ComplianceBadge, StatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDate, cn } from '@/lib/utils'
import { FileText, Search, ArrowRight, FilePlus, Shield, Lock, User } from 'lucide-react'

type AnalysisRow = Analysis & {
  theme?: { id: string; name: string; color: string }
  subtopic?: { id: string; name: string } | null
  report?: { overall_compliance?: string; compliance_score?: number }[] | null
  user?: { id: string; full_name: string | null } | null
}

interface Props {
  analyses: AnalysisRow[]
  themes: Array<{ id: string; name: string }>
  isAdmin: boolean
}

export function AnalysisHistoryClient({ analyses, themes, isAdmin }: Props) {
  const [search, setSearch] = useState('')
  const [filterTheme, setFilterTheme] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterUser, setFilterUser] = useState('')

  const collaborators = useMemo(() => {
    if (!isAdmin) return []
    const map = new Map<string, string>()
    analyses.forEach(a => {
      if (a.user?.id && a.user.full_name) map.set(a.user.id, a.user.full_name)
    })
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

  const inputCls = 'h-9 px-3 rounded-lg border border-[#E2E8F0] dark:border-[#1e3570] text-sm bg-white dark:bg-[#0a1530] text-[#1a2a5e] dark:text-[#e2e8f0] focus:outline-none focus:ring-2 focus:ring-[#1B3A8C] dark:focus:ring-blue-400 placeholder:text-[#94A3B8] dark:placeholder:text-[#94a3b8]'

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-[#1a2a5e] dark:text-[#e2e8f0]">Histórico de Análises</h2>
          <p className="text-sm text-[#64748B] dark:text-[#94a3b8] mt-0.5">
            {filtered.length} análise(s)
            {isAdmin && filterUser && collaborators.find(c => c.id === filterUser)
              ? ` de ${collaborators.find(c => c.id === filterUser)?.name}`
              : isAdmin ? ' de todos os colaboradores' : ''}
          </p>
        </div>
        <Link href="/analysis/new">
          <Button className="gap-2"><FilePlus size={16} /> Nova Análise</Button>
        </Link>
      </div>

      {/* Filters */}
      <Card padding="sm">
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-52 relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8] dark:text-[#94a3b8]" />
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
            <option value="processing">Em andamento</option>
            <option value="failed">Com erro</option>
          </select>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setFilterTheme(''); setFilterStatus(''); setFilterUser('') }}>
              Limpar filtros
            </Button>
          )}
        </div>
      </Card>

      {/* List */}
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
                          <User size={11} />
                          {collaboratorName}
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
