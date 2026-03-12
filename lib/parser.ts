import type { Meta, Row, ParseResult } from '@/types'

export function parseText(raw: string, fileName: string = ''): ParseResult {
  const meta: Meta = {}

  // 1. Meta Info
  const metaMatch = raw.match(/<[!！]\s*(.*?)\s*[!！]>/)
  if (metaMatch) {
    const metaContent = metaMatch[1]
    const metaRegex = /(\w+)\s*=\s*['"\u201c\u2018]?([^'"\u201d\u2019>\s]+)['"\u201d\u2019]?/g
    let match
    while ((match = metaRegex.exec(metaContent)) !== null) {
      meta[match[1]] = match[2]
    }
  }

  // 2. Section Tag
  let sectionTag = ''
  const tagMatch = raw.match(/<([A-Za-z][\w]*?)(?:\s|>)/)
  if (tagMatch) {
    sectionTag = tagMatch[1]
  } else {
    sectionTag = meta.Grid || ''
  }
  if (!sectionTag && fileName) {
    sectionTag = fileName.replace(/\.[^/.]+$/, '')
  }

  // 3. Fields
  const fieldsMatch = raw.match(/^@[ \t]+(.+)$/m)
  if (!fieldsMatch) {
    return { ok: false, msg: '未找到字段定义行 (@ Field1 Field2...)' }
  }
  const rawFields = fieldsMatch[1].trim().split(/\s+/)
  const fields = rawFields.map((f) => {
    const ascii = f.replace(/[^\x00-\x7F]/g, '')
    return ascii || f
  })

  // 4. Labels (Optional)
  let labels: string[] = [...fields]
  const labelsMatch = raw.match(/^\/[@\/][ \t]+(.+)$/m)
  if (labelsMatch) {
    const parts = labelsMatch[1].trim().split(/\s+/)
    labels = fields.map((f, i) => parts[i] || f)
  }

  // 5. Data Rows
  const rows: Row[] = []
  const lines = raw.split(/\r?\n/)

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    if (
      trimmed.startsWith('<') ||
      trimmed.startsWith('!') ||
      trimmed.startsWith('@') ||
      trimmed.startsWith('//') ||
      trimmed.startsWith('/@')
    )
      continue

    let cols: string[]
    if (trimmed.startsWith('#')) {
      cols = trimmed.substring(1).trim().split(/\s+/)
    } else {
      cols = trimmed.split(/\s+/)
    }

    if (cols.length < fields.length * 0.5) continue

    const row: Row = {}
    fields.forEach((f, i) => {
      row[f] = cols[i] ?? ''
    })
    rows.push(row)
  }

  if (rows.length === 0) {
    return { ok: false, msg: '未解析到数据行' }
  }

  return {
    ok: true,
    record: {
      sectionTag,
      meta,
      fields,
      labels,
      rows,
    },
  }
}
