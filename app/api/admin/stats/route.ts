import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { profiles, cases, histories } from '@/lib/db/schema'
import { getUser } from '@/lib/auth/session'
import { eq, gte, count, and } from 'drizzle-orm'

export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 })
  if (!user.isAdmin) return NextResponse.json({ error: { message: 'Forbidden' } }, { status: 403 })

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const [[{ totalUsers }], [{ totalCases }], [{ totalHistories }], [{ recentUsers }], [{ recentCases }], [{ bannedUsers }]] =
    await Promise.all([
      db.select({ totalUsers: count() }).from(profiles),
      db.select({ totalCases: count() }).from(cases),
      db.select({ totalHistories: count() }).from(histories),
      db.select({ recentUsers: count() }).from(profiles).where(gte(profiles.createdAt, sevenDaysAgo)),
      db.select({ recentCases: count() }).from(cases).where(gte(cases.createdAt, sevenDaysAgo)),
      db.select({ bannedUsers: count() }).from(profiles).where(eq(profiles.isBanned, true)),
    ])

  return NextResponse.json({
    data: { totalUsers, totalCases, totalHistories, recentUsers, recentCases, bannedUsers },
  })
}
