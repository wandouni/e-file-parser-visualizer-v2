export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { profiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import Link from 'next/link'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser()
  if (!user) redirect('/login')
  if (!user.isAdmin) redirect('/cases')

  const [profile] = await db
    .select({ username: profiles.username, displayName: profiles.displayName })
    .from(profiles)
    .where(eq(profiles.id, user.id))

  const displayName = profile?.displayName || profile?.username || user.username

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f1f5f9' }}>
      {/* 侧边栏 */}
      <aside style={{
        width: 180, flexShrink: 0, background: '#0f172a',
        display: 'flex', flexDirection: 'column', borderRight: '1px solid #1e293b',
      }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #1e293b' }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: '#60a5fa', letterSpacing: '0.05em' }}>ADMIN PANEL</p>
          <p style={{ fontSize: 11, marginTop: 4, color: '#94a3b8' }}>{displayName}</p>
        </div>
        <nav style={{ flex: 1, padding: '8px 8px' }}>
          {[
            { href: '/admin', label: '总览' },
            { href: '/admin/users', label: '用户管理' },
            { href: '/admin/cases', label: '案例管理' },
          ].map(({ href, label }) => (
            <Link key={href} href={href} style={{
              display: 'block', padding: '7px 12px', borderRadius: 6,
              fontSize: 12, color: '#cbd5e1', textDecoration: 'none',
              marginBottom: 2,
            }}>
              {label}
            </Link>
          ))}
        </nav>
        <div style={{ padding: '8px', borderTop: '1px solid #1e293b' }}>
          <Link href="/cases" style={{
            display: 'block', padding: '6px 12px', borderRadius: 6,
            fontSize: 11, color: '#64748b', textDecoration: 'none', textAlign: 'center',
          }}>
            ← 返回应用
          </Link>
        </div>
      </aside>

      <main style={{ flex: 1, overflow: 'auto', padding: 28 }}>{children}</main>
    </div>
  )
}
