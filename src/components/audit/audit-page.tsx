'use client'

import Link from 'next/link'
import { ClipboardList, FileSpreadsheet, FileCheck, FileText, Lock } from 'lucide-react'

interface AuditOption {
  icon: React.ReactNode
  title: string
  description: string
  href?: string
  enabled: boolean
  badge?: string
  adminOnly?: boolean
}

function getOptions(isAdmin: boolean): AuditOption[] {
  return [
    {
      icon: <FileSpreadsheet size={32} />,
      title: 'Elaborar Checklist',
      description:
        'Crie uma planilha de auditoria personalizada com base nos procedimentos e documentos de referência de cada cliente.',
      href: '/checklist/generate',
      enabled: isAdmin,
      badge: isAdmin ? 'Beta' : undefined,
      adminOnly: true,
    },
    {
      icon: <FileCheck size={32} />,
      title: 'Preencher Checklist',
      description:
        'Preencha a planilha de auditoria com base nas evidências e nos documentos encaminhados pelo cliente.',
      href: '/checklist/evaluate',
      enabled: isAdmin,
      badge: isAdmin ? 'Beta' : undefined,
      adminOnly: true,
    },
    {
      icon: <FileText size={32} />,
      title: 'Gerar Relatório Executivo',
      description:
        'Envie a planilha de auditoria preenchida e a IA gerará automaticamente um relatório executivo completo para download em PDF e Word.',
      href: '/audit/generate',
      enabled: true,
    },
  ]
}

interface AuditPageProps {
  isAdmin: boolean
}

export function AuditPage({ isAdmin }: AuditPageProps) {
  const options = getOptions(isAdmin)

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-[#EEF2FF] dark:bg-[#1e3570]/60 flex items-center justify-center">
            <ClipboardList size={20} className="text-[#1B3A8C] dark:text-blue-400" />
          </div>
          <h1 className="text-2xl font-bold text-[#1a2a5e] dark:text-[#e2e8f0]">Auditoria OEA</h1>
        </div>
        <p className="text-sm text-[#64748B] dark:text-[#94a3b8] ml-13 pl-0.5">
          Módulo de geração e gestão de relatórios de auditoria OEA
        </p>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {options.map((option, index) => {
          const card = (
            <div
              className={[
                'relative flex flex-col gap-4 rounded-2xl border p-6 transition-all',
                option.enabled
                  ? 'border-[#E2E8F0] dark:border-[#1e3570] bg-white dark:bg-[#0d1f4a] hover:border-[#1B3A8C] dark:hover:border-blue-400 hover:shadow-md cursor-pointer'
                  : 'border-[#E2E8F0] dark:border-[#1e3570] bg-[#F8FAFC] dark:bg-[#0a1530] opacity-60 cursor-not-allowed',
              ].join(' ')}
            >
              {/* Número do passo */}
              <div className={[
                'absolute top-4 left-4 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold',
                option.enabled
                  ? 'bg-[#1B3A8C] text-white'
                  : 'bg-[#CBD5E1] dark:bg-[#1e3570]/60 text-[#94A3B8] dark:text-[#64748b]',
              ].join(' ')}>
                {index + 1}
              </div>

              {/* Badge (Beta / personalizado) */}
              {option.badge && (
                <span className="absolute top-4 right-4 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#FEF3C7] dark:bg-amber-900/30 text-[#D97706] dark:text-amber-400 border border-[#FDE68A] dark:border-amber-700">
                  {option.badge}
                </span>
              )}

              {/* Lock para opções sem badge e desativadas */}
              {!option.enabled && !option.badge && (
                <div className="absolute top-4 right-4">
                  <Lock size={14} className="text-[#94A3B8] dark:text-[#64748b]" />
                </div>
              )}

              {/* Lock para opções adminOnly desativadas (sem badge) */}
              {!option.enabled && option.adminOnly && (
                <div className="absolute top-4 right-4">
                  <Lock size={14} className="text-[#94A3B8] dark:text-[#64748b]" />
                </div>
              )}

              {/* Icon */}
              <div
                className={[
                  'w-14 h-14 rounded-2xl flex items-center justify-center mt-4',
                  option.enabled
                    ? 'bg-[#EEF2FF] dark:bg-[#1e3570]/60 text-[#1B3A8C] dark:text-blue-400'
                    : 'bg-[#F1F5F9] dark:bg-[#1e3570]/20 text-[#94A3B8] dark:text-[#64748b]',
                ].join(' ')}
              >
                {option.icon}
              </div>

              {/* Text */}
              <div className="flex-1">
                <h2
                  className={[
                    'font-bold text-base mb-1',
                    option.enabled
                      ? 'text-[#1a2a5e] dark:text-[#e2e8f0]'
                      : 'text-[#64748B] dark:text-[#64748b]',
                  ].join(' ')}
                >
                  {option.title}
                </h2>
                <p className="text-sm text-[#64748B] dark:text-[#94a3b8] leading-relaxed">
                  {option.description}
                </p>
              </div>

              {/* CTA */}
              {option.enabled && (
                <div className="mt-2">
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1B3A8C] dark:text-blue-400">
                    Acessar →
                  </span>
                </div>
              )}

              {!option.enabled && (
                <div className="mt-2">
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[#94A3B8] dark:text-[#64748b]">
                    {option.adminOnly ? 'Restrito a administradores' : 'Disponível em breve'}
                  </span>
                </div>
              )}
            </div>
          )

          if (option.enabled && option.href) {
            return (
              <Link key={option.title} href={option.href}>
                {card}
              </Link>
            )
          }

          return <div key={option.title}>{card}</div>
        })}
      </div>

    </div>
  )
}
