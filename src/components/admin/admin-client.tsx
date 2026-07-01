'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { useToast } from '@/components/ui/toast'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils'
import { Users, Edit2, Trash2, Shield, Eye, EyeOff, Clock, CheckCircle, XCircle } from 'lucide-react'

interface UserRow {
  id: string
  email: string
  full_name: string | null
  role: string
  status: 'pending' | 'active'
  created_at: string
}

interface Props {
  users: UserRow[]
  currentUserId: string
}

export function AdminClient({ users: initialUsers, currentUserId }: Props) {
  const router = useRouter()
  const { toast } = useToast()
  const [users, setUsers] = useState(initialUsers)

  const [editTarget, setEditTarget] = useState<UserRow | null>(null)
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editPassword, setEditPassword] = useState('')
  const [editRole, setEditRole] = useState<'admin' | 'colaborador'>('colaborador')
  const [showPassword, setShowPassword] = useState(false)
  const [editLoading, setEditLoading] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)

  const pendingUsers = users.filter(u => u.status === 'pending')
  const activeUsers = users.filter(u => u.status === 'active')

  async function handleApprove(user: UserRow) {
    setApprovingId(user.id)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ status: 'active' }),
      })
      if (!res.ok) { toast({ type: 'error', title: 'Erro ao aprovar usuário' }); return }
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, status: 'active' as const } : u))
      toast({ type: 'success', title: `${user.full_name ?? user.email} aprovado com sucesso` })
    } finally {
      setApprovingId(null)
    }
  }

  async function handleReject(user: UserRow) {
    setRejectingId(user.id)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
      if (!res.ok) { toast({ type: 'error', title: 'Erro ao rejeitar cadastro' }); return }
      setUsers(prev => prev.filter(u => u.id !== user.id))
      toast({ type: 'success', title: 'Cadastro rejeitado e removido' })
    } finally {
      setRejectingId(null)
    }
  }

  function openEdit(user: UserRow) {
    setEditTarget(user)
    setEditName(user.full_name ?? '')
    setEditEmail(user.email)
    setEditPassword('')
    setEditRole(user.role as 'admin' | 'colaborador')
    setShowPassword(false)
  }

  async function handleEdit() {
    if (!editTarget) return
    setEditLoading(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`/api/admin/users/${editTarget.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          full_name: editName.trim() || null,
          email: editEmail.trim() || undefined,
          password: editPassword.trim() || undefined,
          role: editRole,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ type: 'error', title: data.error ?? 'Erro ao salvar' })
        return
      }
      setUsers(prev => prev.map(u =>
        u.id === editTarget.id
          ? { ...u, full_name: editName.trim() || null, email: editEmail.trim(), role: editRole }
          : u
      ))
      toast({ type: 'success', title: 'Usuário atualizado com sucesso' })
      setEditTarget(null)
      router.refresh()
    } finally {
      setEditLoading(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleteLoading(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`/api/admin/users/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ type: 'error', title: data.error ?? 'Erro ao excluir' })
        return
      }
      setUsers(prev => prev.filter(u => u.id !== deleteTarget.id))
      toast({ type: 'success', title: 'Conta excluída com sucesso' })
      setDeleteTarget(null)
    } finally {
      setDeleteLoading(false)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <div>
        <h2 className="text-xl font-bold text-[#1a2a5e] dark:text-[#e2e8f0]">Administração</h2>
        <p className="text-sm text-[#64748B] mt-0.5">Gestão de usuários do sistema</p>
      </div>

      {/* Pending users */}
      {pendingUsers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <Clock size={18} /> Aguardando aprovação
            </CardTitle>
            <Badge variant="muted">{pendingUsers.length} pendente(s)</Badge>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pendingUsers.map(user => (
                <div key={user.id} className="flex items-center gap-3 p-3 rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/10">
                  <div className="w-10 h-10 rounded-full bg-amber-200 dark:bg-amber-800/40 flex items-center justify-center text-amber-700 dark:text-amber-300 font-bold flex-shrink-0 text-sm">
                    {user.full_name?.charAt(0).toUpperCase() ?? user.email.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-[#1a2a5e] dark:text-[#e2e8f0] truncate">
                      {user.full_name ?? <span className="text-[#94A3B8] italic">Sem nome</span>}
                    </p>
                    <p className="text-xs text-[#64748B] truncate">{user.email}</p>
                    <p className="text-xs text-[#94A3B8]">Cadastrado em {formatDate(user.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button
                      size="sm"
                      onClick={() => handleApprove(user)}
                      loading={approvingId === user.id}
                      className="gap-1.5 bg-[#16A34A] hover:bg-[#15803d] text-white border-0"
                    >
                      <CheckCircle size={14} /> Aprovar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleReject(user)}
                      disabled={rejectingId === user.id}
                      className="gap-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      <XCircle size={14} /> Rejeitar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users size={18} /> Usuários do sistema
          </CardTitle>
          <Badge variant="primary">{activeUsers.length} usuário(s)</Badge>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {activeUsers.map(user => (
              <div key={user.id} className="flex items-center gap-3 p-3 rounded-xl border border-[#E2E8F0] hover:bg-[#F8FAFC]">
                <div className="w-10 h-10 rounded-full bg-[#1B3A8C] flex items-center justify-center text-white font-bold flex-shrink-0 text-sm">
                  {user.full_name?.charAt(0).toUpperCase() ?? user.email.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-[#1a2a5e] truncate">
                    {user.full_name ?? <span className="text-[#94A3B8] italic">Sem nome</span>}
                    {user.id === currentUserId && (
                      <span className="ml-2 text-xs bg-[#EEF2FF] text-[#1B3A8C] px-1.5 py-0.5 rounded-full font-normal">você</span>
                    )}
                  </p>
                  <p className="text-xs text-[#64748B] truncate">{user.email}</p>
                  <p className="text-xs text-[#94A3B8]">Desde {formatDate(user.created_at)}</p>
                </div>
                <Badge variant={user.role === 'admin' ? 'primary' : 'muted'} className="capitalize flex-shrink-0">
                  {user.role === 'admin' ? <><Shield size={10} className="mr-1" />Admin</> : 'Colaborador'}
                </Badge>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEdit(user)}
                    className="p-2"
                    title="Editar usuário"
                  >
                    <Edit2 size={14} />
                  </Button>
                  {user.id !== currentUserId && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteTarget(user)}
                      className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50"
                      title="Excluir conta"
                    >
                      <Trash2 size={14} />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Edit Modal */}
      {editTarget && (
        <Modal
          open={!!editTarget}
          onOpenChange={open => { if (!open) setEditTarget(null) }}
          title="Editar usuário"
          size="md"
        >
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[#1a2a5e] dark:text-[#e2e8f0]">Nome completo</label>
              <input
                type="text"
                value={editName}
                onChange={e => setEditName(e.target.value)}
                placeholder="Nome do usuário"
                className="w-full h-10 px-3 rounded-lg border text-sm border-[#E2E8F0] dark:border-[#1e3570] bg-white dark:bg-[#0a1530] text-[#1a2a5e] dark:text-[#e2e8f0] placeholder:text-[#94A3B8] dark:placeholder:text-[#64748b] focus:outline-none focus:ring-2 focus:ring-[#1B3A8C] dark:focus:ring-blue-400 focus:border-transparent transition-colors"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[#1a2a5e] dark:text-[#e2e8f0]">E-mail</label>
              <input
                type="email"
                value={editEmail}
                onChange={e => setEditEmail(e.target.value)}
                placeholder="email@exemplo.com"
                className="w-full h-10 px-3 rounded-lg border text-sm border-[#E2E8F0] dark:border-[#1e3570] bg-white dark:bg-[#0a1530] text-[#1a2a5e] dark:text-[#e2e8f0] placeholder:text-[#94A3B8] dark:placeholder:text-[#64748b] focus:outline-none focus:ring-2 focus:ring-[#1B3A8C] dark:focus:ring-blue-400 focus:border-transparent transition-colors"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[#1a2a5e] dark:text-[#e2e8f0]">
                Nova senha <span className="text-[#94A3B8] font-normal">(deixe em branco para não alterar)</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={editPassword}
                  onChange={e => setEditPassword(e.target.value)}
                  placeholder="Nova senha"
                  className="w-full h-10 px-3 pr-10 rounded-lg border text-sm border-[#E2E8F0] dark:border-[#1e3570] bg-white dark:bg-[#0a1530] text-[#1a2a5e] dark:text-[#e2e8f0] placeholder:text-[#94A3B8] dark:placeholder:text-[#64748b] focus:outline-none focus:ring-2 focus:ring-[#1B3A8C] dark:focus:ring-blue-400 focus:border-transparent transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#1a2a5e] dark:text-[#e2e8f0]"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[#1a2a5e] dark:text-[#e2e8f0]">Perfil</label>
              <select
                value={editRole}
                onChange={e => setEditRole(e.target.value as 'admin' | 'colaborador')}
                className="w-full h-10 px-3 rounded-lg border text-sm border-[#E2E8F0] dark:border-[#1e3570] bg-white dark:bg-[#0a1530] text-[#1a2a5e] dark:text-[#e2e8f0] focus:outline-none focus:ring-2 focus:ring-[#1B3A8C] dark:focus:ring-blue-400 focus:border-transparent transition-colors"
              >
                <option value="colaborador">Colaborador</option>
                <option value="admin">Administrador</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setEditTarget(null)} disabled={editLoading}>
                Cancelar
              </Button>
              <Button onClick={handleEdit} disabled={editLoading}>
                {editLoading ? 'Salvando...' : 'Salvar alterações'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <Modal
          open={!!deleteTarget}
          onOpenChange={open => { if (!open) setDeleteTarget(null) }}
          title="Excluir conta"
          size="sm"
        >
          <div className="flex flex-col gap-4">
            <p className="text-sm text-[#64748B] dark:text-[#94a3b8]">
              Tem certeza que deseja excluir a conta de{' '}
              <strong className="text-[#1a2a5e] dark:text-[#e2e8f0]">{deleteTarget.full_name ?? deleteTarget.email}</strong>?
              Esta ação não pode ser desfeita.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setDeleteTarget(null)} disabled={deleteLoading}>
                Cancelar
              </Button>
              <button
                onClick={handleDelete}
                disabled={deleteLoading}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {deleteLoading ? 'Excluindo...' : 'Excluir conta'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
