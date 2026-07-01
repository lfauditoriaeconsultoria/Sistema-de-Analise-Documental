'use client'

import { useState } from 'react'
import { Sidebar } from './sidebar'
import { Header } from './header'
import { Profile } from '@/types'

interface Props {
  profile: Profile | null
  children: React.ReactNode
}

export function DashboardShell({ profile, children }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden bg-[#F0F4FF] dark:bg-[#080f2a] transition-colors">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={[
          'fixed inset-y-0 left-0 z-50 transition-transform duration-300 lg:relative lg:translate-x-0 lg:z-auto',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        <Sidebar
          profile={profile}
          onNavigate={() => setMobileOpen(false)}
        />
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <Header
          profile={profile}
          onMenuToggle={() => setMobileOpen(o => !o)}
        />
        <main className="flex-1 overflow-auto min-h-0">
          <div className="p-3 sm:p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
