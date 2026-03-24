import { db } from '@/lib/db'
import { histories, caseMembers } from '@/lib/db/schema'
import { getUser } from '@/lib/auth/session'
import { historyToApi } from '@/lib/db/helpers'
import { ok, err } from '@/lib/utils'
import { eq, and, desc, max } from 'drizzle-orm'

async function getMyRole(caseId: string, userId: string): Promise<string | null> {
  const [row] = await db
    .select({ role: caseMembers.role })
    .from(caseMembers)
    .where(and(eq(caseMembers.caseId, caseId), eq(caseMembers.userId, userId)))
  return row?.role ?? null
}

// GET /api/cases/:caseId/histories — 获取历史记录列表（不含 rows）
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const { caseId } = await params
  const user = await getUser()
  if (!user) return err('未登录', 401)

  const role = await getMyRole(caseId, user.id)
  if (!role && !user.isAdmin) return err('无权访问', 403)

  const rows = await db
    .select({
      id: histories.id,
      caseId: histories.caseId,
      importedBy: histories.importedBy,
      importTime: histories.importTime,
      sectionTag: histories.sectionTag,
      meta: histories.meta,
      fields: histories.fields,
      labels: histories.labels,
      colConfig: histories.colConfig,
      pageSize: histories.pageSize,
      vizConfigs: histories.vizConfigs,
      sortOrder: histories.sortOrder,
      createdAt: histories.createdAt,
      updatedAt: histories.updatedAt,
      rows: histories.rows, // included as empty array via historyToApi
    })
    .from(histories)
    .where(eq(histories.caseId, caseId))
    .orderBy(desc(histories.sortOrder))

  return ok(rows.map((h) => historyToApi(h as any, false)))
}

// POST /api/cases/:caseId/histories — 导入单条
export async function POST(
  request: Request,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const { caseId } = await params
  const user = await getUser()
  if (!user) return err('未登录', 401)

  const role = await getMyRole(caseId, user.id)
  if (!role || role === 'viewer') return err('无导入权限', 403)

  const body = await request.json()
  const { sectionTag, meta, fields, labels, rows } = body

  if (!sectionTag || !fields || !rows) return err('缺少必要字段')

  // 计算 sort_order（取当前最大值 + 1）
  const [maxRow] = await db
    .select({ maxOrder: max(histories.sortOrder) })
    .from(histories)
    .where(eq(histories.caseId, caseId))

  const sortOrder = (maxRow?.maxOrder ?? -1) + 1

  // 初始化 colConfig（全部 true）
  const colConfig: Record<string, boolean> = {}
  fields.forEach((f: string) => (colConfig[f] = true))

  const id = crypto.randomUUID()
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19)

  await db.insert(histories).values({
    id,
    caseId,
    importedBy: user.id,
    importTime: now,
    sectionTag,
    meta: meta || {},
    fields,
    labels: labels || fields,
    rows,
    colConfig,
    pageSize: 22,
    vizConfigs: [],
    sortOrder,
  })

  const [inserted] = await db.select().from(histories).where(eq(histories.id, id))
  return ok(historyToApi(inserted))
}

// DELETE /api/cases/:caseId/histories — 清空所有（owner only）
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const { caseId } = await params
  const user = await getUser()
  if (!user) return err('未登录', 401)

  const role = await getMyRole(caseId, user.id)
  if (role !== 'owner') return err('仅所有者可清空', 403)

  await db.delete(histories).where(eq(histories.caseId, caseId))

  return ok({ cleared: true })
}
