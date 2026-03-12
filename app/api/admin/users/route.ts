import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return null
  return user
}

export async function GET(req: NextRequest) {
  const caller = await requireAdmin()
  if (!caller) return NextResponse.json({ error: { message: 'Forbidden' } }, { status: 403 })

  const admin = await createAdminClient()
  const { searchParams } = new URL(req.url)
  const page = parseInt(searchParams.get('page') ?? '1')
  const pageSize = 20
  const search = searchParams.get('q') ?? ''

  let query = admin.from('profiles')
    .select('id, username, display_name, avatar_url, is_admin, is_banned, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)

  if (search) query = query.ilike('username', `%${search}%`)

  const { data, count, error } = await query
  if (error) return NextResponse.json({ error }, { status: 500 })

  return NextResponse.json({ data, meta: { total: count ?? 0, page, pageSize } })
}

export async function PATCH(req: NextRequest) {
  const caller = await requireAdmin()
  if (!caller) return NextResponse.json({ error: { message: 'Forbidden' } }, { status: 403 })

  const { userId, is_banned, is_admin } = await req.json()
  if (!userId) return NextResponse.json({ error: { message: 'userId required' } }, { status: 400 })

  const admin = await createAdminClient()
  const updates: Record<string, boolean> = {}
  if (is_banned !== undefined) updates.is_banned = is_banned
  if (is_admin !== undefined) updates.is_admin = is_admin

  const { error } = await admin.from('profiles').update(updates).eq('id', userId)
  if (error) return NextResponse.json({ error }, { status: 500 })

  return NextResponse.json({ data: { ok: true } })
}
