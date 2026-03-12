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

// GET /api/cases/:caseId/histories — 获取历史记录列表（不含 rows，性能优化）
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
    .from('histories')
    .select('id, case_id, import_time, imported_by, section_tag, meta, fields, labels, col_config, page_size, viz_configs, sort_order, created_at, updated_at')
    .eq('case_id', caseId)
    .order('sort_order', { ascending: false })

  if (error) return err(error.message, 500)
  return ok(data)
}

// POST /api/cases/:caseId/histories — 导入单条
export async function POST(
  request: Request,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const { caseId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return err('未登录', 401)

  const role = await getMyRole(supabase, caseId, user.id)
  if (!role || role === 'viewer') return err('无导入权限', 403)

  const body = await request.json()
  const { sectionTag, meta, fields, labels, rows } = body

  if (!sectionTag || !fields || !rows) return err('缺少必要字段')

  // 计算 sort_order（取当前最大值 + 1）
  const { data: maxRow } = await supabase
    .from('histories')
    .select('sort_order')
    .eq('case_id', caseId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .single()

  const sortOrder = (maxRow?.sort_order ?? 0) + 1

  // 初始化 colConfig（全部 true）
  const colConfig: Record<string, boolean> = {}
  fields.forEach((f: string) => (colConfig[f] = true))

  const { data, error } = await supabase
    .from('histories')
    .insert({
      case_id: caseId,
      imported_by: user.id,
      section_tag: sectionTag,
      meta: meta || {},
      fields,
      labels: labels || fields,
      rows,
      col_config: colConfig,
      page_size: 20,
      viz_configs: [],
      sort_order: sortOrder,
    })
    .select()
    .single()

  if (error) return err(error.message, 500)
  return ok(data)
}

// DELETE /api/cases/:caseId/histories — 清空所有（owner only）
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const { caseId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return err('未登录', 401)

  const role = await getMyRole(supabase, caseId, user.id)
  if (role !== 'owner') return err('仅所有者可清空', 403)

  const { error } = await supabase.from('histories').delete().eq('case_id', caseId)
  if (error) return err(error.message, 500)

  return ok({ cleared: true })
}
