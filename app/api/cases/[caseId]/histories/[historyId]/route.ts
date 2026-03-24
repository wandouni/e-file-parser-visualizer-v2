import { db } from '@/lib/db'
import { histories, caseMembers } from '@/lib/db/schema'
import { getUser } from '@/lib/auth/session'
import { historyToApi } from '@/lib/db/helpers'
import { ok, err } from '@/lib/utils'
import { eq, and } from 'drizzle-orm'

async function getMyRole(caseId: string, userId: string): Promise<string | null> {
  const [row] = await db
    .select({ role: caseMembers.role })
    .from(caseMembers)
    .where(and(eq(caseMembers.caseId, caseId), eq(caseMembers.userId, userId)))
  return row?.role ?? null
}

// GET /api/cases/:caseId/histories/:historyId — 获取完整记录（含 rows）
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ caseId: string; historyId: string }> }
) {
  const { caseId, historyId } = await params
  const user = await getUser()
  if (!user) return err('未登录', 401)

  const role = await getMyRole(caseId, user.id)
  if (!role && !user.isAdmin) return err('无权访问', 403)

  const [h] = await db
    .select()
    .from(histories)
    .where(and(eq(histories.id, historyId), eq(histories.caseId, caseId)))

  if (!h) return err('记录不存在', 404)

  return ok(historyToApi(h))
}

// PATCH /api/cases/:caseId/histories/:historyId — 更新配置（editor+）
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ caseId: string; historyId: string }> }
) {
  const { caseId, historyId } = await params
  const user = await getUser()
  if (!user) return err('未登录', 401)

  const role = await getMyRole(caseId, user.id)
  if (!role || role === 'viewer') return err('无修改权限', 403)

  const body = await request.json()

  const updates: Record<string, any> = {}
  if ('col_config' in body) updates.colConfig = body.col_config
  if ('page_size' in body) updates.pageSize = body.page_size
  if ('viz_configs' in body) updates.vizConfigs = body.viz_configs
  if ('multi_subject_config' in body) updates.multiSubjectConfig = body.multi_subject_config
  if ('section_tag' in body) updates.sectionTag = body.section_tag

  if (Object.keys(updates).length === 0) return err('没有可更新的字段')

  const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
  await db
    .update(histories)
    .set({ ...updates, updatedAt: now })
    .where(and(eq(histories.id, historyId), eq(histories.caseId, caseId)))

  const [updated] = await db
    .select()
    .from(histories)
    .where(and(eq(histories.id, historyId), eq(histories.caseId, caseId)))

  if (!updated) return err('记录不存在', 404)
  return ok(historyToApi(updated))
}

// DELETE /api/cases/:caseId/histories/:historyId
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ caseId: string; historyId: string }> }
) {
  const { caseId, historyId } = await params
  const user = await getUser()
  if (!user) return err('未登录', 401)

  const role = await getMyRole(caseId, user.id)
  if (!role) return err('无权访问', 403)

  const [h] = await db
    .select({ importedBy: histories.importedBy })
    .from(histories)
    .where(and(eq(histories.id, historyId), eq(histories.caseId, caseId)))

  if (!h) return err('记录不存在', 404)

  const canDelete = role === 'owner' || h.importedBy === user.id
  if (!canDelete) return err('无删除权限', 403)

  await db.delete(histories).where(eq(histories.id, historyId))

  return ok({ id: historyId })
}
