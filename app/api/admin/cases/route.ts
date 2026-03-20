import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { cases, profiles, caseMembers, histories } from '@/lib/db/schema'
import { getUser } from '@/lib/auth/session'
import { eq, desc, like, count, sql } from 'drizzle-orm'

async function requireAdmin() {
  const user = await getUser()
  if (!user || !user.isAdmin) return null
  return user
}

export async function GET(req: NextRequest) {
  const caller = await requireAdmin()
  if (!caller) return NextResponse.json({ error: { message: 'Forbidden' } }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const page = parseInt(searchParams.get('page') ?? '1')
  const pageSize = 20
  const search = searchParams.get('q') ?? ''
  const offset = (page - 1) * pageSize

  const [{ total }] = await db
    .select({ total: count() })
    .from(cases)
    .where(search ? like(cases.name, `%${search}%`) : undefined)

  const rows = await db
    .select({
      id: cases.id,
      name: cases.name,
      owner_id: cases.ownerId,
      created_at: cases.createdAt,
      updated_at: cases.updatedAt,
      owner_username: profiles.username,
    })
    .from(cases)
    .leftJoin(profiles, eq(cases.ownerId, profiles.id))
    .where(search ? like(cases.name, `%${search}%`) : undefined)
    .orderBy(desc(cases.updatedAt))
    .limit(pageSize)
    .offset(offset)

  // Get member and history counts
  const result = await Promise.all(
    rows.map(async (c) => {
      const [{ memberCount }] = await db.select({ memberCount: count() }).from(caseMembers).where(eq(caseMembers.caseId, c.id))
      const [{ historyCount }] = await db.select({ historyCount: count() }).from(histories).where(eq(histories.caseId, c.id))
      return { ...c, member_count: memberCount, history_count: historyCount }
    })
  )

  return NextResponse.json({ data: result, meta: { total, page, pageSize } })
}
