'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/toast'
import { Lock, Mail, Eye, EyeOff, ShieldCheck } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'

export default function LoginPage() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const router = useRouter()
  const { toast } = useToast()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      router.push('/dashboard')
      router.refresh()
    } catch (err: unknown) {
      toast({
        type: 'error',
        title: 'Erro ao entrar',
        description: err instanceof Error ? err.message : 'Verifique suas credenciais e tente novamente.',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-8">
      {/* Icon */}
      <div className={`w-14 h-14 rounded-2xl mx-auto mb-5 flex items-center justify-center
        ${isDark ? 'bg-blue-900/40' : 'bg-[#EEF2FF]'}`}
      >
        <ShieldCheck size={26} className={isDark ? 'text-blue-300' : 'text-[#1B3A8C]'} />
      </div>

      {/* Heading */}
      <div className="mb-6 text-center">
        <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-[#1a2a5e]'}`}>
          Bem-vindo de volta
        </h2>
        <p className={`text-sm mt-1 ${isDark ? 'text-blue-200' : 'text-[#64748B]'}`}>
          Entre com suas credenciais para acessar o sistema
        </p>
      </div>

      <form onSubmit={handleLogin} className="flex flex-col gap-4">
        <div className="relative">
          <Mail size={15} className={`absolute left-3 top-[2.1rem] ${isDark ? 'text-blue-300/50' : 'text-[#94A3B8]'}`} />
          <Input
            label="E-mail"
            type="email"
            placeholder="seu@email.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className={`pl-9 ${isDark ? 'bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-blue-400' : ''}`}
            required
            autoComplete="email"
          />
        </div>

        <div className="relative">
          <Lock size={15} className={`absolute left-3 top-[2.1rem] ${isDark ? 'text-blue-300/50' : 'text-[#94A3B8]'}`} />
          <Input
            label="Senha"
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••••"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className={`pl-9 pr-10 ${isDark ? 'bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-blue-400' : ''}`}
            required
            autoComplete="current-password"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className={`absolute right-3 top-[2.1rem] ${isDark ? 'text-blue-300/50 hover:text-blue-300' : 'text-[#94A3B8] hover:text-[#64748B]'}`}
          >
            {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>

        <Button type="submit" className="w-full mt-1" loading={loading}>
          Entrar no Sistema
        </Button>
      </form>

      <div className={`mt-5 pt-4 border-t text-center ${isDark ? 'border-white/10' : 'border-[#F1F5F9]'}`}>
        <p className={`text-sm ${isDark ? 'text-blue-200' : 'text-[#64748B]'}`}>
          Não tem uma conta?{' '}
          <Link href="/register" className={`font-medium hover:underline ${isDark ? 'text-white' : 'text-[#1B3A8C]'}`}>
            Solicitar acesso
          </Link>
        </p>
      </div>

      <div className={`mt-4 p-3 rounded-lg flex items-center justify-center gap-2
        ${isDark ? 'bg-white/5' : 'bg-[#F0F4FF]'}`}
      >
        <Lock size={12} className={isDark ? 'text-blue-300/50' : 'text-[#94A3B8]'} />
        <p className={`text-xs ${isDark ? 'text-blue-200' : 'text-[#64748B]'}`}>
          Acesso seguro e criptografado
        </p>
      </div>
    </div>
  )
}
