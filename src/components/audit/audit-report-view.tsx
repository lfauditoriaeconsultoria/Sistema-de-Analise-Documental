'use client'

import React from 'react'
import { AuditReportData } from '@/types/audit'

/** Converte **negrito** em <strong> para o preview HTML */
function renderMd(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/)
  return parts.map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i}>{part.slice(2, -2)}</strong>
      : part
  )
}

/* ── Paleta ── */
const C = {
  navy:    '#123E7C',
  blue:    '#1B5FAA',
  green:   '#2BA05A',
  amber:   '#E8A020',
  amberTx: '#C8860E',
  red:     '#C0392B',
  gray:    '#5A6A7A',
  text:    '#2C3743',
  border:  '#D6E2EF',
  bgSoft:  '#F4F8FC',
  bgTotal: '#EAF1F9',
}

/* ── Formatação ── */
function fmtPct(v: number): string {
  return v.toFixed(1).replace('.', ',') + '%'
}

function scoreColor(v: number): string {
  if (v >= 80) return C.green
  if (v >= 50) return C.amber
  return C.red
}

function classColor(cls: string): string {
  if (cls === 'Conforme')             return C.green
  if (cls === 'Parcialmente Conforme') return C.amber
  if (cls === 'Não Conforme')          return C.red
  return C.gray
}

/* ── Agrupamento Seção 3 ── */
interface ReqGroup {
  requisito: string
  tema:      string
  total:     number
  conf:      number
  parc:      number
  nc:        number
  na:        number
  rec:       number
  pct:       number
}

function groupByRequisito(itens: AuditReportData['itens']): ReqGroup[] {
  const map = new Map<string, ReqGroup>()
  for (const it of itens) {
    if (!map.has(it.requisito)) {
      map.set(it.requisito, { requisito: it.requisito, tema: it.tema, total: 0, conf: 0, parc: 0, nc: 0, na: 0, rec: 0, pct: 0 })
    }
    const g = map.get(it.requisito)!
    g.total++
    if (it.classificacao === 'Conforme')              g.conf++
    else if (it.classificacao === 'Parcialmente Conforme') g.parc++
    else if (it.classificacao === 'Não Conforme')     g.nc++
    else if (it.classificacao === 'Não Aplicável')    g.na++
    const temRec = it.recomendacoes && it.recomendacoes.trim() !== '' && it.recomendacoes !== '—'
    if (temRec) g.rec++
  }
  for (const [, g] of map) {
    const base = g.total - g.na || 1
    g.pct = ((g.conf + g.parc * 0.5) / base) * 100
  }
  // Ordem crescente numérica: 5.1 < 5.3 < 5.9 < 5.10 < 5.12
  return Array.from(map.values()).sort((a, b) => {
    const parse = (r: string) => {
      const m = r.match(/(\d+)(?:\.(\d+))?/)
      return m ? parseInt(m[1]) * 100 + parseInt(m[2] ?? '0') : 0
    }
    return parse(a.requisito) - parse(b.requisito)
  })
}

/** Remove "Santos/SP…LF Auditoria e Consultoria" de dentro dos parágrafos da conclusão */
function processConclusion(conclusao: string[], emissao: string) {
  const sigDate = `Santos/SP, ${emissao}.`
  const cleanParas = conclusao
    .map(p => {
      const idx = p.search(/Santos\/SP/i)
      return idx === -1 ? p : p.slice(0, idx).trim()
    })
    .filter(p => p.trim().length > 0)
  return { paras: cleanParas, sigDate }
}

/* ── Sub-componentes ── */
function PageHeader({ empresa }: { empresa: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '10px 0 8px', borderBottom: `2px solid ${C.blue}`, marginBottom: '16px' }}>
      <span style={{ fontSize: '11px', fontWeight: 700, color: C.navy }}>LF Auditoria e Consultoria</span>
      <span style={{ fontSize: '9px', color: C.gray }}>Relatório Executivo de Auditoria — Monitoramento OEA-S · {empresa}</span>
    </div>
  )
}

function PageFooter({ page, total }: { page: number; total: number }) {
  return (
    <div style={{ marginTop: '20px', paddingTop: '8px', borderTop: `1px solid ${C.border}`,
      display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: C.gray }}>
      <span>LF Auditoria e Consultoria · lfconsultoria.srv.br</span>
      <span>Página {page} de {total}</span>
    </div>
  )
}

