import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.user) {
      // Upsert profile on first login
      await supabase.from('profiles').upsert({
        id: data.user.id,
        full_name: data.user.user_metadata.full_name ?? null,
        role: 'colaborador',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id', ignoreDuplicates: true })

      return Response.redirect(`${origin}/dashboard`)
    }
  }

  return Response.redirect(`${origin}/login?error=callback_failed`)
}
