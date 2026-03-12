import { createClient } from '@/lib/supabase/server'
import { ok, err, generateToken } from '@/lib/utils'

// POST /api/cases/:caseId/invite — 生成邀请链接（owner only）
export async function POST(
  request: Request,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const { caseId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return err('未登录', 401)

  const { data: member } = await supabase
    .from('case_members')
    .select('role')
    .eq('case_id', caseId)
    .eq('user_id', user.id)
    .single()

  if (member?.role !== 'owner') return err('仅所有者可生成邀请链接', 403)

  const body = await request.json().catch(() => ({}))
  const role = body.role || 'viewer'
  const expiresIn = body.expiresIn || 72
  const maxUses = body.maxUses || null

  if (!['editor', 'viewer'].includes(role)) return err('无效的角色')

  const token = generateToken()
  const expiresAt = new Date(Date.now() + expiresIn * 3600 * 1000).toISOString()

  const { data, error } = await supabase
    .from('case_invites')
    .insert({
      case_id: caseId,
      created_by: user.id,
      role,
      token,
      expires_at: expiresAt,
      max_uses: maxUses,
    })
    .select()
    .single()

  if (error) return err(error.message, 500)

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  return ok({
    ...data,
    url: `${appUrl}/invite/${token}`,
  })
}
