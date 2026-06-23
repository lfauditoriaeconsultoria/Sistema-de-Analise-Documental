'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, FilePlus, Clock, BookOpen,
  Settings, LogOut, ChevronLeft, Menu, Sun, Moon, Bot,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Profile } from '@/types'
import Image from 'next/image'
import { useTheme } from '@/components/theme-provider'

interface NavItem {
  href: string
  label: string
  icon: React.ReactNode
  adminOnly?: boolean
}

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Painel', icon: <LayoutDashboard size={18} /> },
  { href: '/analysis/new', label: 'Nova Análise', icon: <FilePlus size={18} /> },
  { href: '/ai-chat', label: 'Consultor IA', icon: <Bot size={18} /> },
  { href: '/analysis/history', label: 'Histórico', icon: <Clock size={18} /> },
  { href: '/reference-docs', label: 'Base de Conhecimento', icon: <BookOpen size={18} /> },
  { href: '/admin', label: 'Administração', icon: <Settings size={18} />, adminOnly: true },
]

interface SidebarProps {
  profile: Profile | null
}

export function Sidebar({ profile }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const { theme, toggleTheme } = useTheme()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const visibleItems = navItems.filter(item => !item.adminOnly || profile?.role === 'admin')

  return (
    <aside
      className={cn(
        'flex flex-col bg-[#1B3A8C] text-white transition-all duration-300 min-h-screen',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Header */}
      <div className={cn('flex items-center border-b border-white/10 p-4', collapsed ? 'justify-center' : 'justify-between')}>
        {!collapsed && (
          <div className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="LF Auditoria e Consultoria"
              width={40}
              height={40}
              className="rounded-full object-contain drop-shadow-lg"
            />
            <div>
              <p className="font-bold text-sm leading-tight">LF Consultoria</p>
              <p className="text-blue-200 text-xs">Análise Documental</p>
            </div>
          </div>
        )}
        {collapsed && (
          <Image
            src="/logo.png"
            alt="LF"
            width={32}
            height={32}
            className="rounded-full object-contain drop-shadow-lg"
          />
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 rounded-lg hover:bg-white/10 transition-colors"
        >
          {collapsed ? <Menu size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 flex flex-col gap-1 overflow-y-auto">
        {visibleItems.map(item => {
          const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
                active
                  ? 'bg-white text-[#1B3A8C] shadow-sm'
                  : 'text-blue-100 hover:bg-white/10 hover:text-white',
                collapsed && 'justify-center px-2'
              )}
              title={collapsed ? item.label : undefined}
            >
              <span className="flex-shrink-0">{item.icon}</span>
              {!collapsed && <span>{item.label}</span>}
            </Link>
          )
        })}
      </nav>

      {/* User Footer */}
      <div className="border-t border-white/10 p-3">
        {!collapsed && profile && (
          <div className="flex items-center gap-3 px-2 py-2 mb-2 rounded-lg bg-white/5">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
              {profile.full_name?.charAt(0).toUpperCase() ?? 'U'}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-white text-xs font-medium truncate">{profile.full_name ?? 'Usuário'}</p>
              <p className="text-blue-200 text-xs capitalize">{profile.role}</p>
            </div>
          </div>
        )}
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-blue-200 hover:text-white hover:bg-white/10 transition-colors w-full mb-1',
            collapsed && 'justify-center px-2'
          )}
          title={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          {!collapsed && <span>{theme === 'dark' ? 'Modo claro' : 'Modo escuro'}</span>}
        </button>

        <button
          onClick={handleLogout}
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-blue-200 hover:text-white hover:bg-white/10 transition-colors w-full',
            collapsed && 'justify-center px-2'
          )}
          title={collapsed ? 'Sair' : undefined}
        >
          <LogOut size={16} />
          {!collapsed && <span>Sair</span>}
        </button>
      </div>
    </aside>
  )
}
