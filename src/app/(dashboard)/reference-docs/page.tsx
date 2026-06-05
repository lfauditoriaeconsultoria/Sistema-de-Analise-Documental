import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ReferenceDocsClient } from '@/components/reference-docs/reference-docs-client'

export default async function ReferenceDocsPage() {
  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user!.id)
    .single()

  const isAdmin = profile?.role === 'admin'

  const [{ data: themes }, { data: subtopics }, { data: docs }, { data: prompts }] = await Promise.all([
    admin.from('themes').select('*').eq('is_active', true).order('name'),
    admin.from('subtopics').select('*').eq('is_active', true).order('name'),
    admin.from('reference_documents').select('*, theme:themes(name), subtopic:subtopics(name)').order('created_at', { ascending: false }),
    admin.from('reference_prompts').select('*, theme:themes(name), subtopic:subtopics(name), oea_criteria:oea_criteria(number, name), oea_item:oea_items(item_number)').eq('is_active', true).order('created_at', { ascending: true }),
  ])

  return (
    <ReferenceDocsClient
      themes={themes ?? []}
      subtopics={subtopics ?? []}
      docs={docs ?? []}
      prompts={prompts ?? []}
      isAdmin={isAdmin}
    />
  )
}