function SectionTitle({ num, title }: { num: string; title: string }) {
  return (
    <div style={{ marginBottom: '14px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
        <span style={{ fontSize: '20px', fontWeight: 700, color: C.green }}>{num}.</span>
        <span style={{ fontSize: '18px', fontWeight: 700, color: C.blue }}>{title}</span>
      </div>
      <div style={{ height: '2px', background: C.blue, marginTop: '4px' }} />
    </div>
  )
}

function StatCard({ label, value, sublabel, color }: { label: string; value: string | number; sublabel?: string; color: string }) {
  return (
    <div className="stat-card" style={{
      border: `1px solid ${C.border}`, borderTop: `4px solid ${color}`,
      borderRadius: '6px', padding: '10px 8px', background: '#fff',
      textAlign: 'center', breakInside: 'avoid', pageBreakInside: 'avoid',
    }}>
      <div className="stat-card-val" style={{ fontSize: '22px', fontWeight: 700, color, lineHeight: 1.2 }}>{value}</div>
      <div className="stat-card-lbl" style={{ fontSize: '9px', color: C.gray, marginTop: '3px', lineHeight: 1.3 }}>{label}</div>
      {sublabel && <div style={{ fontSize: '9px', color: C.gray }}>{sublabel}</div>}
    </div>
  )
}

/* ── COMPONENTE PRINCIPAL ── */
interface Props { report: AuditReportData }

export function AuditReportView({ report }: Props) {
  const { stats } = report
  const TOTAL_PAGES = 7
  const grupos = groupByRequisito(report.itens)
  const { paras: conclusaoParas, sigDate } = processConclusion(report.conclusao, report.emissao)

  /* Totais consolidados para linha de total da tabela */
  const totConf  = grupos.reduce((a, g) => a + g.conf, 0)
  const totParc  = grupos.reduce((a, g) => a + g.parc, 0)
  const totNC    = grupos.reduce((a, g) => a + g.nc, 0)
  const totRec   = grupos.reduce((a, g) => a + g.rec, 0)
  const totItens = grupos.reduce((a, g) => a + g.total, 0)

  /* Donut */
  const R = 64, CX = 80, CY = 80
  const CIRC = 2 * Math.PI * R
  type Slice = { label: string; value: number; color: string }
  const slices: Slice[] = [
    { label: 'Conforme',              value: stats.conforme,          color: C.green },
    { label: 'Parcialmente Conforme', value: stats.parcialmente ?? 0, color: C.amber },
    { label: 'Não Conforme',          value: stats.nao_conforme,      color: C.red   },
    { label: 'Não Aplicável',         value: stats.nao_aplicavel,     color: C.gray  },
  ].filter(s => s.value > 0)
  const sliceTotal = stats.total || 1
  let offset = 0
  const arcs = slices.map(s => {
    const dash = (s.value / sliceTotal) * CIRC
    const arc = { ...s, dash, offset }
    offset += dash
    return arc
  })

  const sectionPad: React.CSSProperties = { padding: '24px 40px 0', background: '#fff' }

  return (
    <div
      id="audit-report"
      style={{ fontFamily: '"DejaVu Sans", Arial, sans-serif', color: C.text,
        background: '#fff', maxWidth: '900px', margin: '0 auto',
        fontSize: '13px', lineHeight: '1.65' }}
    >

      {/* ════════════════════════════════════════
          CAPA
          ════════════════════════════════════════ */}
      {/* cover-page usa @page cover-pg { margin: 0 } → faixa azul e verde são full-bleed
          height: 297mm = A4 exato; position relative → rodapé absoluto na borda inferior */}
      <div className="print-page cover-page" style={{
        position: 'relative',
        height: '297mm',
        display: 'flex',
        flexDirection: 'column',
        pageBreakAfter: 'always',
        background: '#fff',
        overflow: 'hidden',
        boxSizing: 'border-box',
        paddingBottom: '30mm', /* reserva espaço para o rodapé absoluto */
      }}>
        {/* Faixa azul-marinho — full-bleed (sem padding externo da page) */}
        <div style={{ background: `linear-gradient(135deg, ${C.navy} 0%, ${C.blue} 100%)`,
          padding: '44px 48px 36px', color: '#fff' }}>
          <div style={{ fontSize: '32px', fontWeight: 700, letterSpacing: '0.5px' }}>Relatório de Auditoria</div>
          <div style={{ fontSize: '16px', marginTop: '8px', opacity: 0.88 }}>
            Monitoramento da Certificação OEA-Segurança (OEA-S)
          </div>
        </div>

        {/* Filete verde */}
        <div style={{ height: '6px', background: C.green }} />

        {/* Logotipo + dados da empresa — flex:1 centraliza verticalmente na área disponível */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', padding: '40px 48px 0', gap: '18px' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="LF Auditoria e Consultoria"
            style={{ width: '130px', height: 'auto', objectFit: 'contain' }} />

          <div style={{ textAlign: 'center', marginTop: '8px' }}>
            <div style={{ fontSize: '26px', fontWeight: 700, color: C.navy,
              textTransform: 'uppercase', letterSpacing: '1px' }}>{report.empresa}</div>
            <div style={{ fontSize: '16px', color: C.blue, fontWeight: 600, marginTop: '10px' }}>{report.criterio}</div>
            <div style={{ fontSize: '13px', color: C.gray, marginTop: '8px', maxWidth: '520px' }}>{report.requisitos}</div>
          </div>

          {report.auditor && (
            <div style={{ fontSize: '12px', color: C.gray, textAlign: 'center' }}>
              <strong>Auditor:</strong> {report.auditor}
            </div>
          )}
        </div>

        {/* Rodapé institucional — absoluto, fixo a 12 mm da borda inferior da folha A4 */}
        <div style={{
          position: 'absolute',
          bottom: '12mm',
          left: 0,
          right: 0,
          textAlign: 'center',
          fontSize: '11px',
          color: C.gray,
          borderTop: `1px solid ${C.border}`,
          paddingTop: '8px',
          paddingLeft: '48px',
          paddingRight: '48px',
        }}>
          LF Auditoria e Consultoria · Compartilhando Conhecimento · lfconsultoria.srv.br
        </div>
      </div>

      {/* ════════════════════════════════════════
          SUMÁRIO
          ════════════════════════════════════════ */}
      <div className="print-page" style={{
        minHeight: '250mm', pageBreakAfter: 'always', background: '#fff',
        padding: '28px 40px 0', display: 'flex', flexDirection: 'column',
      }}>
        <PageHeader empresa={report.empresa} />

        <div style={{ marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span style={{ fontSize: '20px', fontWeight: 700, color: C.green }}>◼</span>
            <span style={{ fontSize: '18px', fontWeight: 700, color: C.blue }}>Sumário</span>
          </div>
          <div style={{ height: '2px', background: C.blue, marginTop: '4px' }} />
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', marginTop: '28px' }}>
          {[
            { titulo: 'Resumo Executivo',              pag: 3 },
            { titulo: 'Índice Geral de Conformidade',  pag: 4 },
            { titulo: 'Resultado por Requisito',       pag: 5 },
            { titulo: 'Quadro Executivo de Resultados',pag: 6 },
            { titulo: 'Conclusão',                     pag: 7 },
          ].map((e, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-end',
              padding: '13px 0', borderBottom: `1px solid ${C.border}` }}>
              <span style={{ fontSize: '15px', fontWeight: 700, color: C.green, minWidth: '30px' }}>{i + 1}.</span>
              <span style={{ fontSize: '14px', color: C.text, fontWeight: 500 }}>{e.titulo}</span>
              <div style={{ flex: 1, margin: '0 10px 5px',
                borderBottom: `1px solid ${C.border}` }} />
              <span style={{ fontSize: '13px', fontWeight: 700, color: C.navy }}>{e.pag}</span>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 'auto', paddingTop: '10px', paddingBottom: '20px',
          borderTop: `1px solid ${C.border}`, display: 'flex',
          justifyContent: 'space-between', fontSize: '9px', color: C.gray }}>
          <span>LF Auditoria e Consultoria · lfconsultoria.srv.br</span>
          <span>Relatório Executivo de Auditoria OEA</span>
        </div>
      </div>

      {/* ════════════════════════════════════════
          SEÇÃO 1 — Resumo Executivo
          ════════════════════════════════════════ */}
      <div className="section-page" style={sectionPad}>
        <PageHeader empresa={report.empresa} />
        <SectionTitle num="1" title="Resumo Executivo" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {report.resumo_executivo.map((p, i) => (
            <p key={i} style={{ margin: 0, textAlign: 'justify' }}>{renderMd(p)}</p>
          ))}
        </div>
        <PageFooter page={3} total={TOTAL_PAGES} />
      </div>

      {/* ════════════════════════════════════════
          SEÇÃO 2 — Índice Geral de Conformidade
          ════════════════════════════════════════ */}
      <div className="section-page" style={sectionPad}>
        <PageHeader empresa={report.empresa} />
        <SectionTitle num="2" title="Índice Geral de Conformidade" />

        {/* "Critério de cálculo:" em negrito + texto */}
        <p style={{ margin: '0 0 18px', textAlign: 'justify' }}>
          {report.indice_calculo_descricao ? (
            <>
              <strong>Critério de cálculo:</strong>{' '}
              {renderMd(report.indice_calculo_descricao.replace(/^[Cc]rit[eé]rio de c[aá]lculo[:\s]*/i, ''))}
            </>
          ) : (
            <>
              <strong>Critério de cálculo:</strong>{' '}
              o índice pondera as classificações registradas na planilha de auditoria, atribuindo peso integral (100%) aos itens
              Conformes e peso zero aos Não Conformes.
              Itens Não Aplicáveis (N/A) são excluídos da base de cálculo.
              Índice apurado: <strong>{fmtPct(stats.indice_conformidade)}</strong>.
            </>
          )}
        </p>

        {/* Cartões de estatísticas — grade dinâmica conforme número de cartões */}
        {(() => {
          const parc = stats.parcialmente ?? 0
          const cards = [
            <StatCard key="total" label="Itens Avaliados" value={stats.total} color={C.blue} />,
            <StatCard key="conf" label="Conformes" value={stats.conforme}
              sublabel={`(${fmtPct((stats.conforme / sliceTotal) * 100)})`} color={C.green} />,
            ...(parc > 0 ? [
              <StatCard key="parc" label="Parcialmente Conf." value={parc}
                sublabel={`(${fmtPct((parc / sliceTotal) * 100)})`} color={C.amber} />
            ] : []),
            <StatCard key="nc" label="Não Conformes" value={stats.nao_conforme}
              sublabel={`(${fmtPct((stats.nao_conforme / sliceTotal) * 100)})`} color={C.red} />,
            <StatCard key="na" label="Não Aplicáveis" value={stats.nao_aplicavel} color={C.gray} />,
          ]
          return (
            <div className="cards-row" style={{
              display: 'grid', gridTemplateColumns: `repeat(${cards.length}, 1fr)`,
              gap: '8px', marginBottom: '24px', breakInside: 'avoid', pageBreakInside: 'avoid',
            }}>
              {cards}
            </div>
          )
        })()}

        {/* Gráfico de rosca + legenda */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '36px',
          marginBottom: '12px', breakInside: 'avoid', pageBreakInside: 'avoid', flexWrap: 'wrap' }}>
          <svg width="160" height="160" viewBox="0 0 160 160">
            {arcs.map((arc, i) => (
              <circle key={i} cx={CX} cy={CY} r={R} fill="none" stroke={arc.color}
                strokeWidth="27"
                strokeDasharray={`${arc.dash} ${CIRC - arc.dash}`}
                strokeDashoffset={-arc.offset + CIRC * 0.25}
                transform={`rotate(-90 ${CX} ${CY})`} />
            ))}
            <text x={CX} y={CY - 8} textAnchor="middle" fontSize="18"
              fontWeight="bold" fill={C.navy}>{fmtPct(stats.indice_conformidade)}</text>
            <text x={CX} y={CY + 10} textAnchor="middle" fontSize="9" fill={C.gray}>Conformidade</text>
            <text x={CX} y={CY + 22} textAnchor="middle" fontSize="9" fill={C.gray}>Geral</text>
          </svg>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {slices.map(s => (
              <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                <div style={{ width: '13px', height: '13px', borderRadius: '3px',
                  background: s.color, flexShrink: 0 }} />
                <span style={{ color: C.gray }}>{s.label} —</span>
                <span style={{ fontWeight: 700, color: C.text }}>{s.value}</span>
                <span style={{ color: C.gray }}>({fmtPct((s.value / sliceTotal) * 100)})</span>
              </div>
            ))}
          </div>
        </div>

        {/* Legenda descritiva abaixo do gráfico */}
        <p style={{ fontSize: '11px', color: C.gray, textAlign: 'center', margin: '8px 0 0', fontStyle: 'italic' }}>
          Distribuição das classificações de atendimento dos {stats.total} itens avaliados no critério {report.criterio}.
        </p>

        <PageFooter page={4} total={TOTAL_PAGES} />
      </div>

      {/* ════════════════════════════════════════
          SEÇÃO 3 — Resultado por Requisito
          (consolidada por requisito)
          ════════════════════════════════════════ */}
      <div className="section-page" style={sectionPad}>
        <PageHeader empresa={report.empresa} />
        <SectionTitle num="3" title="Resultado por Requisito" />

        <p style={{ margin: '0 0 14px', textAlign: 'justify' }}>
          A tabela a seguir consolida o desempenho por requisito do critério {report.criterio},
          permitindo identificar as áreas com melhor desempenho e aquelas que demandam maior atenção.
          O percentual de conformidade de cada requisito segue o mesmo critério de ponderação do índice geral.
        </p>

        <div id="s3-table-wrap" style={{ overflowX: 'visible', marginBottom: '12px' }}>
          <table id="s3-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ background: C.blue, color: '#fff' }}>
                {['Requisito', 'Tema Principal', 'Itens Aval.', 'Conf.', 'Parc.', 'Não Conf.', 'Recomen.', '% Conform.'].map(h => (
                  <th key={h} style={{ padding: '8px 7px', textAlign: 'left', fontSize: '11px', fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grupos.map((g, i) => (
                <tr key={g.requisito} style={{ background: i % 2 === 0 ? '#fff' : C.bgSoft,
                  breakInside: 'avoid', pageBreakInside: 'avoid' }}>
                  <td style={{ padding: '7px', fontWeight: 600, whiteSpace: 'nowrap' }}>{g.requisito}</td>
                  <td style={{ padding: '7px' }}>{g.tema}</td>
                  <td style={{ padding: '7px', textAlign: 'center' }}>{g.total}</td>
                  <td style={{ padding: '7px', textAlign: 'center', color: g.conf > 0 ? C.green : C.gray }}>
                    {g.conf > 0 ? g.conf : '—'}
                  </td>
                  <td style={{ padding: '7px', textAlign: 'center', color: g.parc > 0 ? C.amber : C.gray }}>
                    {g.parc > 0 ? g.parc : '—'}
                  </td>
                  <td style={{ padding: '7px', textAlign: 'center', color: g.nc > 0 ? C.red : C.gray }}>
                    {g.nc > 0 ? g.nc : '—'}
                  </td>
                  <td style={{ padding: '7px', textAlign: 'center', color: g.rec > 0 ? C.amberTx : C.gray }}>
                    {g.rec > 0 ? g.rec : '—'}
                  </td>
                  <td style={{ padding: '7px', textAlign: 'right', fontWeight: 700,
                    color: scoreColor(g.pct), whiteSpace: 'nowrap' }}>{fmtPct(g.pct)}</td>
                </tr>
              ))}
              {/* Linha de totais */}
              <tr style={{ background: C.bgTotal, fontWeight: 700, breakInside: 'avoid', pageBreakInside: 'avoid' }}>
                <td style={{ padding: '8px 7px' }}>Total</td>
                <td style={{ padding: '8px 7px' }}>—</td>
                <td style={{ padding: '8px 7px', textAlign: 'center' }}>{totItens}</td>
                <td style={{ padding: '8px 7px', textAlign: 'center', color: C.green }}>{totConf}</td>
                <td style={{ padding: '8px 7px', textAlign: 'center', color: totParc > 0 ? C.amber : C.gray }}>
                  {totParc > 0 ? totParc : '—'}
                </td>
                <td style={{ padding: '8px 7px', textAlign: 'center', color: totNC > 0 ? C.red : C.gray }}>
                  {totNC > 0 ? totNC : '—'}
                </td>
                <td style={{ padding: '8px 7px', textAlign: 'center', color: totRec > 0 ? C.amberTx : C.gray }}>
                  {totRec > 0 ? totRec : '—'}
                </td>
                <td style={{ padding: '8px 7px', textAlign: 'right', color: scoreColor(stats.indice_conformidade) }}>
                  {fmtPct(stats.indice_conformidade)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {report.nota_atencao && (
          <p style={{ fontSize: '11px', color: C.gray, margin: '4px 0 0' }}>
            {renderMd(report.nota_atencao)}
          </p>
        )}

        <PageFooter page={5} total={TOTAL_PAGES} />
      </div>

      {/* ════════════════════════════════════════
          SEÇÃO 4 — Quadro Executivo de Resultados
          ════════════════════════════════════════ */}
      <div className="section-page" style={sectionPad}>
        <PageHeader empresa={report.empresa} />
        <SectionTitle num="4" title="Quadro Executivo de Resultados" />

        <p style={{ margin: '0 0 14px', color: C.text }}>
          Síntese dos principais indicadores da auditoria do critério {report.criterio}:
        </p>

        {/* 5 cartões em grid — linha única */}
        <div className="cards-row" style={{
          display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)',
          gap: '8px', marginBottom: '20px', breakInside: 'avoid', pageBreakInside: 'avoid',
        }}>
          <StatCard label="Conformidade Geral" value={fmtPct(stats.indice_conformidade)}
            color={scoreColor(stats.indice_conformidade)} />
          <StatCard label="Itens Avaliados"    value={stats.total}                  color={C.blue}    />
          <StatCard label="Itens Conformes"    value={stats.conforme}               color={C.green}   />
          <StatCard label="Não Conformidades"  value={report.total_nao_conformidades} color={C.red}   />
          <StatCard label="Recomendações"      value={report.total_recomendacoes}   color={C.amber}   />
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px',
          breakInside: 'avoid', pageBreakInside: 'avoid' }}>
          <thead>
            <tr style={{ background: C.blue, color: '#fff' }}>
              <th style={{ padding: '8px 10px', textAlign: 'left', width: '42%' }}>Indicador</th>
              <th style={{ padding: '8px 10px', textAlign: 'left' }}>Resultado</th>
            </tr>
          </thead>
          <tbody>
            {([
              ['Critério Auditado',                    report.criterio],
              ['Procedimento de Referência',            report.procedimento_referencia],
              ['Período Analisado',                     report.periodo],
              ['Metodologia Aplicada',                  report.metodologia],
              ['Itens Avaliados',                       String(stats.total)],
              ['Itens Conformes',                       String(stats.conforme)],
              ...((stats.parcialmente ?? 0) > 0 ? [['Itens Parcialmente Conformes', String(stats.parcialmente)] as [string, string]] : []),
              ['Itens Não Conformes',                   String(stats.nao_conforme)],
              ['Itens Não Aplicáveis',                  String(stats.nao_aplicavel)],
              ['Não Conformidades Registradas',         String(report.total_nao_conformidades)],
              ['Recomendações de Melhoria',             String(report.total_recomendacoes)],
              ['Item com Maior Necessidade de Atenção', report.item_maior_atencao],
            ] as [string, string][]).map(([ind, res], i) => (
              <tr key={ind} style={{ background: i % 2 === 0 ? '#fff' : C.bgSoft,
                breakInside: 'avoid', pageBreakInside: 'avoid' }}>
                <td style={{ padding: '7px 10px', fontWeight: 600 }}>{ind}</td>
                <td style={{ padding: '7px 10px' }}>{res}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <PageFooter page={6} total={TOTAL_PAGES} />
      </div>

      {/* ════════════════════════════════════════
          SEÇÃO 5 — Conclusão
          ════════════════════════════════════════ */}
      <div className="section-page" style={sectionPad}>
        <PageHeader empresa={report.empresa} />
        <SectionTitle num="5" title="Conclusão" />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {conclusaoParas.map((p, i) => (
            <p key={i} style={{ margin: 0, textAlign: 'justify' }}>{renderMd(p)}</p>
          ))}
        </div>

        {/* Assinatura separada — sempre exibida abaixo dos parágrafos */}
        <div style={{ marginTop: '40px', paddingTop: '16px', borderTop: `1px solid ${C.border}`,
          fontSize: '12px', color: C.gray }}>
          <p style={{ margin: '0 0 6px' }}>{sigDate}</p>
          <p style={{ margin: 0, fontWeight: 700, color: C.navy }}>LF Auditoria e Consultoria</p>
        </div>

        <PageFooter page={7} total={TOTAL_PAGES} />
      </div>

      {/* ════════════════════════════════════════
          ESTILOS DE IMPRESSÃO (fallback direto)
          ════════════════════════════════════════ */}
      <style>{`
        @page { size: A4; margin: 19mm 19mm 19mm 25mm; }
        @page cover-pg { size: A4; margin: 0; }
        .cover-page { page: cover-pg; }
        @media print {
          body * { visibility: hidden; }
          #audit-report, #audit-report * { visibility: visible; }
          #audit-report {
            position: absolute; top: 0; left: 0;
            width: 100%; max-width: none !important;
            background: #fff;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .print-page {
            page-break-after: always; break-after: page;
            min-height: 0 !important;
          }
          .section-page {
            break-before: page; page-break-before: always;
          }
          .stat-card        { break-inside: avoid; page-break-inside: avoid; }
          .cards-row        { break-inside: avoid; page-break-inside: avoid; }
          #s3-table-wrap    { overflow: visible !important; }
          #s3-table tr      { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>
    </div>
  )
}
