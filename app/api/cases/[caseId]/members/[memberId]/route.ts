import { db } from '@/lib/db'
import { caseMembers } from '@/lib/db/schema'
import { getUser } from '@/lib/auth/session'
import { ok, err } from '@/lib/utils'
import { eq, and } from 'drizzle-orm'

async function getMyRole(caseId: string, userId: string): Promise<string | null> {
  const [row] = await db
    .select({ role: caseMembers.role })
    .from(caseMembers)
    .where(and(eq(caseMembers.caseId, caseId), eq(caseMembers.userId, userId)))
  return row?.role ?? null
}

// PATCH /api/cases/:caseId/members/:memberId — 修改角色（owner only）
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ caseId: string; memberId: string }> }
) {
  const { caseId, memberId } = await params
  const user = await getUser()
  if (!user) return err('未登录', 401)

  const myRole = await getMyRole(caseId, user.id)
  if (myRole !== 'owner') return err('仅所有者可修改成员角色', 403)

  const body = await request.json()
  const { role } = body

  if (!['editor', 'viewer'].includes(role)) return err('角色只能设置为 editor 或 viewer')

  const [target] = await db
    .select({ userId: caseMembers.userId, role: caseMembers.role })
    .from(caseMembers)
    .where(eq(caseMembers.id, memberId))

  if (!target) return err('成员不存在', 404)
  if (target.userId === user.id) return err('不能修改自己的角色')
  if (target.role === 'owner') return err('不能修改所有者角色')

  await db.update(caseMembers).set({ role }).where(eq(caseMembers.id, memberId))

  return ok({ id: memberId, role })
}

// DELETE /api/cases/:caseId/members/:memberId — 移除成员（owner only）
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ caseId: string; memberId: string }> }
) {
  const { caseId, memberId } = await params
  const user = await getUser()
  if (!user) return err('未登录', 401)

  const myRole = await getMyRole(caseId, user.id)
  if (myRole !== 'owner') return err('仅所有者可移除成员', 403)

  const [target] = await db
    .select({ userId: caseMembers.userId })
    .from(caseMembers)
    .where(eq(caseMembers.id, memberId))

  if (!target) return err('成员不存在', 404)
  if (target.userId === user.id) return err('不能移除自己（所有者）')

  await db.delete(caseMembers).where(eq(caseMembers.id, memberId))

  return ok({ id: memberId })
}
