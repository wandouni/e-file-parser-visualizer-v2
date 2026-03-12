export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import CaseManagementClient from '@/components/CaseManagementClient'

export default async function CasesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // 获取用户 profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user!.id)
    .single()

  return <CaseManagementClient profile={profile} />
}
