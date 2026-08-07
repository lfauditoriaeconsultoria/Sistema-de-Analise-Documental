'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  FileText, Search, Trash2, ChevronRight,
  CalendarDays, Building2, Loader2, AlertTriangle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'

interface ReportRow {
  id: string
  empresa: string
  criterio: string
  emissao: string
  created_at: string
  updated_at: string
}

interface Props {
  initialReports: ReportRow[]
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function AuditHistoryClient({ initialReports }: Props) {
  const router = useRouter()
  const [reports, setReports] = useState<ReportRow[]>(initialReports)
  const [query, setQuery] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const filtered = useMemo(() => {
    if (!query.trim()) return reports
    const q = query.toLowerCase()
    return reports.filter(r =>
      r.empresa.toLowerCase().includes(q) ||
      r.criterio.toLowerCase().includes(q) ||
      r.emissao.toLowerCase().includes(q)
    )
  }, [reports, query])

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
      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Buscar por empresa, critério…"
          className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-[#CBD5E1] dark:border-[#1e3570] bg-white dark:bg-[#0d1733] text-[#1a2a5e] dark:text-[#e2e8f0] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#1B3A8C]/30"
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 rounded-lg p-3">
          <AlertTriangle size={15} className="flex-shrink-0" />
          {error}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-[#64748B] dark:text-[#94a3b8]">
          {query
            ? 'Nenhum relatório encontrado para esta busca.'
            : 'Nenhum relatório gerado ainda. Crie um novo em "Gerar Relatório".'}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(r => (
            <Card key={r.id} padding="sm" className="group hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3">
                {/* Icon */}
                <div className="w-10 h-10 rounded-lg bg-[#EEF2FF] dark:bg-[#1e3570]/40 flex items-center justify-center flex-shrink-0">
                  <FileText size={18} className="text-[#1B3A8C] dark:text-blue-400" />
                </div>

                {/* Info */}
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
                    <span className="flex items-center gap-1 text-xs text-[#64748B] dark:text-[#94a3b8]">
                      <CalendarDays size={11} /> Gerado em {formatDate(r.created_at)}
                    </span>
                    {r.emissao && (
                      <span className="text-xs text-[#94A3B8]">Emissão: {r.emissao}</span>
                    )}
                  </div>
                </div>

                {/* Actions */}
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
                      : <Trash2 size={14} />
                    }
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
