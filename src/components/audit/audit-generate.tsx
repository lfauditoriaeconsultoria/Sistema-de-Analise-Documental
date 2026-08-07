'use client'

import { useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Upload, FileSpreadsheet, Loader2,
  FileText, AlertTriangle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { AuditReportData } from '@/types/audit'
import { createClient } from '@/lib/supabase/client'

export function AuditGeneratePage() {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = (f: File) => {
    const ext = f.name.split('.').pop()?.toLowerCase()
    if (ext !== 'xlsx' && ext !== 'xls') {
      setError('Formato inválido. Envie um arquivo Excel (.xlsx ou .xls).')
      return
    }
    if (f.size > 10 * 1024 * 1024) {
      setError('Arquivo muito grande. O limite é 10 MB.')
      return
    }
    setFile(f)
    setError(null)
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }, [])

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragging(true) }
  const onDragLeave = () => setDragging(false)

  const handleSubmit = async () => {
    if (!file) return
    setLoading(true)
    setError(null)

    try {
      // 1. Gera o relatório via IA
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/audit/generate', { method: 'POST', body: formData })
      const json = await res.json()

      if (!res.ok) {
        setError(json.error ?? 'Erro ao gerar relatório.')
        return
      }

      const report = json.report as AuditReportData
      setLoading(false)
      setSaving(true)

      // 2. Salva no banco (requer token do usuário)
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const saveRes = await fetch('/api/audit/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ report }),
      })
      const saveData = await saveRes.json()

      if (saveRes.ok && saveData.id) {
        router.push(`/audit/${saveData.id}`)
      } else {
        // Falha ao salvar — vai para /audit/generate com relatório em memória
        setError('Relatório gerado, mas não foi possível salvar. Tente baixar o PDF/Word antes de fechar.')
      }
    } catch {
      setError('Erro de conexão. Tente novamente.')
      setLoading(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Back + title */}
      <div className="flex items-center gap-3">
        <Link href="/audit">
          <Button variant="ghost" size="sm" className="gap-1.5">
            <ArrowLeft size={14} /> Auditoria OEA
          </Button>
        </Link>
        <span className="text-[#94A3B8]">/</span>
        <h1 className="text-lg font-bold text-[#1a2a5e] dark:text-[#e2e8f0]">Gerar Relatório Executivo</h1>
      </div>

      <Card padding="md" className="max-w-2xl">
        <h2 className="font-semibold text-[#1a2a5e] dark:text-[#e2e8f0] mb-1">Planilha de Auditoria</h2>
        <p className="text-sm text-[#64748B] dark:text-[#94a3b8] mb-4">
          Envie a planilha Excel preenchida. A IA analisará e gerará o relatório executivo completo automaticamente.
        </p>

        {/* Drop zone */}
        <div
          onClick={() => inputRef.current?.click()}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          className={cn(
            'border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-3 cursor-pointer transition-all',
            dragging
              ? 'border-[#1B3A8C] bg-[#EEF2FF] dark:bg-[#1e3570]/30'
              : file
              ? 'border-green-400 bg-green-50 dark:bg-green-900/10'
              : 'border-[#CBD5E1] dark:border-[#1e3570] hover:border-[#1B3A8C] dark:hover:border-blue-400 hover:bg-[#F8FAFC] dark:hover:bg-[#0d1f4a]'
          )}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
          />
          {file ? (
            <>
              <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <FileSpreadsheet size={24} className="text-green-600 dark:text-green-400" />
              </div>
              <div className="text-center">
                <p className="font-medium text-sm text-[#1a2a5e] dark:text-[#e2e8f0]">{file.name}</p>
                <p className="text-xs text-[#64748B] dark:text-[#94a3b8] mt-0.5">
                  {(file.size / 1024).toFixed(0)} KB · Clique para trocar
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="w-12 h-12 rounded-xl bg-[#EEF2FF] dark:bg-[#1e3570]/40 flex items-center justify-center">
                <Upload size={24} className="text-[#1B3A8C] dark:text-blue-400" />
              </div>
              <div className="text-center">
                <p className="font-medium text-sm text-[#1a2a5e] dark:text-[#e2e8f0]">
                  Arraste o arquivo ou clique para selecionar
                </p>
                <p className="text-xs text-[#64748B] dark:text-[#94a3b8] mt-0.5">Excel (.xlsx, .xls) · Máx. 10 MB</p>
              </div>
            </>
          )}
        </div>

        {error && (
          <div className="mt-3 flex items-start gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 rounded-lg p-3">
            <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <Button
            onClick={handleSubmit}
            disabled={!file || loading || saving}
            className="gap-2 min-w-44"
          >
            {loading ? (
              <><Loader2 size={15} className="animate-spin" /> Analisando…</>
            ) : saving ? (
              <><Loader2 size={15} className="animate-spin" /> Salvando…</>
            ) : (
              <><FileText size={15} /> Gerar Relatório</>
            )}
          </Button>
        </div>

        {loading && (
          <p className="text-xs text-center text-[#64748B] dark:text-[#94a3b8] mt-2">
            A análise pode levar entre 1 e 3 minutos dependendo do tamanho da planilha.
          </p>
        )}
        {saving && (
          <p className="text-xs text-center text-[#64748B] dark:text-[#94a3b8] mt-2">
            Salvando relatório no histórico…
          </p>
        )}
      </Card>
    </div>
  )
}
