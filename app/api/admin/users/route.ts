import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { profiles } from '@/lib/db/schema'
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
    .from(profiles)
    .where(search ? like(profiles.username, `%${search}%`) : undefined)

  const rows = await db
    .select({
      id: profiles.id,
      username: profiles.username,
      display_name: profiles.displayName,
      email: profiles.email,
      is_admin: profiles.isAdmin,
      is_banned: profiles.isBanned,
      created_at: profiles.createdAt,
    })
    .from(profiles)
    .where(search ? like(profiles.username, `%${search}%`) : undefined)
    .orderBy(desc(profiles.createdAt))
    .limit(pageSize)
    .offset(offset)

  return NextResponse.json({ data: rows, meta: { total, page, pageSize } })
}

export async function PATCH(req: NextRequest) {
  const caller = await requireAdmin()
  if (!caller) return NextResponse.json({ error: { message: 'Forbidden' } }, { status: 403 })

  const { userId, is_banned, is_admin } = await req.json()
  if (!userId) return NextResponse.json({ error: { message: 'userId required' } }, { status: 400 })

  const updates: Record<string, boolean> = {}
  if (is_banned !== undefined) updates.isBanned = is_banned
  if (is_admin !== undefined) updates.isAdmin = is_admin

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: { message: 'no fields to update' } }, { status: 400 })
  }

  await db.update(profiles).set(updates).where(eq(profiles.id, userId))

  return NextResponse.json({ data: { ok: true } })
}
