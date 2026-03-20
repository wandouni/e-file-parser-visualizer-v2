import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { cases, histories, caseMembers } from '@/lib/db/schema'
import { getUser } from '@/lib/auth/session'
import { historyToApi } from '@/lib/db/helpers'
import { eq, and, asc } from 'drizzle-orm'

export async function GET(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const caseId = searchParams.get('caseId')
  if (!caseId) return NextResponse.json({ error: { message: 'caseId required' } }, { status: 400 })

  // Verify membership
  const [membership] = await db
    .select({ role: caseMembers.role })
    .from(caseMembers)
    .where(and(eq(caseMembers.caseId, caseId), eq(caseMembers.userId, user.id)))

  if (!membership) return NextResponse.json({ error: { message: 'Forbidden' } }, { status: 403 })

  const [caseData] = await db
    .select({ id: cases.id, name: cases.name, created_at: cases.createdAt })
    .from(cases)
    .where(eq(cases.id, caseId))

  const historyRows = await db
    .select()
    .from(histories)
    .where(eq(histories.caseId, caseId))
    .orderBy(asc(histories.sortOrder))

  const payload = {
    exportedAt: new Date().toISOString(),
    version: 2,
    case: caseData,
    histories: historyRows.map((h) => historyToApi(h)),
  }

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="case_${caseId}_backup.json"`,
    },
  })
}
