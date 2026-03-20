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
    // 如果文件含有 E 文件标志（<!...!> 或行首 <Tag> 结构）但没有表定义，
    // 说明是合法的空数据集文件（如 HydroPlantWaterLvlReason.txt），允许导入为空记录
    // 注：要求 < 在行首，避免匹配日志文件中间的 < 字符（如 C++ 函数签名）
    const hasEFileMarker = /^[ \t]*<[!！]/m.test(raw) || /^[ \t]*<[A-Za-z][\w]*?[\s>]/m.test(raw)
    if (hasEFileMarker) {
      return {
        ok: true,
        record: {
          sectionTag: sectionTag || (fileName ? fileName.replace(/\.[^/.]+$/, '') : '未命名'),
          meta,
          fields: [],
          labels: [],
          rows: [],
        },
      }
    }
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

  // rows 为空时仍允许导入（文件格式合法但该数据集在本次计算中无记录）
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
