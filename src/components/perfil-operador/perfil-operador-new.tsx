'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, IdCard, Loader2, ChevronDown, Check, Minus, Search, AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { SelectedOeaItem } from '@/types/perfil-operador'

interface OeaItemRow { id: string; item_number: string; description: string }
interface OeaCriteriaRow { id: string; number: number; name: string; items: OeaItemRow[] }

/* ── Checkbox customizado (suporta estado indeterminado) ── */
function TriCheckbox({ state }: { state: 'checked' | 'indeterminate' | 'unchecked' }) {
  return (
    <span className={cn(
      'flex-shrink-0 w-[18px] h-[18px] rounded border flex items-center justify-center transition-colors',
      state === 'unchecked'
        ? 'border-gray-300 dark:border-gray-600'
        : 'bg-blue-600 border-blue-600 text-white'
    )}>
      {state === 'checked' && <Check size={11} />}
      {state === 'indeterminate' && <Minus size={11} />}
    </span>
  )
}

export function PerfilOperadorNew() {
  const router = useRouter()
  const [criteria, setCriteria]   = useState<OeaCriteriaRow[]>([])
  const [loading, setLoading]     = useState(true)
  const [cliente, setCliente]     = useState('')
  const [selected, setSelected]   = useState<Set<string>>(new Set()) // oea_item_id
  const [expanded, setExpanded]   = useState<Set<number>>(new Set()) // criteria_number
  const [search, setSearch]       = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]         = useState('')

  useEffect(() => {
    async function fetchCriteria() {
      try {
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        const res = await fetch('/api/oea-criteria', {
          headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
        })
        if (res.ok) {
          const json = await res.json()
          setCriteria(json.criteria ?? [])
        }
      } finally {
        setLoading(false)
      }
    }
    fetchCriteria()
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return criteria
    return criteria.filter(c => c.name.toLowerCase().includes(q) || String(c.number).includes(q))
  }, [criteria, search])

  function itemKey(item: OeaItemRow) { return item.id }

  function criterionState(c: OeaCriteriaRow): 'checked' | 'indeterminate' | 'unchecked' {
    const total   = c.items.length
    const chosen  = c.items.filter(it => selected.has(itemKey(it))).length
    if (chosen === 0) return 'unchecked'
    return chosen === total ? 'checked' : 'indeterminate'
  }

  function toggleCriterion(c: OeaCriteriaRow) {
    const state = criterionState(c)
    setSelected(prev => {
      const next = new Set(prev)
      if (state === 'checked') {
        c.items.forEach(it => next.delete(itemKey(it)))
      } else {
        c.items.forEach(it => next.add(itemKey(it)))
      }
      return next
    })
  }

  function toggleItem(item: OeaItemRow) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(itemKey(item))) next.delete(itemKey(item))
      else next.add(itemKey(item))
      return next
    })
  }

  function toggleExpanded(num: number) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(num)) next.delete(num)
      else next.add(num)
      return next
    })
  }

  function selectAll() {
    const all = new Set<string>()
    criteria.forEach(c => c.items.forEach(it => all.add(itemKey(it))))
    setSelected(all)
    setExpanded(new Set(criteria.map(c => c.number)))
  }

  function clearAll() { setSelected(new Set()) }

  const selectedCriteriaCount = criteria.filter(c => c.items.some(it => selected.has(itemKey(it)))).length
  const selectedItemsCount    = selected.size

  async function handleSubmit() {
    setError('')
    if (!cliente.trim())      return setError('Informe o nome do cliente.')
    if (!selectedItemsCount)  return setError('Selecione ao menos um item.')

    setSubmitting(true)
    try {
      const items: SelectedOeaItem[] = []
      for (const c of criteria) {
        for (const it of c.items) {
          if (selected.has(itemKey(it))) {
            items.push({
              criteria_number:  c.number,
              criteria_name:    c.name,
              oea_item_id:      it.id,
              item_number:      it.item_number,
              item_description: it.description,
            })
          }
        }
      }

      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/perfil-operador/elaborations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ cliente: cliente.trim(), items }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Erro ao criar elaboração.'); return }
      router.push(`/perfil-operador/${json.id}`)
    } catch {
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <Link href="/perfil-operador">
          <Button variant="ghost" size="sm" className="gap-1.5"><ArrowLeft size={14} /> Perfil Operador</Button>
        </Link>
        <span className="text-[#94A3B8]">/</span>
        <h1 className="text-lg font-bold text-[#1a2a5e] dark:text-[#e2e8f0]">Nova Elaboração</h1>
      </div>

      <Card padding="md" className="space-y-5">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
            <IdCard size={20} className="text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="font-semibold text-[#1a2a5e] dark:text-[#e2e8f0]">Passo 1 — Cliente e seleção de itens</h2>
            <p className="text-xs text-[#64748B] dark:text-[#94a3b8]">
              Selecione um ou mais critérios e, dentro deles, os itens que deseja elaborar.
            </p>
          </div>
        </div>

        {/* Cliente */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Nome do cliente <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={cliente}
            onChange={e => setCliente(e.target.value)}
            placeholder="Ex.: Empresa XYZ Ltda."
            className="w-full rounded-lg border px-3 py-2.5 text-sm bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Busca + ações rápidas */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar critério…"
              className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-700 dark:text-gray-300"
            />
          </div>
          <button type="button" onClick={selectAll} className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap">
            Selecionar todos
          </button>
          <span className="text-gray-300 dark:text-gray-600">·</span>
          <button type="button" onClick={clearAll} className="text-xs font-medium text-gray-500 dark:text-gray-400 hover:underline whitespace-nowrap">
            Limpar seleção
          </button>
        </div>

        {/* Resumo */}
        {selectedItemsCount > 0 && (
          <div className="flex items-center gap-2 text-sm font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg px-3 py-2">
            {selectedCriteriaCount} critério{selectedCriteriaCount !== 1 ? 's' : ''} selecionado{selectedCriteriaCount !== 1 ? 's' : ''}
            <span className="text-blue-300 dark:text-blue-600">·</span>
            {selectedItemsCount} item{selectedItemsCount !== 1 ? 's' : ''} selecionado{selectedItemsCount !== 1 ? 's' : ''}
          </div>
        )}

        {/* Árvore de critérios/itens */}
        {loading ? (
          <div className="flex items-center justify-center py-10 text-gray-400">
            <Loader2 size={18} className="animate-spin mr-2" /> Carregando critérios…
          </div>
        ) : (
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-100 dark:divide-gray-700 max-h-[480px] overflow-y-auto">
            {filtered.map(c => {
              const state    = criterionState(c)
              const isOpen   = expanded.has(c.number)
              const chosenN  = c.items.filter(it => selected.has(itemKey(it))).length
              return (
                <div key={c.id}>
                  <div className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <button type="button" onClick={() => toggleCriterion(c)} className="flex-shrink-0">
                      <TriCheckbox state={state} />
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleExpanded(c.number)}
                      className="flex-1 flex items-center gap-2 text-left min-w-0"
                    >
                      <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 w-5 flex-shrink-0 text-right">{c.number}.</span>
                      <span className="text-sm text-gray-800 dark:text-gray-200 truncate flex-1">{c.name}</span>
                      {chosenN > 0 && (
                        <span className="text-xs font-medium text-blue-600 dark:text-blue-400 flex-shrink-0">
                          {chosenN}/{c.items.length}
                        </span>
                      )}
                      <ChevronDown size={14} className={cn('text-gray-400 flex-shrink-0 transition-transform', isOpen && 'rotate-180')} />
                    </button>
                  </div>

                  {isOpen && (
                    <div className="bg-gray-50/60 dark:bg-gray-900/30 pl-10 pr-3 py-1.5 space-y-0.5">
                      {c.items.map(it => (
                        <button
                          key={it.id}
                          type="button"
                          onClick={() => toggleItem(it)}
                          className="w-full flex items-start gap-2.5 py-1.5 text-left rounded-md hover:bg-white dark:hover:bg-gray-800 px-2 -mx-2"
                        >
                          <TriCheckbox state={selected.has(itemKey(it)) ? 'checked' : 'unchecked'} />
                          <span className="text-xs text-gray-600 dark:text-gray-400 flex-shrink-0 font-mono mt-0.5">{it.item_number}</span>
                          <span className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">{it.description}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
            {filtered.length === 0 && (
              <p className="text-sm text-center text-gray-400 py-8">Nenhum critério encontrado.</p>
            )}
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
            <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex justify-end">
          <Button onClick={handleSubmit} disabled={submitting} loading={submitting} className="gap-2">
            Continuar para Documentos
          </Button>
        </div>
      </Card>
    </div>
  )
}
