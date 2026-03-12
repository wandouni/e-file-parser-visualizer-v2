import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 })

  const { caseId, histories } = await req.json()
  if (!caseId || !Array.isArray(histories)) {
    return NextResponse.json({ error: { message: 'caseId and histories[] required' } }, { status: 400 })
  }

  // Verify owner
  const { data: membership } = await supabase
    .from('case_members')
    .select('role')
    .eq('case_id', caseId)
    .eq('user_id', user.id)
    .single()
  if (!membership || membership.role !== 'owner') {
    return NextResponse.json({ error: { message: 'Only owner can restore backup' } }, { status: 403 })
  }

  // Get current max sort_order
  const { data: existing } = await supabase
    .from('histories')
    .select('sort_order')
    .eq('case_id', caseId)
    .order('sort_order', { ascending: false })
    .limit(1)
  const baseOrder = (existing?.[0]?.sort_order ?? -1) + 1

  const records = histories.map((h: any, i: number) => ({
    case_id: caseId,
    imported_by: user.id,
    import_time: h.import_time || new Date().toISOString(),
    section_tag: h.section_tag,
    meta: h.meta ?? {},
    fields: h.fields ?? [],
    labels: h.labels ?? [],
    rows: h.rows ?? [],
    col_config: h.col_config ?? {},
    page_size: h.page_size ?? 20,
    viz_configs: h.viz_configs ?? [],
    sort_order: baseOrder + i,
  }))

  const { data, error } = await supabase
    .from('histories')
    .insert(records)
    .select()
  if (error) return NextResponse.json({ error }, { status: 500 })

  return NextResponse.json({ data: { imported: data?.length ?? 0 } })
}
