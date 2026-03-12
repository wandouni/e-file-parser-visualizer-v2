import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return NextResponse.json({ error: { message: 'Forbidden' } }, { status: 403 })

  const admin = await createAdminClient()

  const [usersRes, casesRes, historiesRes] = await Promise.all([
    admin.from('profiles').select('id, created_at', { count: 'exact' }),
    admin.from('cases').select('id, created_at', { count: 'exact' }),
    admin.from('histories').select('id', { count: 'exact' }),
  ])

  // 最近 7 天新增用户
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const [recentUsers, recentCases] = await Promise.all([
    admin.from('profiles').select('id', { count: 'exact' }).gte('created_at', sevenDaysAgo),
    admin.from('cases').select('id', { count: 'exact' }).gte('created_at', sevenDaysAgo),
  ])

  return NextResponse.json({
    data: {
      totalUsers: usersRes.count ?? 0,
      totalCases: casesRes.count ?? 0,
      totalHistories: historiesRes.count ?? 0,
      recentUsers: recentUsers.count ?? 0,
      recentCases: recentCases.count ?? 0,
    },
  })
}
