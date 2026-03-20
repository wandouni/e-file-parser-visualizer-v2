import { db } from '@/lib/db'
import { caseMembers, profiles } from '@/lib/db/schema'
import { getUser } from '@/lib/auth/session'
import { ok, err } from '@/lib/utils'
import { eq, and, asc } from 'drizzle-orm'

async function getMyRole(caseId: string, userId: string): Promise<string | null> {
  const [row] = await db
    .select({ role: caseMembers.role })
    .from(caseMembers)
    .where(and(eq(caseMembers.caseId, caseId), eq(caseMembers.userId, userId)))
  return row?.role ?? null
}

// GET /api/cases/:caseId/members
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const { caseId } = await params
  const user = await getUser()
  if (!user) return err('未登录', 401)

  const role = await getMyRole(caseId, user.id)
  if (!role) return err('无权访问', 403)

  const rows = await db
    .select({
      id: caseMembers.id,
      caseId: caseMembers.caseId,
      userId: caseMembers.userId,
      role: caseMembers.role,
      joinedAt: caseMembers.joinedAt,
      username: profiles.username,
      displayName: profiles.displayName,
    })
    .from(caseMembers)
    .innerJoin(profiles, eq(caseMembers.userId, profiles.id))
    .where(eq(caseMembers.caseId, caseId))
    .orderBy(asc(caseMembers.joinedAt))

  const data = rows.map((r) => ({
    id: r.id,
    case_id: r.caseId,
    user_id: r.userId,
    role: r.role,
    joined_at: r.joinedAt,
    profile: { username: r.username, display_name: r.displayName, avatar_url: null },
  }))

  return ok(data)
}
