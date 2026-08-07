export interface AuditReportItem {
  requisito: string
  item: string
  tema: string
  controle: string
  classificacao: 'Conforme' | 'Parcialmente Conforme' | 'Não Conforme' | 'Não Aplicável' | 'Não Verificado' // 'Parcialmente Conforme' mantido para compatibilidade com relatórios antigos
  nao_conformidades: string
  recomendacoes: string
  percentual_conformidade: number | null
}

export interface AuditReportStats {
  total: number
  conforme: number
  parcialmente?: number  // opcional — planilhas novas não terão coluna parcial
  nao_conforme: number
  nao_aplicavel: number
  nao_verificado: number
  indice_conformidade: number
}

export interface AuditReportData {
  empresa: string
  criterio: string
  requisitos: string
  periodo: string
  metodologia: string
  auditor: string
  procedimento_referencia: string
  emissao: string

  stats: AuditReportStats

  /** Texto da Seção 2 com a fórmula e os números reais da planilha,
   *  ex: "(20 + 1 × 0,5) / (21 − 0) = 20,5 / 21 = 97,6%" */
  indice_calculo_descricao?: string

  resumo_executivo: string[]
  itens: AuditReportItem[]
  nota_atencao: string

  total_nao_conformidades: number
  total_recomendacoes: number
  item_maior_atencao: string

  conclusao: string[]
}
