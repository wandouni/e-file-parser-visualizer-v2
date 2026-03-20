import { db } from '@/lib/db'
import { cases, caseMembers, histories } from '@/lib/db/schema'
import { getUser } from '@/lib/auth/session'
import { ok, err, defaultCaseName } from '@/lib/utils'
import { eq, desc, count } from 'drizzle-orm'

// GET /api/cases — 获取当前用户的所有案例
export async function GET() {
  const user = await getUser()
  if (!user) return err('未登录', 401)

  const rows = await db
    .select()
    .from(cases)
    .where(eq(cases.ownerId, user.id))
    .orderBy(desc(cases.createdAt))

  const result = await Promise.all(
    rows.map(async (c) => {
      const [{ historyCount }] = await db
        .select({ historyCount: count() })
        .from(histories)
        .where(eq(histories.caseId, c.id))

      return {
        id: c.id,
        name: c.name,
        ownerId: c.ownerId,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        myRole: 'owner',
        historyCount: historyCount ?? 0,
      }
    })
  )

  return ok(result)
}

// POST /api/cases — 创建新案例
export async function POST(request: Request) {
  const user = await getUser()
  if (!user) return err('未登录', 401)

  const body = await request.json().catch(() => ({}))
  const name = (body.name as string)?.trim() || defaultCaseName(user.username)

  const id = crypto.randomUUID()
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19)

  await db.insert(cases).values({ id, name, ownerId: user.id })
  await db.insert(caseMembers).values({
    id: crypto.randomUUID(),
    caseId: id,
    userId: user.id,
    role: 'owner',
  })

  return ok({ id, name, ownerId: user.id, createdAt: now, updatedAt: now, myRole: 'owner', historyCount: 0 })
}
