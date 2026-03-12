import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const caseId = searchParams.get('caseId')
  if (!caseId) return NextResponse.json({ error: { message: 'caseId required' } }, { status: 400 })

  // Verify membership
  const { data: membership } = await supabase
    .from('case_members')
    .select('role')
    .eq('case_id', caseId)
    .eq('user_id', user.id)
    .single()
  if (!membership) return NextResponse.json({ error: { message: 'Forbidden' } }, { status: 403 })

  const { data: caseData } = await supabase
    .from('cases')
    .select('id, name, created_at')
    .eq('id', caseId)
    .single()

  const { data: histories } = await supabase
    .from('histories')
    .select('*')
    .eq('case_id', caseId)
    .order('sort_order', { ascending: true })

  const payload = {
    exportedAt: new Date().toISOString(),
    version: 2,
    case: caseData,
    histories: histories ?? [],
  }

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="case_${caseId}_backup.json"`,
    },
  })
}
