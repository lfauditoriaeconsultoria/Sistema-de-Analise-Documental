'use client'

import { Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function PendingPage() {
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="p-8 text-center">
      <div className="flex justify-center mb-4">
        <div className="w-16 h-16 rounded-full bg-[#EEF2FF] flex items-center justify-center">
          <Clock size={32} className="text-[#1B3A8C]" />
        </div>
      </div>

      <h2 className="text-xl font-bold text-[#1a2a5e] mb-2">Cadastro em análise</h2>
      <p className="text-[#64748B] text-sm leading-relaxed mb-6">
        Seu cadastro foi recebido e está aguardando aprovação de um administrador.
        Você receberá acesso ao sistema assim que for aprovado.
      </p>

      <Button variant="secondary" onClick={handleLogout} className="w-full">
        Sair
      </Button>
    </div>
  )
}
