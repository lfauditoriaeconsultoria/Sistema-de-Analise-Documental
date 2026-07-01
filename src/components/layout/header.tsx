'use client'

import { usePathname } from 'next/navigation'
import { Profile } from '@/types'
import { Menu } from 'lucide-react'

const pageTitles: Record<string, { title: string; description: string }> = {
  '/dashboard': { title: 'Painel', description: 'Visão geral do sistema' },
  '/analysis/new': { title: 'Nova Análise', description: 'Analisar documento de cliente com IA' },
  '/analysis/history': { title: 'Histórico de Análises', description: 'Consulte as análises realizadas' },
  '/reference-docs': { title: 'Base de Conhecimento', description: 'Gerencie os materiais e instruções utilizados pela IA' },
  '/admin': { title: 'Administração', description: 'Gestão de usuários e configurações' },
  '/ai-chat': { title: 'Consultor IA', description: 'Tire dúvidas com o assistente inteligente' },
}

interface HeaderProps {
  profile: Profile | null
  onMenuToggle?: () => void
}

export function Header({ profile, onMenuToggle }: HeaderProps) {
  const pathname = usePathname()
  const pageInfo = Object.entries(pageTitles).find(([k]) => pathname === k || pathname.startsWith(k + '/'))
  const { title, description } = pageInfo?.[1] ?? { title: 'LF Consultoria', description: '' }

  return (
    <header className="bg-white dark:bg-[#0a1530] border-b border-[#E2E8F0] dark:border-[#1e3570] px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between transition-colors">
      <div className="flex items-center gap-3">
        {onMenuToggle && (
          <button
            onClick={onMenuToggle}
            className="lg:hidden p-1.5 rounded-lg text-[#64748B] hover:bg-[#F0F4FF] dark:hover:bg-white/10 transition-colors flex-shrink-0"
            aria-label="Abrir menu"
          >
            <Menu size={20} />
          </button>
        )}
        <div>
          <h1 className="text-base sm:text-lg font-bold text-[#1a2a5e] dark:text-[#e2e8f0] leading-tight">{title}</h1>
          {description && <p className="text-xs text-[#64748B] dark:text-[#94a3b8] mt-0.5 hidden sm:block">{description}</p>}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {profile && (
          <div className="flex items-center gap-2 pl-3 border-l border-[#E2E8F0] dark:border-[#1e3570]">
            <div className="w-8 h-8 rounded-full bg-[#1B3A8C] flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
              {profile.full_name?.charAt(0).toUpperCase() ?? 'U'}
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-medium text-[#1a2a5e] dark:text-[#e2e8f0] leading-tight">{profile.full_name ?? 'Usuário'}</p>
              <p className="text-xs text-[#64748B] dark:text-[#94a3b8] capitalize">{profile.role}</p>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
