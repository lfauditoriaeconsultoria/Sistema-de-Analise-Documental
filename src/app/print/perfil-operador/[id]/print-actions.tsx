'use client'

import { Printer, X } from 'lucide-react'

export function PrintActions() {
  return (
    <div className="print:hidden fixed bottom-6 right-6 flex gap-3 z-50">
      <button
        onClick={() => window.close()}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-[#E2E8F0] text-[#64748B] text-sm font-medium shadow-lg hover:bg-[#F8FAFC] transition-colors"
      >
        <X size={15} /> Fechar
      </button>
      <button
        onClick={() => window.print()}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1B3A8C] text-white text-sm font-semibold shadow-lg hover:bg-[#2D6BE4] transition-colors"
      >
        <Printer size={15} /> Imprimir / Salvar PDF
      </button>
    </div>
  )
}
