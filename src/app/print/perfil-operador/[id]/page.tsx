import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PerfilOperadorItem } from '@/types/perfil-operador'
import { isCurrentUserAdmin } from '@/lib/perfil-operador/is-admin'
import { PrintActions } from './print-actions'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata() {
  return { title: 'Perfil do Operador — LF Consultoria' }
}

export default async function PrintPerfilOperadorPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  // Módulo em desenvolvimento — liberado apenas para administradores
  if (!(await isCurrentUserAdmin())) notFound()

  const { data: elaboration, error } = await supabase
    .from('perfil_operador_elaborations')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()
  if (error || !elaboration) notFound()

  const { data: itemsRaw } = await supabase
    .from('perfil_operador_items')
    .select('*')
    .eq('elaboration_id', id)
    .order('criteria_number')
    .order('item_number')

  const items = (itemsRaw ?? []) as PerfilOperadorItem[]

  const byCriterio = new Map<string, PerfilOperadorItem[]>()
  for (const it of items) {
    const key = `${it.criteria_number}. ${it.criteria_name}`
    if (!byCriterio.has(key)) byCriterio.set(key, [])
    byCriterio.get(key)!.push(it)
  }

  const today = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })

  return (
    <>
      <style>{`
        @media print {
          @page { size: A4; margin: 14mm 16mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
          .criterio-block { break-before: page; }
          .criterio-block:first-of-type { break-before: auto; }
        }
        body { font-family: system-ui, -apple-system, sans-serif; background: white; }
      `}</style>

      <PrintActions />

      <div className="max-w-[800px] mx-auto px-8 py-8 text-[#1a2a5e]">
        {/* Header */}
        <div className="flex items-start justify-between pb-5 border-b-2 border-[#1B3A8C] mb-7">
          <div>
            <div className="flex items-center gap-2 mb-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="LF Consultoria" style={{ width: 32, height: 32, objectFit: 'contain' }} />
              <p className="text-xs font-semibold uppercase tracking-widest text-[#1B3A8C]">LF Consultoria e Auditoria</p>
            </div>
            <h1 className="text-2xl font-bold text-[#1a2a5e]">Perfil do Operador</h1>
          </div>
          <div className="text-right text-xs text-[#64748B] space-y-1">
            <p>{today}</p>
            <p>Cliente: <strong>{elaboration.cliente}</strong></p>
          </div>
        </div>

        {/* Itens por critério */}
        {Array.from(byCriterio.entries()).map(([label, criterioItems]) => (
          <div key={label} className="criterio-block mb-8">
            <h2 className="text-base font-bold text-[#1B3A8C] uppercase tracking-wide mb-4 pb-2 border-b border-[#E2E8F0]">
              {label}
            </h2>
            <div className="space-y-6">
              {criterioItems.map(item => (
                <div key={item.id} className="break-inside-avoid">
                  <p className="text-sm font-semibold text-[#1a2a5e] mb-1.5">
                    <span className="text-[#2BA05A] mr-1.5">{item.item_number}</span>
                    {item.item_description}
                  </p>
                  <p className="text-sm text-[#334155] leading-relaxed whitespace-pre-line">
                    {item.resposta?.trim() || <em className="text-[#94A3B8]">Resposta ainda não elaborada.</em>}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Footer */}
        <div className="border-t border-[#E2E8F0] pt-4 mt-8 flex items-center justify-between text-xs text-[#94A3B8]">
          <div className="flex items-center gap-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="" style={{ width: 16, height: 16, objectFit: 'contain', opacity: 0.5 }} />
            <span>LF Consultoria e Auditoria</span>
          </div>
          <span>{today}</span>
        </div>
      </div>
    </>
  )
}
