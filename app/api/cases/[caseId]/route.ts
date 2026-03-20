import { db } from '@/lib/db'
import { cases, caseMembers } from '@/lib/db/schema'
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

// GET /api/cases/:caseId
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const { caseId } = await params
  const user = await getUser()
  if (!user) return err('未登录', 401)

  const role = await getMyRole(caseId, user.id)
  if (!role) return err('无权访问', 403)

  const [c] = await db.select().from(cases).where(eq(cases.id, caseId))
  if (!c) return err('案例不存在', 404)

  return ok({ id: c.id, name: c.name, ownerId: c.ownerId, createdAt: c.createdAt, updatedAt: c.updatedAt, myRole: role })
}

// PATCH /api/cases/:caseId — 重命名（owner only）
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const { caseId } = await params
  const user = await getUser()
  if (!user) return err('未登录', 401)

  const role = await getMyRole(caseId, user.id)
  if (role !== 'owner') return err('仅所有者可修改案例名称', 403)

  const body = await request.json()
  const name = (body.name as string)?.trim()
  if (!name) return err('名称不能为空')

  const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
  await db.update(cases).set({ name, updatedAt: now }).where(eq(cases.id, caseId))

  return ok({ id: caseId, name })
}

// DELETE /api/cases/:caseId — 删除案例（owner only）
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const { caseId } = await params
  const user = await getUser()
  if (!user) return err('未登录', 401)

  const role = await getMyRole(caseId, user.id)
  if (role !== 'owner') return err('仅所有者可删除案例', 403)

  await db.delete(cases).where(eq(cases.id, caseId))

  return ok({ id: caseId })
}
