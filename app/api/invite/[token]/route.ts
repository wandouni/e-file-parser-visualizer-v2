import { db } from '@/lib/db'
import { caseInvites, caseMembers, cases } from '@/lib/db/schema'
import { getUser } from '@/lib/auth/session'
import { ok, err } from '@/lib/utils'
import { eq, and } from 'drizzle-orm'

// GET /api/invite/:token — 验证并使用邀请链接
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const user = await getUser()
  if (!user) return err('未登录', 401)

  const [invite] = await db
    .select()
    .from(caseInvites)
    .where(eq(caseInvites.token, token))

  if (!invite) return err('邀请链接不存在', 404)

  if (new Date(invite.expiresAt) < new Date()) return err('邀请链接已过期', 410)

  if (invite.maxUses !== null && invite.useCount >= invite.maxUses) {
    return err('邀请链接已达使用上限', 410)
  }

  const caseId = invite.caseId

  // Fetch case info
  const [caseData] = await db.select({ id: cases.id, name: cases.name }).from(cases).where(eq(cases.id, caseId))

  // 检查是否已是成员
  const [existing] = await db
    .select({ id: caseMembers.id, role: caseMembers.role })
    .from(caseMembers)
    .where(and(eq(caseMembers.caseId, caseId), eq(caseMembers.userId, user.id)))

  if (existing) {
    return ok({ alreadyMember: true, caseId, role: existing.role, case: caseData })
  }

  // 加入案例
  await db.insert(caseMembers).values({
    id: crypto.randomUUID(),
    caseId,
    userId: user.id,
    role: invite.role,
  })

  // 更新使用次数
  await db
    .update(caseInvites)
    .set({ useCount: invite.useCount + 1 })
    .where(eq(caseInvites.id, invite.id))

  return ok({ alreadyMember: false, caseId, role: invite.role, case: caseData })
}
