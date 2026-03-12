import { createClient } from '@/lib/supabase/server'
import { ok, err, applyFilters } from '@/lib/utils'
import type { Row, JoinFilter } from '@/types'

// POST /api/join — 多表关联
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return err('未登录', 401)

  const body = await request.json()
  const {
    caseId,
    leftHistoryId,
    rightHistoryId,
    leftKey,
    rightKey,
    leftFields,
    rightFields,
    leftFilters = [],
    rightFilters = [],
    resultName,
    previewOnly = true,
  } = body

  // 权限检查
  const { data: member } = await supabase
    .from('case_members')
    .select('role')
    .eq('case_id', caseId)
    .eq('user_id', user.id)
    .single()

  if (!member || member.role === 'viewer') return err('无操作权限', 403)

  // 获取两张表的完整数据
  const [{ data: leftData }, { data: rightData }] = await Promise.all([
    supabase.from('histories').select('fields, labels, rows').eq('id', leftHistoryId).single(),
    supabase.from('histories').select('fields, labels, rows').eq('id', rightHistoryId).single(),
  ])

  if (!leftData || !rightData) return err('数据集不存在', 404)

  // 应用预过滤
  const filteredLeft = applyFilters(leftData.rows as Row[], leftFilters as JoinFilter[])
  const filteredRight = applyFilters(rightData.rows as Row[], rightFilters as JoinFilter[])

  // 构建右表哈希
  const rightMap = new Map<string, Row>()
  filteredRight.forEach((row: Row) => {
    const key = row[rightKey]
    if (key !== undefined) rightMap.set(key, row)
  })

  // 处理字段名冲突
  const outputFields: string[] = []
  const outputLabels: string[] = []
  const fieldMap: { source: 'left' | 'right'; original: string; output: string }[] = []

  const getLabel = (fields: string[], labels: string[], field: string) => {
    const idx = fields.indexOf(field)
    return idx >= 0 ? labels[idx] : field
  }

  for (const f of leftFields) {
    outputFields.push(f)
    outputLabels.push(getLabel(leftData.fields, leftData.labels, f))
    fieldMap.push({ source: 'left', original: f, output: f })
  }

  for (const f of rightFields) {
    let outputName = f
    let suffix = 2
    while (outputFields.includes(outputName)) {
      outputName = `${f}_${suffix++}`
    }
    outputFields.push(outputName)
    const label = getLabel(rightData.fields, rightData.labels, f)
    outputLabels.push(outputName !== f ? `${label}(右)` : label)
    fieldMap.push({ source: 'right', original: f, output: outputName })
  }

  // 执行关联
  const resultRows: Row[] = filteredLeft.map((leftRow: Row) => {
    const rightRow = rightMap.get(leftRow[leftKey]) || {}
    const row: Row = {}
    fieldMap.forEach(({ source, original, output }) => {
      row[output] = (source === 'left' ? leftRow[original] : (rightRow as Row)[original]) ?? ''
    })
    return row
  })

  const previewRows = previewOnly ? resultRows.slice(0, 50) : resultRows

  if (previewOnly) {
    return ok({ fields: outputFields, labels: outputLabels, rows: previewRows, totalCount: resultRows.length })
  }

  // 保存结果
  const colConfig: Record<string, boolean> = {}
  outputFields.forEach((f) => (colConfig[f] = true))

  const { data: maxRow } = await supabase
    .from('histories')
    .select('sort_order')
    .eq('case_id', caseId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .single()

  const { data: saved, error: saveError } = await supabase
    .from('histories')
    .insert({
      case_id: caseId,
      imported_by: user.id,
      section_tag: resultName || `join_result`,
      meta: { Joined: 'True' },
      fields: outputFields,
      labels: outputLabels,
      rows: resultRows,
      col_config: colConfig,
      page_size: 20,
      viz_configs: [],
      sort_order: (maxRow?.sort_order ?? 0) + 1,
    })
    .select()
    .single()

  if (saveError) return err(saveError.message, 500)
  return ok(saved)
}
