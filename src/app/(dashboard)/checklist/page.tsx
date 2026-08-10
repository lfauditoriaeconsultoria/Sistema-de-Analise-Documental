import Link from 'next/link'
import { TableProperties, ClipboardCheck, ArrowRight } from 'lucide-react'

export const metadata = { title: 'Checklist de Auditoria OEA — LF Auditoria' }

export default function ChecklistIndexPage() {
  return (
    <div className="p-6 max-w-4xl mx-auto">

      {/* Cabeçalho */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Checklist de Auditoria OEA</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Fluxo em duas etapas: geração da estrutura de auditoria e avaliação das evidências do cliente.
        </p>
      </div>

      {/* Cards das etapas */}
      <div className="grid gap-5 sm:grid-cols-2">

        {/* Etapa 1 */}
        <Link
          href="/checklist/generate"
          className="group relative flex flex-col rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-6 shadow-sm hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-md transition-all"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 rounded-lg bg-blue-100 dark:bg-blue-900/40 group-hover:bg-blue-200 dark:group-hover:bg-blue-800/50 transition-colors">
              <TableProperties size={22} className="text-blue-600 dark:text-blue-400" />
            </div>
            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide">Etapa 1</span>
          </div>

          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
            Gerador de Checklist
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 flex-1">
            A IA analisa os procedimentos e políticas do cliente e gera o checklist de auditoria
            (colunas A–P) em formato Excel, mapeando cada processo ao requisito OEA correto.
          </p>

          <div className="mt-5 flex items-center gap-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 group-hover:gap-2.5 transition-all">
            Gerar checklist <ArrowRight size={15} />
          </div>

          {/* Indicador de ordem */}
          <div className="absolute top-4 right-4 w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
            1
          </div>
        </Link>

        {/* Etapa 2 */}
        <Link
          href="/checklist/evaluate"
          className="group relative flex flex-col rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-6 shadow-sm hover:border-green-400 dark:hover:border-green-500 hover:shadow-md transition-all"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 rounded-lg bg-green-100 dark:bg-green-900/40 group-hover:bg-green-200 dark:group-hover:bg-green-800/50 transition-colors">
              <ClipboardCheck size={22} className="text-green-600 dark:text-green-400" />
            </div>
            <span className="text-xs font-semibold text-green-600 dark:text-green-400 uppercase tracking-wide">Etapa 2</span>
          </div>

          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
            Avaliação de Evidências
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 flex-1">
            Envie o checklist da Etapa 1 junto com as evidências do cliente. A IA avalia cada
            requisito e preenche as colunas de atendimento (Q–T) e constatação (W–AA).
          </p>

          <div className="mt-5 flex items-center gap-1.5 text-sm font-medium text-green-600 dark:text-green-400 group-hover:gap-2.5 transition-all">
            Avaliar evidências <ArrowRight size={15} />
          </div>

          {/* Indicador de ordem */}
          <div className="absolute top-4 right-4 w-7 h-7 rounded-full bg-green-600 text-white text-xs font-bold flex items-center justify-center">
            2
          </div>
        </Link>
      </div>

      {/* Fluxo resumido */}
      <div className="mt-8 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-5 py-4">
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Fluxo de trabalho</p>
        <ol className="space-y-2">
          {[
            { step: '1', text: 'Faça upload dos procedimentos e políticas do cliente → gere o checklist (Etapa 1).' },
            { step: '2', text: 'Preencha manualmente as colunas B (data) e C (auditor) na planilha, se necessário.' },
            { step: '3', text: 'Colete as evidências do cliente referentes a cada item do checklist.' },
            { step: '4', text: 'Faça upload do checklist preenchido + evidências → avalie com a IA (Etapa 2).' },
            { step: '5', text: 'Baixe a planilha com colunas Q–AA preenchidas e gere o Relatório de Auditoria (Etapa 3).' },
          ].map(({ step, text }) => (
            <li key={step} className="flex items-start gap-3 text-sm text-gray-600 dark:text-gray-400">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 text-xs font-bold flex items-center justify-center mt-0.5">
                {step}
              </span>
              {text}
            </li>
          ))}
        </ol>
      </div>

    </div>
  )
}
