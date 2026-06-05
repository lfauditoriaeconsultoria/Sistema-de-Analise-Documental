'use client'

import { useState } from 'react'
import { Printer, X, FileDown } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  analysisId: string
  documentName: string
}

export function PrintActions({ analysisId, documentName }: Props) {
  const [downloading, setDownloading] = useState(false)

  async function handleDocxDownload() {
    setDownloading(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`/api/reports/${analysisId}/docx`, {
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      })
      if (!res.ok) throw new Error('Erro ao gerar documento')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const safe = documentName.replace(/[^a-zA-Z0-9À-ú\s-]/g, '').trim().replace(/\s+/g, '-')
      a.download = `relatorio-${safe}.docx`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      alert('Não foi possível gerar o arquivo DOCX.')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="print:hidden fixed bottom-6 right-6 flex gap-3 z-50">
      <button
        onClick={() => window.close()}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-[#E2E8F0] text-[#64748B] text-sm font-medium shadow-lg hover:bg-[#F8FAFC] transition-colors"
      >
        <X size={15} />
        Fechar
      </button>
      <button
        onClick={handleDocxDownload}
        disabled={downloading}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#16A34A] text-white text-sm font-semibold shadow-lg hover:bg-[#15803D] transition-colors disabled:opacity-60"
      >
        <FileDown size={15} />
        {downloading ? 'Gerando...' : 'Baixar DOCX'}
      </button>
      <button
        onClick={() => window.print()}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1B3A8C] text-white text-sm font-semibold shadow-lg hover:bg-[#2D6BE4] transition-colors"
      >
        <Printer size={15} />
        Imprimir / PDF
      </button>
    </div>
  )
}
