export const dynamic = 'force-dynamic'

import { getUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { cases, caseMembers, profiles } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { notFound, redirect } from 'next/navigation'
import WorkspaceClient from '@/components/WorkspaceClient'
import type { Profile } from '@/types'

export default async function CaseWorkspacePage({
  params,
}: {
  params: Promise<{ caseId: string }>
}) {
  const { caseId } = await params
  const user = await getUser()
  if (!user) redirect('/login')

  // 获取成员角色
  const [member] = await db
    .select({ role: caseMembers.role })
    .from(caseMembers)
    .where(and(eq(caseMembers.caseId, caseId), eq(caseMembers.userId, user.id)))

  if (!member) notFound()

  // 获取案例基本信息
  const [caseData] = await db.select().from(cases).where(eq(cases.id, caseId))
  if (!caseData) notFound()

  // 获取用户 profile
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

  return (
    <WorkspaceClient
      caseData={{
        id: caseData.id,
        name: caseData.name,
        ownerId: caseData.ownerId,
        createdAt: caseData.createdAt,
        updatedAt: caseData.updatedAt,
        myRole: member.role as any,
      }}
      profile={profile}
    />
  )
}
