'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { IdCard, Plus, Loader2, Trash2, ChevronRight } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

interface ElaborationRow {
  id: string
  cliente: string
  status: string
  created_at: string
  updated_at: string
  items: { id: string; criteria_number: number; criteria_name: string; status: string }[]
}

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  rascunho:  { label: 'Rascunho',        className: 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300' },
  documentos:{ label: 'Aguardando documentos', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  gerando:   { label: 'Gerando',         className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  revisao:   { label: 'Em revisão',      className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  concluido: { label: 'Concluído',       className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function PerfilOperadorHub() {
  const router = useRouter()
  const [elaborations, setElaborations] = useState<ElaborationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function authHeaders(): Promise<Record<string, string>> {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
  }

  // `loading` já nasce true (useState(true)) — evita setState síncrono no corpo do efeito
  async function load() {
    try {
      const res = await fetch('/api/perfil-operador/elaborations', { headers: await authHeaders() })
      if (res.ok) {
        const json = await res.json()
        setElaborations(json.elaborations ?? [])
      }
    } finally {
      setLoading(false)
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps -- load() só deve rodar 1x, na montagem
  useEffect(() => { load() }, [])

  async function handleDelete(id: string) {
    if (!confirm('Remover esta elaboração e todos os documentos enviados? Esta ação não pode ser desfeita.')) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/perfil-operador/elaborations/${id}`, { method: 'DELETE', headers: await authHeaders() })
      if (res.ok) setElaborations(prev => prev.filter(e => e.id !== id))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#EEF2FF] dark:bg-[#1e3570]/60 flex items-center justify-center">
            <IdCard size={20} className="text-[#1B3A8C] dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#1a2a5e] dark:text-[#e2e8f0]">Perfil Operador</h1>
            <p className="text-sm text-[#64748B] dark:text-[#94a3b8]">
              Elaboração assistida por IA das respostas do Perfil do Operador (Programa OEA)
            </p>
          </div>
        </div>
        <Link href="/perfil-operador/new">
          <Button className="gap-2"><Plus size={16} /> Nova Elaboração</Button>
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-[#94A3B8]">
          <Loader2 size={20} className="animate-spin mr-2" /> Carregando…
        </div>
      ) : elaborations.length === 0 ? (
        <Card padding="lg" className="text-center">
          <IdCard size={36} className="mx-auto mb-3 text-[#CBD5E1] dark:text-[#334876]" />
          <h2 className="font-semibold text-[#1a2a5e] dark:text-[#e2e8f0] mb-1">Nenhuma elaboração ainda</h2>
          <p className="text-sm text-[#64748B] dark:text-[#94a3b8] max-w-md mx-auto mb-5">
            Selecione os critérios e itens do Programa OEA, envie os documentos do cliente e deixe a IA
            redigir um rascunho de resposta para cada item — depois revise, edite e exporte.
          </p>
          <Link href="/perfil-operador/new">
            <Button className="gap-2"><Plus size={16} /> Iniciar Nova Elaboração</Button>
          </Link>
        </Card>
      ) : (
        <div className="space-y-3">
          {elaborations.map(e => {
            const statusInfo = STATUS_LABEL[e.status] ?? STATUS_LABEL.rascunho
            const criteriaNames = Array.from(new Set(e.items.map(i => i.criteria_name)))
            const generatedCount = e.items.filter(i => i.status === 'gerado').length
            return (
              <Card
                key={e.id}
                hover
                padding="md"
                className="flex items-center justify-between gap-4 cursor-pointer"
                onClick={() => router.push(`/perfil-operador/${e.id}`)}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-[#1a2a5e] dark:text-[#e2e8f0] truncate">{e.cliente}</h3>
                    <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', statusInfo.className)}>
                      {statusInfo.label}
                    </span>
                  </div>
                  <p className="text-xs text-[#64748B] dark:text-[#94a3b8] mt-1 truncate">
                    {criteriaNames.length} critério{criteriaNames.length !== 1 ? 's' : ''} ·{' '}
                    {e.items.length} item{e.items.length !== 1 ? 's' : ''} ·{' '}
                    {generatedCount} gerado{generatedCount !== 1 ? 's' : ''} · atualizado em {fmtDate(e.updated_at)}
                  </p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={(ev) => { ev.stopPropagation(); handleDelete(e.id) }}
                    disabled={deletingId === e.id}
                    className="p-2 rounded-lg text-[#94A3B8] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    title="Remover elaboração"
                  >
                    {deletingId === e.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                  </button>
                  <ChevronRight size={18} className="text-[#CBD5E1]" />
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
