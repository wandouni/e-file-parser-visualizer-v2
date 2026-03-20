import type { InferSelectModel } from 'drizzle-orm'
import type { histories } from './schema'

type HistoryRow = InferSelectModel<typeof histories>

export function historyToApi(h: HistoryRow, includeRows = true) {
  return {
    id: h.id,
    case_id: h.caseId,
    import_time: h.importTime,
    imported_by: h.importedBy,
    section_tag: h.sectionTag,
    meta: h.meta,
    fields: h.fields,
    labels: h.labels,
    rows: includeRows ? h.rows : [],
    col_config: h.colConfig,
    page_size: h.pageSize,
    viz_configs: h.vizConfigs,
    sort_order: h.sortOrder,
    created_at: h.createdAt,
    updated_at: h.updatedAt,
  }
}
