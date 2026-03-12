import { createClient } from '@/lib/supabase/server'
import { ok, err } from '@/lib/utils'

async function getMyRole(supabase: any, caseId: string, userId: string) {
  const { data } = await supabase
    .from('case_members')
    .select('role')
    .eq('case_id', caseId)
    .eq('user_id', userId)
    .single()
  return data?.role as string | null
}

// PATCH /api/cases/:caseId/members/:memberId — 修改角色（owner only）
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ caseId: string; memberId: string }> }
) {
  const { caseId, memberId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return err('未登录', 401)

  const myRole = await getMyRole(supabase, caseId, user.id)
  if (myRole !== 'owner') return err('仅所有者可修改成员角色', 403)

  const body = await request.json()
  const { role } = body

  if (!['editor', 'viewer'].includes(role)) {
    return err('角色只能设置为 editor 或 viewer')
  }

  // 不能修改自己（owner不能降权自己）
  const { data: targetMember } = await supabase
    .from('case_members')
    .select('user_id, role')
    .eq('id', memberId)
    .single()

  if (!targetMember) return err('成员不存在', 404)
  if (targetMember.user_id === user.id) return err('不能修改自己的角色')
  if (targetMember.role === 'owner') return err('不能修改所有者角色')

  const { data, error } = await supabase
    .from('case_members')
    .update({ role })
    .eq('id', memberId)
    .select()
    .single()

  if (error) return err(error.message, 500)
  return ok(data)
}

// DELETE /api/cases/:caseId/members/:memberId — 移除成员（owner only）
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ caseId: string; memberId: string }> }
) {
  const { caseId, memberId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return err('未登录', 401)

  const myRole = await getMyRole(supabase, caseId, user.id)
  if (myRole !== 'owner') return err('仅所有者可移除成员', 403)

  const { data: targetMember } = await supabase
    .from('case_members')
    .select('user_id, role')
    .eq('id', memberId)
    .single()

  if (!targetMember) return err('成员不存在', 404)
  if (targetMember.user_id === user.id) return err('不能移除自己（所有者）')

  const { error } = await supabase.from('case_members').delete().eq('id', memberId)
  if (error) return err(error.message, 500)

  return ok({ id: memberId })
}
