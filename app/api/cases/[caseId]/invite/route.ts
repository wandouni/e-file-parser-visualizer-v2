import { db } from '@/lib/db'
import { caseMembers, caseInvites } from '@/lib/db/schema'
import { getUser } from '@/lib/auth/session'
import { ok, err, generateToken } from '@/lib/utils'
import { eq, and } from 'drizzle-orm'

// POST /api/cases/:caseId/invite — 生成邀请链接（owner only）
export async function POST(
  request: Request,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const { caseId } = await params
  const user = await getUser()
  if (!user) return err('未登录', 401)

  const [member] = await db
    .select({ role: caseMembers.role })
    .from(caseMembers)
    .where(and(eq(caseMembers.caseId, caseId), eq(caseMembers.userId, user.id)))

  if (member?.role !== 'owner') return err('仅所有者可生成邀请链接', 403)

  const body = await request.json().catch(() => ({}))
  const role = body.role || 'viewer'
  const expiresIn = body.expiresIn || 72
  const maxUses = body.maxUses || null

  if (!['editor', 'viewer'].includes(role)) return err('无效的角色')

  const token = generateToken()
  const expiresAt = new Date(Date.now() + expiresIn * 3600 * 1000).toISOString()
  const id = crypto.randomUUID()

  await db.insert(caseInvites).values({
    id,
    caseId,
    createdBy: user.id,
    role,
    token,
    expiresAt,
    maxUses,
  })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  return ok({ id, caseId, role, token, expiresAt, url: `${appUrl}/invite/${token}` })
}
