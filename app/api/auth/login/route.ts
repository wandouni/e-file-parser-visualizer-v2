import { db } from '@/lib/db'
import { profiles } from '@/lib/db/schema'
import { verifyPassword } from '@/lib/auth/password'
import { setSessionCookie } from '@/lib/auth/session'
import { ok, err } from '@/lib/utils'
import { eq } from 'drizzle-orm'

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const { email, password } = body as { email: string; password: string }

  if (!email || !password) return err('邮箱和密码不能为空')

  const [user] = await db.select().from(profiles).where(eq(profiles.email, email.toLowerCase().trim()))
  if (!user) return err('邮箱或密码错误', 401)

  if (user.isBanned) return err('账号已被封禁，请联系管理员', 403)

  const valid = await verifyPassword(password, user.passwordHash)
  if (!valid) return err('邮箱或密码错误', 401)

  await setSessionCookie({
    id: user.id,
    email: user.email,
    username: user.username,
    isAdmin: user.isAdmin,
  })

  return ok({
    id: user.id,
    email: user.email,
    username: user.username,
    displayName: user.displayName,
    isAdmin: user.isAdmin,
  })
}
