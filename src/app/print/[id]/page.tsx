import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { Analysis, Report } from '@/types'
import { PrintActions } from './print-actions'
import { formatDateShort } from '@/lib/utils'
import { ADEQUACY_RAW_PREFIX } from '@/lib/anthropic/analysis'

type AdequacyProposal = {
  reference: string
  original: string
  proposed: string
  justification: string
  lgpd_basis: string
}

export async function generateMetadata() {
  return { title: 'Relatório de Conformidade — LF Consultoria' }
}

export default async function PrintPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('analyses')
    .select('*, theme:themes(*), subtopic:subtopics(*), report:reports(*)')
    .eq('id', id)
    .single()

  if (error || !data) notFound()

  const analysis = data as Analysis & {
    theme?: { name: string; color: string }
    subtopic?: { name: string } | null
    report: Report[] | null
  }
  const report = Array.isArray(analysis.report) ? analysis.report[0] : analysis.report
  if (!report) notFound()

  const theme = analysis.theme as { name: string; color: string } | undefined
  const subtopic = analysis.subtopic as { name: string } | null | undefined

  // Adequacy detection
  const isAdequacy = !!report.raw_analysis?.startsWith(ADEQUACY_RAW_PREFIX)
  let adequacyProposals: AdequacyProposal[] = []
  if (isAdequacy) {
    try {
      const parsed = JSON.parse(report.raw_analysis!.slice(ADEQUACY_RAW_PREFIX.length))
      adequacyProposals = parsed.proposals ?? []
    } catch { /* empty on parse error */ }
  }

  const scoreColor = (report.compliance_score ?? 0) >= 70 ? '#16A34A' : (report.compliance_score ?? 0) >= 40 ? '#D97706' : '#DC2626'
  const complianceColors: Record<string, { bg: string; text: string; label: string }> = {
    conforme: { bg: '#F0FDF4', text: '#16A34A', label: 'Conforme' },
    parcialmente_conforme: { bg: '#FFFBEB', text: '#D97706', label: 'Parcialmente Conforme' },
    nao_conforme: { bg: '#FFF5F5', text: '#DC2626', label: 'Não Conforme' },
  }
  const levelStyle = complianceColors[report.overall_compliance ?? ''] ?? complianceColors.nao_conforme

  const today = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })

  return (
    <>
      <style>{`
        @media print {
          @page { size: A4; margin: 12mm 16mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
        }
        body { font-family: system-ui, -apple-system, sans-serif; background: white; }
        .info-table { width: 100%; border-collapse: collapse; }
        .info-table td { width: 50%; vertical-align: top; padding: 0 12px 0 0; }
        .info-table td:last-child { padding-right: 0; }
      `}</style>

      <PrintActions analysisId={analysis.id} documentName={analysis.document_name} />

      {/* Screen-only tip */}
      <div className="no-print max-w-[800px] mx-auto px-8 pt-6">
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#FEF3C7] border border-[#FDE68A] text-[#92400E] text-xs">
          <span>💡</span>
          <span>Para ocultar o endereço da página no PDF, desative <strong>Cabeçalhos e rodapés</strong> no diálogo de impressão do navegador.</span>
        </div>
      </div>

      <div className="max-w-[800px] mx-auto px-8 py-8 text-[#1a2a5e]">

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between pb-5 border-b-2 border-[#1B3A8C] mb-7">
          <div>
            <div className="flex items-center gap-2 mb-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="LF Consultoria" style={{ width: 32, height: 32, objectFit: 'contain' }} />
              <p className="text-xs font-semibold uppercase tracking-widest text-[#1B3A8C]">LF Consultoria e Auditoria</p>
            </div>
            <h1 className="text-2xl font-bold text-[#1a2a5e]">
              {isAdequacy ? 'Proposta de Adequação à LGPD' : 'Relatório de Conformidade'}
            </h1>
          </div>
          <div className="text-right text-xs text-[#64748B] space-y-1">
            <p>{today}</p>
            {analysis.client_name && <p>Cliente: <strong>{analysis.client_name}</strong></p>}
          </div>
        </div>

        {/* ── Document Info — uses a plain <table> to avoid print grid bugs ── */}
        <div className="bg-[#F8FAFC] rounded-xl p-4 mb-7">
          <table className="info-table text-sm">
            <tbody>
              <tr>
                <td style={{ paddingBottom: '12px' }}>
                  <p style={{ fontSize: '10px', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>Documento</p>
                  <p style={{ fontWeight: 500, wordBreak: 'break-all' }}>{analysis.document_name}</p>
                </td>
                <td style={{ paddingBottom: '12px' }}>
                  <p style={{ fontSize: '10px', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>Tema</p>
                  <p style={{ fontWeight: 500 }}>{theme?.name}{subtopic?.name && ` › ${subtopic.name}`}</p>
                </td>
              </tr>
              <tr>
                <td>
                  <p style={{ fontSize: '10px', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>Data da Análise</p>
                  <p style={{ fontWeight: 500 }}>{formatDateShort(report.created_at)}</p>
                </td>
                <td>
                  <p style={{ fontSize: '10px', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>Resultado Geral</p>
                  <span style={{ display: 'inline-block', fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '999px', backgroundColor: levelStyle.bg, color: levelStyle.text }}>
                    {levelStyle.label}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ── Adequacy proposals ─────────────────────────────────────── */}
        {isAdequacy && (
          <div>
            <div className="flex items-center justify-between bg-[#EEF2FF] rounded-xl px-4 py-3 mb-7">
              <div>
                <p className="text-sm font-bold text-[#1B3A8C]">Propostas de Adequação à LGPD</p>
                <p className="text-xs text-[#64748B] mt-0.5">{adequacyProposals.length} cláusula(s) identificada(s) para adequação</p>
              </div>
              <span className="text-xs font-bold bg-[#DBEAFE] text-[#1B3A8C] px-3 py-1 rounded-full">{adequacyProposals.length} proposta(s)</span>
            </div>

            {adequacyProposals.map((p, i) => (
              <div key={i} className="mb-8 break-inside-avoid">
                <div className="flex items-center gap-3 mb-3">
                  <span style={{ width: 28, height: 28, minWidth: 28, borderRadius: '50%', background: '#1B3A8C', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>{i + 1}</span>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-[#1a2a5e]">{p.reference}</span>
                    <span className="text-xs bg-[#EEF2FF] text-[#1B3A8C] px-2 py-0.5 rounded-full font-medium">{p.lgpd_basis}</span>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 10 }}>
                  <div className="bg-[#FFF5F5] rounded-xl p-3">
                    <p style={{ fontSize: 10, fontWeight: 700, color: '#DC2626', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Texto Original</p>
                    <p className="text-xs text-[#475569] leading-relaxed italic">{p.original}</p>
                  </div>
                  <div className="bg-[#F0FDF4] rounded-xl p-3">
                    <p style={{ fontSize: 10, fontWeight: 700, color: '#16A34A', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Texto Proposto</p>
                    <p className="text-xs text-[#475569] leading-relaxed">{p.proposed}</p>
                  </div>
                </div>

                <div className="bg-[#FFFBEB] rounded-xl p-3">
                  <p style={{ fontSize: 10, fontWeight: 700, color: '#D97706', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Justificativa</p>
                  <p className="text-xs text-[#475569] leading-relaxed">{p.justification}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Score + Summary ─────────────────────────────────────────── */}
        {!isAdequacy && <div className="flex items-center gap-8 mb-7">
          <div className="flex flex-col items-center flex-shrink-0">
            <div className="relative w-24 h-24">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                <circle cx="50" cy="50" r="40" fill="none" stroke="#E2E8F0" strokeWidth="10" />
                <circle
                  cx="50" cy="50" r="40" fill="none"
                  stroke={scoreColor}
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 40 * (report.compliance_score ?? 0) / 100} ${2 * Math.PI * 40}`}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-bold" style={{ color: scoreColor }}>{report.compliance_score ?? 0}%</span>
              </div>
            </div>
            <p className="text-xs text-[#64748B] mt-1">Conformidade</p>
          </div>
          <div className="flex-1">
            <h2 className="text-sm font-bold text-[#1B3A8C] mb-2 uppercase tracking-wide">Resumo Executivo</h2>
            <p className="text-sm text-[#475569] leading-relaxed">{report.summary}</p>
          </div>
        </div>}

        {/* ── Critérios ───────────────────────────────────────────────── */}
        {!isAdequacy && report.criteria_used && (
          <div className="mb-7">
            <h2 className="text-sm font-bold text-[#1B3A8C] uppercase tracking-wide mb-2">Critérios Utilizados</h2>
            <p className="text-xs text-[#64748B] leading-relaxed bg-[#F8FAFC] rounded-lg p-3">{report.criteria_used}</p>
          </div>
        )}

        {/* ── Prompt Responses ────────────────────────────────────────── */}
        {!isAdequacy && (report.prompt_responses ?? []).length > 0 && (
          <div className="mb-7">
            <h2 className="text-sm font-bold text-[#4338CA] uppercase tracking-wide mb-3">Respostas às Instruções do Gestor</h2>
            <div className="space-y-3">
              {(report.prompt_responses ?? []).map((r, i) => (
                <div key={i} className="bg-[#EEF2FF] rounded-lg p-4">
                  <p className="text-sm font-semibold text-[#1a2a5e] mb-1">{r.prompt}</p>
                  <p className="text-sm text-[#475569] leading-relaxed whitespace-pre-line">{r.response}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Points sections ─────────────────────────────────────────── */}
        {!isAdequacy && [
          {
            key: 'conforming', label: 'Pontos em Conformidade',
            points: report.conforming_points ?? [],
            headerBg: '#F0FDF4', headerText: '#16A34A', rowBorder: '#DCFCE7', badge: '#DCFCE7',
          },
          {
            key: 'partial', label: 'Parcialmente Conformes',
            points: report.partial_points ?? [],
            headerBg: '#FFFBEB', headerText: '#D97706', rowBorder: '#FEF3C7', badge: '#FEF3C7',
          },
          {
            key: 'non_conforming', label: 'Não Conformes',
            points: report.non_conforming_points ?? [],
            headerBg: '#FFF5F5', headerText: '#DC2626', rowBorder: '#FEE2E2', badge: '#FEE2E2',
          },
        ].map(section => section.points.length > 0 && (
          <div key={section.key} className="mb-7 break-inside-avoid">
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-t-xl" style={{ backgroundColor: section.headerBg }}>
              <span className="text-sm font-bold" style={{ color: section.headerText }}>{section.label}</span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: section.badge, color: section.headerText }}>
                {section.points.length}
              </span>
            </div>
            <div className="border-2 border-t-0 rounded-b-xl divide-y divide-[#F1F5F9]" style={{ borderColor: section.rowBorder }}>
              {section.points.map((point, i) => (
                <div key={i} className="px-4 py-3 bg-white">
                  <p className="text-sm font-semibold text-[#1a2a5e]">{point.item}</p>
                  <p className="text-xs text-[#64748B] mt-1 leading-relaxed">{point.description}</p>
                  {point.reference && (
                    <span className="inline-block mt-1.5 text-xs bg-[#EEF2FF] text-[#1B3A8C] px-2 py-0.5 rounded-full">
                      {point.reference}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* ── Sugestões ───────────────────────────────────────────────── */}
        {!isAdequacy && (report.improvement_suggestions ?? []).length > 0 && (
          <div className="mb-7 break-inside-avoid">
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-t-xl bg-[#EEF2FF]">
              <span className="text-sm font-bold text-[#1B3A8C]">Sugestões de Melhoria</span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#DBEAFE] text-[#1B3A8C]">
                {report.improvement_suggestions.length}
              </span>
            </div>
            <div className="border-2 border-t-0 border-[#DBEAFE] rounded-b-xl divide-y divide-[#F1F5F9]">
              {report.improvement_suggestions.map((s, i) => {
                const priorityColors: Record<string, { bg: string; text: string; label: string }> = {
                  alta: { bg: '#FEE2E2', text: '#DC2626', label: 'Alta' },
                  media: { bg: '#FEF3C7', text: '#D97706', label: 'Média' },
                  baixa: { bg: '#DCFCE7', text: '#16A34A', label: 'Baixa' },
                }
                const pc = priorityColors[s.priority] ?? priorityColors.media
                return (
                  <div key={i} className="px-4 py-3 bg-white">
                    <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full mb-1.5" style={{ backgroundColor: pc.bg, color: pc.text }}>
                      Prioridade {pc.label}
                    </span>
                    <p className="text-sm font-semibold text-[#1a2a5e]">{s.item}</p>
                    <p className="text-xs text-[#64748B] mt-1 leading-relaxed">{s.suggestion}</p>
                    {s.reference && (
                      <span className="inline-block mt-1.5 text-xs bg-[#EEF2FF] text-[#1B3A8C] px-2 py-0.5 rounded-full">
                        {s.reference}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Conclusão ───────────────────────────────────────────────── */}
        {!isAdequacy && report.conclusion && (
          <div className="mb-7 break-inside-avoid">
            <h2 className="text-sm font-bold text-[#1B3A8C] uppercase tracking-wide mb-3">Conclusão da Análise</h2>
            <div className="bg-[#F8FAFC] rounded-xl p-4">
              <p className="text-sm text-[#475569] leading-relaxed whitespace-pre-line">{report.conclusion}</p>
            </div>
          </div>
        )}

        {/* ── Footer ──────────────────────────────────────────────────── */}
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
