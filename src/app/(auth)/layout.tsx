'use client'

import Image from 'next/image'
import { Shield, Lock, Brain, Sun, Moon } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'

const features = [
  { icon: Shield, label: 'OEA', sub: 'Conformidade' },
  { icon: Lock, label: 'LGPD', sub: 'Privacidade' },
  { icon: Brain, label: 'IA', sub: 'Inteligente' },
]

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <div className={`min-h-screen flex transition-colors duration-200 ${isDark ? 'bg-[#080f2a]' : 'bg-[#f0f4ff]'}`}>

      {/* ── Left Panel ── */}
      <div className={`hidden lg:flex lg:w-[58%] flex-col justify-between p-8 relative overflow-hidden
        ${isDark
          ? 'bg-gradient-to-br from-[#060d22] via-[#0d1b3e] to-[#0a1428]'
          : 'bg-gradient-to-br from-[#1B3A8C] via-[#1d44a8] to-[#2D6BE4]'
        }`}
      >
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          aria-label={isDark ? 'Ativar modo claro' : 'Ativar modo escuro'}
          className="absolute top-5 right-5 z-20 flex items-center gap-2 px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white text-xs font-medium hover:bg-white/20 transition-colors"
        >
          {isDark ? <Sun size={14} /> : <Moon size={14} />}
          {isDark ? 'Modo claro' : 'Modo escuro'}
        </button>

        {/* Decorative circles */}
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-blue-400/10 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 w-80 h-80 rounded-full bg-blue-300/10 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-white/[0.02]" />

        {/* Top: logo + name */}
        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-7">
            <div className="w-20 h-20 flex-shrink-0 drop-shadow-2xl">
              <Image src="/logo.png" alt="LF" width={80} height={80} className="object-contain w-full h-full rounded-full" />
            </div>
            <div>
              <p className="text-white font-bold text-2xl leading-tight">LF Consultoria</p>
              <p className="text-white font-bold text-2xl leading-tight">e Auditoria</p>
              <p className="text-blue-200/80 text-sm mt-0.5">Compartilhando Conhecimento</p>
            </div>
          </div>

          {/* Headline */}
          <div className="mb-6">
            <span className="inline-flex items-center gap-1.5 text-blue-200 text-xs font-semibold tracking-widest uppercase mb-3">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-300 inline-block" />
              Análise Inteligente com IA
            </span>
            <h2 className="text-white text-3xl font-bold leading-tight">
              IA que auxilia o consultor<br />
              <span className="text-blue-200">na análise de documentos</span><br />
              com mais precisão.
            </h2>
            <p className="text-blue-200 text-sm mt-3 max-w-sm leading-relaxed">
              Inteligência artificial aplicada à análise documental para apoiar
              consultores na identificação de conformidades e não conformidades.
            </p>
          </div>

          {/* Feature grid */}
          <div className="flex flex-col gap-3 max-w-xs">
            <div className="grid grid-cols-2 gap-3">
              {features.slice(0, 2).map(({ icon: Icon, label, sub }) => (
                <div
                  key={label}
                  className="flex items-center gap-3 rounded-xl p-3 border border-white/10 bg-white/5 backdrop-blur-sm"
                >
                  <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                    <Icon size={15} className="text-blue-100" />
                  </div>
                  <div>
                    <p className="text-white text-sm font-semibold leading-tight">{label}</p>
                    <p className="text-blue-200/70 text-xs">{sub}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-center">
              {features.slice(2).map(({ icon: Icon, label, sub }) => (
                <div
                  key={label}
                  className="flex items-center gap-3 rounded-xl p-3 border border-white/10 bg-white/5 backdrop-blur-sm w-[calc(50%-6px)]"
                >
                  <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                    <Icon size={15} className="text-blue-100" />
                  </div>
                  <div>
                    <p className="text-white text-sm font-semibold leading-tight">{label}</p>
                    <p className="text-blue-200/70 text-xs">{sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom: copyright */}
        <p className="relative z-10 text-blue-200/40 text-xs mt-5">
          © {new Date().getFullYear()} LF Auditoria e Consultoria. Todos os direitos reservados.
        </p>
      </div>

      {/* ── Right Panel ── */}
      <div className={`flex-1 flex flex-col items-center justify-center p-6 relative`}>

        {/* Mobile-only logo */}
        <div className="lg:hidden mb-8 text-center">
          <div className="inline-block w-20 h-20 mb-3 drop-shadow-lg">
            <Image src="/logo.png" alt="LF" width={80} height={80} className="object-contain w-full h-full rounded-full" />
          </div>
          <p className={`font-bold text-base ${isDark ? 'text-white' : 'text-[#1B3A8C]'}`}>
            LF Auditoria e Consultoria
          </p>
          <p className={`text-xs mt-0.5 ${isDark ? 'text-blue-300' : 'text-[#64748B]'}`}>
            Sistema de Análise Documental com IA
          </p>
        </div>

        {/* Form card */}
        <div className={`w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-fade-in
          ${isDark
            ? 'bg-[#0f1d42] border border-[#1e3570]'
            : 'bg-white border border-[#E2E8F0]'
          }`}
        >
          {children}
        </div>

        {/* Mobile copyright */}
        <p className={`lg:hidden mt-6 text-xs text-center ${isDark ? 'text-blue-300/50' : 'text-[#94A3B8]'}`}>
          © {new Date().getFullYear()} LF Auditoria e Consultoria
        </p>
      </div>
    </div>
  )
}
