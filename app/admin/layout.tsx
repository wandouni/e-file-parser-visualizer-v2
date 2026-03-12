import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, display_name, is_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) redirect('/cases')

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg-main)' }}>
      {/* 侧边栏 */}
      <aside className="w-48 shrink-0 border-r flex flex-col" style={{ borderColor: 'var(--border)', background: 'var(--bg-sidebar)' }}>
        <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
          <p className="text-[10px] font-bold" style={{ color: 'var(--accent)' }}>ADMIN PANEL</p>
          <p className="text-[9px] mt-0.5" style={{ color: 'var(--text3)' }}>{profile.display_name || profile.username}</p>
        </div>
        <nav className="flex-1 p-2 space-y-0.5">
          {[
            { href: '/admin', label: '总览' },
            { href: '/admin/users', label: '用户管理' },
            { href: '/admin/cases', label: '案例管理' },
          ].map(({ href, label }) => (
            <Link key={href} href={href}
              className="block px-3 py-1.5 rounded text-[11px] font-medium hover:bg-white/10 transition-colors"
              style={{ color: 'var(--text2)' }}>
              {label}
            </Link>
          ))}
        </nav>
        <div className="p-2 border-t" style={{ borderColor: 'var(--border)' }}>
          <Link href="/cases"
            className="block px-3 py-1.5 rounded text-[10px] hover:bg-white/10 transition-colors text-center"
            style={{ color: 'var(--text3)' }}>
            返回应用
          </Link>
        </div>
      </aside>

      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  )
}
