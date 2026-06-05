import { createClient } from '@supabase/supabase-js'

// Client com service role — usa apenas no servidor, nunca expor ao browser
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
