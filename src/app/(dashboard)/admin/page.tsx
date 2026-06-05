import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { AdminClient } from '@/components/admin/admin-client'

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user!.id)
    .single()

  if (profile?.role !== 'admin') redirect('/dashboard')

  const admin = createAdminClient()

  const { data: authUsersData } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const { data: profiles } = await admin.from('profiles').select('*').order('created_at', { ascending: false })

  const profileMap = new Map((profiles ?? []).map(p => [p.id, p]))

  const users = (authUsersData?.users ?? []).map(authUser => {
    const prof = profileMap.get(authUser.id)
    return {
      id: authUser.id,
      email: authUser.email ?? '',
      full_name: prof?.full_name ?? null,
      role: prof?.role ?? 'colaborador',
      created_at: prof?.created_at ?? authUser.created_at,
    }
  }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  return <AdminClient users={users} currentUserId={user!.id} />
}
