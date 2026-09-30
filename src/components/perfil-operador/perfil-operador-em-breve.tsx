import Link from 'next/link'
import { IdCard, Hammer, ArrowLeft } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

/**
 * Tela exibida a colaboradores não administradores enquanto o módulo Perfil
 * Operador está em desenvolvimento. O bloqueio real é feito no servidor
 * (páginas e rotas de API) — esta tela é só a comunicação ao usuário.
 */
export function PerfilOperadorEmBreve() {
  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      <Card padding="lg" className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-[#EEF2FF] dark:bg-[#1e3570]/60 flex items-center justify-center mx-auto mb-5">
          <IdCard size={30} className="text-[#1B3A8C] dark:text-blue-400" />
        </div>

        <h1 className="text-2xl font-bold text-[#1a2a5e] dark:text-[#e2e8f0] mb-2">
          Perfil Operador
        </h1>

        <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-[#FEF3C7] dark:bg-amber-900/30 text-[#D97706] dark:text-amber-400 border border-[#FDE68A] dark:border-amber-700 mb-5">
          <Hammer size={12} /> Em desenvolvimento
        </span>

        <p className="text-sm text-[#64748B] dark:text-[#94a3b8] leading-relaxed max-w-md mx-auto mb-2">
          Este módulo está em processo de desenvolvimento e ainda não foi liberado
          para uso. Ele vai auxiliar na elaboração das respostas do Perfil do
          Operador do Programa OEA, com apoio de IA.
        </p>
        <p className="text-sm font-medium text-[#1B3A8C] dark:text-blue-400 mb-7">
          Lançamento em breve.
        </p>

        <Link href="/dashboard">
          <Button variant="secondary" className="gap-2">
            <ArrowLeft size={15} /> Voltar ao painel
          </Button>
        </Link>
      </Card>
    </div>
  )
}
