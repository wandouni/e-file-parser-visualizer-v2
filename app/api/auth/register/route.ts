import { db } from '@/lib/db'
import { profiles } from '@/lib/db/schema'
import { hashPassword } from '@/lib/auth/password'
import { setSessionCookie } from '@/lib/auth/session'
import { ok, err } from '@/lib/utils'
import { eq, or } from 'drizzle-orm'

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const { email, password, displayName } = body as { email: string; password: string; displayName?: string }

  if (!email || !password) return err('邮箱和密码不能为空')
  if (password.length < 8) return err('密码至少8位')

  const normalizedEmail = email.toLowerCase().trim()

  // Derive username from email prefix + random suffix
  const emailPrefix = normalizedEmail.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 16)
  const username = `${emailPrefix}_${Math.random().toString(36).slice(2, 6)}`

  // Check duplicate email
  const [existing] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(or(eq(profiles.email, normalizedEmail), eq(profiles.username, username)))

  if (existing) return err('该邮箱已注册，请直接登录', 409)

  const passwordHash = await hashPassword(password)
  const id = crypto.randomUUID()

  await db.insert(profiles).values({
    id,
    email: normalizedEmail,
    username,
    displayName: displayName?.trim() || null,
    passwordHash,
  })

  await setSessionCookie({ id, email: normalizedEmail, username, isAdmin: false })

  return ok({ id, email: normalizedEmail, username, displayName: displayName?.trim() || null })
}
