export const dynamic = 'force-dynamic'

import { db } from '@/lib/db'
import { profiles, cases, histories } from '@/lib/db/schema'
import { eq, gte, count } from 'drizzle-orm'

async function getStats() {
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

  return { totalUsers, totalCases, totalHistories, recentUsers, recentCases, bannedUsers }
}

export default async function AdminDashboard() {
  const stats = await getStats()

  const statCards = [
    { label: '注册用户', value: stats.totalUsers, sub: `+${stats.recentUsers} 近 7 天`, color: '#3b82f6' },
    { label: '案例总数', value: stats.totalCases, sub: `+${stats.recentCases} 近 7 天`, color: '#8b5cf6' },
    { label: '数据集总数', value: stats.totalHistories, sub: '所有案例', color: '#10b981' },
    { label: '封禁用户', value: stats.bannedUsers, sub: '当前封禁', color: '#ef4444' },
  ]

  return (
    <div>
      <h1 className="text-sm font-bold mb-6" style={{ color: 'var(--text)' }}>系统总览</h1>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {statCards.map(({ label, value, sub, color }) => (
          <div key={label} className="bg-white border rounded-xl p-4" style={{ borderColor: 'var(--border)' }}>
            <p className="text-[10px] font-medium mb-1" style={{ color: 'var(--text2)' }}>{label}</p>
            <p className="text-2xl font-bold mb-1" style={{ color }}>{value.toLocaleString()}</p>
            <p className="text-[9px]" style={{ color: 'var(--text3)' }}>{sub}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
