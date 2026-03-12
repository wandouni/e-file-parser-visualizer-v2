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

  const { searchParams } = new URL(req.url)
  const page = parseInt(searchParams.get('page') ?? '1')
  const pageSize = 20
  const search = searchParams.get('q') ?? ''

  const admin = await createAdminClient()

  let query = admin
    .from('cases')
    .select(`
      id, name, owner_id, created_at, updated_at,
      case_members(count),
      histories(count),
      profiles!cases_owner_id_fkey(username)
    `, { count: 'exact' })
    .order('updated_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)

  if (search) query = query.ilike('name', `%${search}%`)

  const { data, count, error } = await query
  if (error) {
    // Fallback: simple query without joins if foreign key name differs
    const fallback = await createAdminClient()
    const { data: simple, count: simpleCount } = await fallback
      .from('cases')
      .select('id, name, owner_id, created_at, updated_at', { count: 'exact' })
      .order('updated_at', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1)

    return NextResponse.json({ data: simple ?? [], meta: { total: simpleCount ?? 0, page, pageSize } })
  }

  const rows = (data ?? []).map((c: any) => ({
    id: c.id,
    name: c.name,
    owner_id: c.owner_id,
    created_at: c.created_at,
    updated_at: c.updated_at,
    member_count: Array.isArray(c.case_members) ? c.case_members[0]?.count : undefined,
    history_count: Array.isArray(c.histories) ? c.histories[0]?.count : undefined,
    owner_username: c.profiles?.username,
  }))

  return NextResponse.json({ data: rows, meta: { total: count ?? 0, page, pageSize } })
}
