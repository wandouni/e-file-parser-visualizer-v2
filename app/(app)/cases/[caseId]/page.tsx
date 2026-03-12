export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import WorkspaceClient from '@/components/WorkspaceClient'

export default async function CaseWorkspacePage({
  params,
}: {
  params: Promise<{ caseId: string }>
}) {
  const { caseId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // 获取成员角色
  const { data: member } = await supabase
    .from('case_members')
    .select('role')
    .eq('case_id', caseId)
    .eq('user_id', user.id)
    .single()

  if (!member) notFound()

  // 获取案例基本信息
  const { data: caseData } = await supabase
    .from('cases')
    .select('*')
    .eq('id', caseId)
    .single()

  if (!caseData) notFound()

  // 获取用户 profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return (
    <WorkspaceClient
      caseData={{ ...caseData, myRole: member.role }}
      profile={profile}
    />
  )
}
