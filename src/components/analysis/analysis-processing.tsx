'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  analysisId: string
  documentName: string
}

export function AnalysisProcessing({ analysisId, documentName }: Props) {
  const router = useRouter()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => setElapsed(s => s + 1), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const supabase = createClient()
    let stopped = false

    async function poll() {
      if (stopped) return
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const res = await fetch(`/api/analyses/${analysisId}/status`, {
          headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
        })
        if (!res.ok) return
        const json = await res.json()
        if (json.status === 'completed') {
          router.refresh()
        } else if (json.status === 'failed') {
          setErrorMessage(json.errorMessage ?? 'Erro desconhecido na análise.')
        }
      } catch {
        // network error, retry next tick
      }
    }

    const interval = setInterval(poll, 3000)
    poll()
    return () => { stopped = true; clearInterval(interval) }
  }, [analysisId, router])

  const mins = Math.floor(elapsed / 60)
  const secs = elapsed % 60
  const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`

  if (errorMessage) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center px-4">
        <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
          <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-[#1a2a5e] dark:text-white mb-2">Erro na análise</h2>
          <p className="text-sm text-[#64748B] dark:text-[#94a3b8] max-w-md">{errorMessage}</p>
        </div>
        <button
          onClick={() => router.push('/analysis/new')}
          className="px-5 py-2.5 rounded-xl bg-[#1B3A8C] text-white text-sm font-semibold hover:bg-[#1a2a5e] transition-colors"
        >
          Tentar novamente
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center px-4">
      <div className="relative w-20 h-20">
        <div className="w-20 h-20 rounded-full border-4 border-[#E2E8F0] dark:border-[#1e3a6e]" />
        <Loader2 className="absolute inset-0 w-20 h-20 text-[#1B3A8C] animate-spin" />
      </div>
      <div>
        <h2 className="text-xl font-bold text-[#1a2a5e] dark:text-white mb-2">Analisando documento…</h2>
        <p className="text-sm text-[#64748B] dark:text-[#94a3b8] max-w-sm">
          A IA está processando <span className="font-medium text-[#1a2a5e] dark:text-white">{documentName}</span>.
          Isso pode levar até 1 minuto.
        </p>
      </div>
      <p className="text-xs text-[#94A3B8] tabular-nums">{timeStr} decorrido</p>
    </div>
  )
}
