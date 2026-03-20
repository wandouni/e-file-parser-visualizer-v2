import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { histories, caseMembers } from '@/lib/db/schema'
import { getUser } from '@/lib/auth/session'
import { eq, and, max } from 'drizzle-orm'

export async function POST(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 })

  const { caseId, histories: historiesData } = await req.json()
  if (!caseId || !Array.isArray(historiesData)) {
    return NextResponse.json({ error: { message: 'caseId and histories[] required' } }, { status: 400 })
  }

  // Verify owner
  const [membership] = await db
    .select({ role: caseMembers.role })
    .from(caseMembers)
    .where(and(eq(caseMembers.caseId, caseId), eq(caseMembers.userId, user.id)))

  if (!membership || membership.role !== 'owner') {
    return NextResponse.json({ error: { message: 'Only owner can restore backup' } }, { status: 403 })
  }

  // Get current max sort_order
  const [maxRow] = await db
    .select({ maxOrder: max(histories.sortOrder) })
    .from(histories)
    .where(eq(histories.caseId, caseId))

  const baseOrder = (maxRow?.maxOrder ?? -1) + 1

  const now = new Date().toISOString().replace('T', ' ').slice(0, 19)

  const records = historiesData.map((h: any, i: number) => ({
    id: crypto.randomUUID(),
    caseId,
    importedBy: user.id,
    importTime: h.import_time || now,
    sectionTag: h.section_tag,
    meta: h.meta ?? {},
    fields: h.fields ?? [],
    labels: h.labels ?? [],
    rows: h.rows ?? [],
    colConfig: h.col_config ?? {},
    pageSize: h.page_size ?? 20,
    vizConfigs: h.viz_configs ?? [],
    sortOrder: baseOrder + i,
  }))

  if (records.length > 0) {
    await db.insert(histories).values(records)
  }

  return NextResponse.json({ data: { imported: records.length } })
}
