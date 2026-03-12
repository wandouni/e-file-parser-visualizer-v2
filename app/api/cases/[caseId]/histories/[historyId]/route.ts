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

// GET /api/cases/:caseId/histories/:historyId — 获取完整记录（含 rows）
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ caseId: string; historyId: string }> }
) {
  const { caseId, historyId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return err('未登录', 401)

  const role = await getMyRole(supabase, caseId, user.id)
  if (!role) return err('无权访问', 403)

  const { data, error } = await supabase
    .from('histories')
    .select('*')
    .eq('id', historyId)
    .eq('case_id', caseId)
    .single()

  if (error) return err(error.message, 500)
  if (!data) return err('记录不存在', 404)

  return ok(data)
}

// PATCH /api/cases/:caseId/histories/:historyId — 更新配置（editor+）
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ caseId: string; historyId: string }> }
) {
  const { caseId, historyId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return err('未登录', 401)

  const role = await getMyRole(supabase, caseId, user.id)
  if (!role || role === 'viewer') return err('无修改权限', 403)

  const body = await request.json()

  // 只允许更新特定字段（防止误改核心数据）
  const allowedFields = ['col_config', 'page_size', 'viz_configs', 'section_tag']
  const updates: Record<string, any> = {}
  for (const key of allowedFields) {
    if (key in body) updates[key] = body[key]
  }

  if (Object.keys(updates).length === 0) return err('没有可更新的字段')

  const { data, error } = await supabase
    .from('histories')
    .update(updates)
    .eq('id', historyId)
    .eq('case_id', caseId)
    .select()
    .single()

  if (error) return err(error.message, 500)
  return ok(data)
}

// DELETE /api/cases/:caseId/histories/:historyId
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ caseId: string; historyId: string }> }
) {
  const { caseId, historyId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return err('未登录', 401)

  const role = await getMyRole(supabase, caseId, user.id)
  if (!role) return err('无权访问', 403)

  // 获取记录，检查是否有权删除
  const { data: history } = await supabase
    .from('histories')
    .select('imported_by')
    .eq('id', historyId)
    .eq('case_id', caseId)
    .single()

  if (!history) return err('记录不存在', 404)

  const canDelete = role === 'owner' || history.imported_by === user.id
  if (!canDelete) return err('无删除权限', 403)

  const { error } = await supabase.from('histories').delete().eq('id', historyId)
  if (error) return err(error.message, 500)

  return ok({ id: historyId })
}
