import { createClient } from '@/lib/supabase/server'
import { ok, err } from '@/lib/utils'

async function getMyRole(supabase: any, caseId: string, userId: string) {
  const { data } = await supabase
    .from('case_members')
    .select('role')
    .eq('case_id', caseId)
    .eq('user_id', userId)
    .single()
  return data?.role as string | null
}

// GET /api/cases/:caseId
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const { caseId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return err('未登录', 401)

  const role = await getMyRole(supabase, caseId, user.id)
  if (!role) return err('无权访问', 403)

  const { data, error } = await supabase
    .from('cases')
    .select('*')
    .eq('id', caseId)
    .single()

  if (error) return err(error.message, 500)
  if (!data) return err('案例不存在', 404)

  return ok({ ...data, myRole: role })
}

// PATCH /api/cases/:caseId — 重命名（owner only）
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const { caseId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return err('未登录', 401)

  const role = await getMyRole(supabase, caseId, user.id)
  if (role !== 'owner') return err('仅所有者可修改案例名称', 403)

  const body = await request.json()
  const name = (body.name as string)?.trim()
  if (!name) return err('名称不能为空')

  const { data, error } = await supabase
    .from('cases')
    .update({ name })
    .eq('id', caseId)
    .select()
    .single()

  if (error) return err(error.message, 500)
  return ok(data)
}

// DELETE /api/cases/:caseId — 删除案例（owner only）
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const { caseId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return err('未登录', 401)

  const role = await getMyRole(supabase, caseId, user.id)
  if (role !== 'owner') return err('仅所有者可删除案例', 403)

  const { error } = await supabase.from('cases').delete().eq('id', caseId)
  if (error) return err(error.message, 500)

  return ok({ id: caseId })
}
