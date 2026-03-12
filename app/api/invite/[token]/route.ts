import { createClient } from '@/lib/supabase/server'
import { ok, err } from '@/lib/utils'

// GET /api/invite/:token — 验证并使用邀请链接
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return err('未登录', 401)

  // 查找邀请记录
  const { data: invite, error: inviteError } = await supabase
    .from('case_invites')
    .select('*, case:cases(id, name)')
    .eq('token', token)
    .single()

  if (inviteError || !invite) return err('邀请链接不存在', 404)

  // 检查过期
  if (new Date(invite.expires_at) < new Date()) {
    return err('邀请链接已过期', 410)
  }

  // 检查使用次数
  if (invite.max_uses !== null && invite.use_count >= invite.max_uses) {
    return err('邀请链接已达使用上限', 410)
  }

  const caseId = invite.case_id

  // 检查是否已是成员
  const { data: existing } = await supabase
    .from('case_members')
    .select('id, role')
    .eq('case_id', caseId)
    .eq('user_id', user.id)
    .single()

  if (existing) {
    return ok({ alreadyMember: true, caseId, role: existing.role, case: invite.case })
  }

  // 加入案例
  const { error: joinError } = await supabase
    .from('case_members')
    .insert({ case_id: caseId, user_id: user.id, role: invite.role })

  if (joinError) return err(joinError.message, 500)

  // 更新使用次数
  await supabase
    .from('case_invites')
    .update({ use_count: invite.use_count + 1 })
    .eq('id', invite.id)

  return ok({ alreadyMember: false, caseId, role: invite.role, case: invite.case })
}
