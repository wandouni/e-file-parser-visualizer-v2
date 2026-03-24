import { db } from '@/lib/db'
import { histories, caseMembers } from '@/lib/db/schema'
import { getUser } from '@/lib/auth/session'
import { parseText } from '@/lib/parser'
import { historyToApi } from '@/lib/db/helpers'
import { ok, err } from '@/lib/utils'
import { eq, and, max } from 'drizzle-orm'

// POST /api/cases/:caseId/histories/import-text
// Accepts multipart/form-data with two usage modes:
//   Mode A (file/dir import): 'file' field = raw File, 'fileName'?, 'folder'?
//   Mode B (text paste):      'text' field = Blob of decoded text, 'fileName'?
// Server handles GBK↔UTF-8 detection in Mode A. Returns history WITHOUT rows.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const { caseId } = await params
  const user = await getUser()
  if (!user) return err('未登录', 401)

  const [member] = await db
    .select({ role: caseMembers.role })
    .from(caseMembers)
    .where(and(eq(caseMembers.caseId, caseId), eq(caseMembers.userId, user.id)))

  if (!member || member.role === 'viewer') return err('无导入权限', 403)

  const form = await request.formData()
  const fileName = (form.get('fileName') as string | null) || undefined
  const folder = (form.get('folder') as string | null) || undefined

  let text: string
  const rawFile = form.get('file') as File | null
  const textBlob = form.get('text') as File | null

  if (rawFile) {
    // Mode A: raw binary file — detect encoding server-side
    const buffer = Buffer.from(await rawFile.arrayBuffer())
    const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(buffer)
    if (utf8.includes('\ufffd')) {
      try {
        text = new TextDecoder('gbk', { fatal: false }).decode(buffer)
      } catch {
        text = utf8
      }
    } else {
      text = utf8
    }
  } else if (textBlob) {
    // Mode B: already-decoded text from paste tab
    text = await textBlob.text()
  } else {
    return err('缺少文件内容')
  }

  if (!text.trim()) return err('文件内容为空')

  const result = parseText(text, fileName)
  if (!result.ok) return err(result.msg || '解析失败')

  const record = result.record!
  let meta = folder ? { ...record.meta, __folder__: folder } : record.meta
  if (record.truncated) {
    meta = { ...meta, __truncated__: String(record.totalRows) }
  }

  const [maxRow] = await db
    .select({ maxOrder: max(histories.sortOrder) })
    .from(histories)
    .where(eq(histories.caseId, caseId))

  const sortOrder = (maxRow?.maxOrder ?? -1) + 1
  const colConfig: Record<string, boolean> = {}
  record.fields.forEach((f) => (colConfig[f] = true))

  const id = crypto.randomUUID()
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19)

  await db.insert(histories).values({
    id,
    caseId,
    importedBy: user.id,
    importTime: now,
    sectionTag: record.sectionTag,
    meta,
    fields: record.fields,
    labels: record.labels,
    rows: record.rows,
    colConfig,
    pageSize: 22,
    vizConfigs: [],
    sortOrder,
  })

  const [inserted] = await db.select().from(histories).where(eq(histories.id, id))
  const apiRecord = historyToApi(inserted, false)
  return ok({ ...apiRecord, _truncated: record.truncated, _totalRows: record.totalRows })
}
