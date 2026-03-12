import { createClient } from '@/lib/supabase/server'
import { ok, err, defaultCaseName } from '@/lib/utils'

// GET /api/cases — 获取当前用户所有案例
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return err('未登录', 401)

  const { data, error } = await supabase
    .from('case_members')
    .select(`
      role,
      case:cases (
        id, name, owner_id, created_at, updated_at
      )
    `)
    .eq('user_id', user.id)
    .order('joined_at', { ascending: false })

  if (error) return err(error.message, 500)

  // 附加每个案例的成员数和历史记录数
  const cases = await Promise.all(
    (data || []).map(async (item: any) => {
      const c = item.case
      const [{ count: memberCount }, { count: historyCount }] = await Promise.all([
        supabase.from('case_members').select('*', { count: 'exact', head: true }).eq('case_id', c.id),
        supabase.from('histories').select('*', { count: 'exact', head: true }).eq('case_id', c.id),
      ])
      return {
        ...c,
        myRole: item.role,
        memberCount: memberCount ?? 0,
        historyCount: historyCount ?? 0,
      }
    })
  )

  return ok(cases)
}

// POST /api/cases — 创建新案例
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return err('未登录', 401)

  const body = await request.json().catch(() => ({}))
  const name = (body.name as string)?.trim() || defaultCaseName()

  // 创建案例
  const { data: newCase, error: caseError } = await supabase
    .from('cases')
    .insert({ name, owner_id: user.id })
    .select()
    .single()

  if (caseError) return err(caseError.message, 500)

  // 添加创建者为 owner
  const { error: memberError } = await supabase
    .from('case_members')
    .insert({ case_id: newCase.id, user_id: user.id, role: 'owner' })

  if (memberError) return err(memberError.message, 500)

  return ok({ ...newCase, myRole: 'owner', memberCount: 1, historyCount: 0 })
}
