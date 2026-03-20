export const dynamic = 'force-dynamic'

import { getUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { profiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import CaseManagementClient from '@/components/CaseManagementClient'
import type { Profile } from '@/types'

export default async function CasesPage() {
  const user = await getUser()
  if (!user) return null

  const [p] = await db.select().from(profiles).where(eq(profiles.id, user.id))

  const profile: Profile | null = p
    ? {
        id: p.id,
        username: p.username,
        displayName: p.displayName,
        avatarUrl: null,
        wechatOpenid: null,
        isAdmin: p.isAdmin,
        isBanned: p.isBanned,
        createdAt: p.createdAt,
        updatedAt: p.createdAt,
      }
    : null

  return <CaseManagementClient profile={profile} />
}
