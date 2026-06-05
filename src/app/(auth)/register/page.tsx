'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/toast'
import { User, Mail, Lock, Eye, EyeOff } from 'lucide-react'

export default function RegisterPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirmPassword) {
      toast({ type: 'error', title: 'As senhas não coincidem' })
      return
    }
    if (password.length < 8) {
      toast({ type: 'error', title: 'Senha deve ter pelo menos 8 caracteres' })
      return
    }
    setLoading(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name } },
      })
      if (error) throw error
      toast({ type: 'success', title: 'Conta criada!', description: 'Verifique seu e-mail para confirmar o cadastro.' })
      router.push('/login')
    } catch (err: unknown) {
      toast({
        type: 'error',
        title: 'Erro ao criar conta',
        description: err instanceof Error ? err.message : 'Tente novamente.',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-[#1a2a5e]">Criar conta</h2>
        <p className="text-[#64748B] text-sm mt-1">Preencha seus dados para solicitar acesso ao sistema</p>
      </div>

      <form onSubmit={handleRegister} className="flex flex-col gap-4">
        <div className="relative">
          <User size={16} className="absolute left-3 top-9 text-[#94A3B8]" />
          <Input
            label="Nome completo"
            type="text"
            placeholder="Seu nome completo"
            value={name}
            onChange={e => setName(e.target.value)}
            className="pl-9"
            required
          />
        </div>

        <div className="relative">
          <Mail size={16} className="absolute left-3 top-9 text-[#94A3B8]" />
          <Input
            label="E-mail corporativo"
            type="email"
            placeholder="seu@email.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="pl-9"
            required
          />
        </div>

        <div className="relative">
          <Lock size={16} className="absolute left-3 top-9 text-[#94A3B8]" />
          <Input
            label="Senha"
            type={showPassword ? 'text' : 'password'}
            placeholder="Mínimo 8 caracteres"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="pl-9 pr-10"
            required
          />
          <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-9 text-[#94A3B8] hover:text-[#64748B]">
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>

        <Input
          label="Confirmar senha"
          type="password"
          placeholder="Repita a senha"
          value={confirmPassword}
          onChange={e => setConfirmPassword(e.target.value)}
          required
        />

        <Button type="submit" className="w-full mt-2" loading={loading}>
          Criar conta
        </Button>
      </form>

      <div className="mt-6 pt-4 border-t border-[#F1F5F9] text-center">
        <p className="text-sm text-[#64748B]">
          Já tem uma conta?{' '}
          <Link href="/login" className="text-[#1B3A8C] font-medium hover:underline">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  )
}
