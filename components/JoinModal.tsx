'use client'

import { useState, useEffect, useMemo } from 'react'
import { Plus, X, ArrowRight } from 'lucide-react'
import { Modal } from './Modal'
import { useApp } from '@/context/AppContext'
import type { HistoryRecord, JoinFilter, Row } from '@/types'
import { FilterValuePicker } from './FilterValuePicker'

interface Props { onClose: () => void }

const S = {
  label: { fontSize: 10, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 } as React.CSSProperties,
  select: { width: '100%', border: '1px solid #e2e8f0', borderRadius: 6, padding: '6px 8px', fontSize: 12, outline: 'none', background: '#fff', color: '#0f172a', boxSizing: 'border-box' } as React.CSSProperties,
  input: { border: '1px solid #e2e8f0', borderRadius: 6, padding: '5px 8px', fontSize: 11, outline: 'none', background: '#fff', color: '#0f172a', boxSizing: 'border-box' } as React.CSSProperties,
}

function buildDistinct(record: HistoryRecord | undefined): Record<string, string[]> {
  if (!record || record.rows.length === 0) return {}
  const result: Record<string, string[]> = {}
  for (const field of record.fields) {
    const seen = new Set<string>()
    for (const row of record.rows) seen.add(String(row[field] ?? ''))
    result[field] = [...seen].sort((a, b) => {
      const na = parseFloat(a), nb = parseFloat(b)
      if (!isNaN(na) && !isNaN(nb)) return na - nb
      return a.localeCompare(b, 'zh')
    })
  }
  return result
}

export default function JoinModal({ onClose }: Props) {
  const { histories, addHistory, activeCaseId, loadHistoryRows } = useApp()

  const [leftId, setLeftId] = useState('')
  const [rightId, setRightId] = useState('')
  const [leftKey, setLeftKey] = useState('')
  const [rightKey, setRightKey] = useState('')
  const [outputFields, setOutputFields] = useState<Set<string>>(new Set())
  const [filters, setFilters] = useState<{ left: JoinFilter[]; right: JoinFilter[] }>({ left: [], right: [] })
  const [resultName, setResultName] = useState('')
  const [previewRows, setPreviewRows] = useState<Row[]>([])
  const [previewFields, setPreviewFields] = useState<string[]>([])
  const [showPreview, setShowPreview] = useState(false)
  const [loading, setLoading] = useState(false)

  const leftRecord = histories.find((h) => h.id === leftId)
  const rightRecord = histories.find((h) => h.id === rightId)

  // Load rows for filter value picking when a record is selected
  useEffect(() => {
    if (leftId && activeCaseId) {
      const rec = histories.find((h) => h.id === leftId)
      if (rec && rec.rows.length === 0) loadHistoryRows(activeCaseId, leftId)
    }
  }, [leftId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (rightId && activeCaseId) {
      const rec = histories.find((h) => h.id === rightId)
      if (rec && rec.rows.length === 0) loadHistoryRows(activeCaseId, rightId)
    }
  }, [rightId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Distinct sorted values per field for each side
  const leftDistinct = useMemo(() => buildDistinct(leftRecord), [leftId, leftRecord?.rows.length]) // eslint-disable-line react-hooks/exhaustive-deps
  const rightDistinct = useMemo(() => buildDistinct(rightRecord), [rightId, rightRecord?.rows.length]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (leftRecord && rightRecord && leftKey && rightKey) {
      setResultName(`${leftRecord.sectionTag}_join_${rightRecord.sectionTag}_by_${leftKey}`)
    }
  }, [leftRecord, rightRecord, leftKey, rightKey])

  function updateFilter(side: 'left' | 'right', idx: number, updates: Partial<JoinFilter>) {
    setFilters((prev) => ({ ...prev, [side]: prev[side].map((f, i) => i === idx ? { ...f, ...updates } : f) }))
  }

  function buildRequest(previewOnly: boolean) {
    const leftSelected = Array.from(outputFields).filter((f) => f.startsWith('left.')).map((f) => f.slice(5))
    const rightSelected = Array.from(outputFields).filter((f) => f.startsWith('right.')).map((f) => f.slice(6))
    return {
      caseId: activeCaseId,
      leftHistoryId: leftId, rightHistoryId: rightId,
      leftKey, rightKey,
      leftFields: leftSelected, rightFields: rightSelected,
      leftFilters: filters.left.filter((f) => f.field),
      rightFilters: filters.right.filter((f) => f.field),
      resultName, previewOnly,
    }
  }

  async function handlePreview() {
    if (!leftRecord || !rightRecord || !leftKey || !rightKey) return
    setLoading(true)
    const res = await fetch('/api/join', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(buildRequest(true)) })
    const { data, error } = await res.json()
    if (error) { alert(error.message); setLoading(false); return }
    setPreviewRows(data.rows)
    setPreviewFields(data.fields)
    setShowPreview(true)
    setLoading(false)
  }

  async function handleSave() {
    if (!activeCaseId) return
    setLoading(true)
    const res = await fetch('/api/join', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(buildRequest(false)) })
    const { data, error } = await res.json()
    if (error) { alert(error.message); setLoading(false); return }
    addHistory({
      id: data.id, caseId: data.case_id, importTime: data.import_time,
      importedBy: data.imported_by, sectionTag: data.section_tag,
      meta: data.meta, fields: data.fields, labels: data.labels,
      rows: data.rows, colConfig: data.col_config, pageSize: data.page_size,
      vizConfigs: data.viz_configs, multiSubjectConfig: data.multi_subject_config ?? null, sortOrder: data.sort_order,
    })
    setLoading(false)
    onClose()
  }

  function renderPanel(side: 'left' | 'right') {
    const record = side === 'left' ? leftRecord : rightRecord
    const recordId = side === 'left' ? leftId : rightId
    const setRecordId = side === 'left' ? setLeftId : setRightId
    const key = side === 'left' ? leftKey : rightKey
    const setKey = side === 'left' ? setLeftKey : setRightKey
    const sideFilters = filters[side]
    const sideDistinct = side === 'left' ? leftDistinct : rightDistinct

    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, padding: 14, border: '1px solid #e2e8f0', borderRadius: 10, background: '#f8fafc', overflow: 'hidden' }}>
        {/* 数据源 */}
        <div>
          <label style={S.label}>{side === 'left' ? '左表（保留全部）' : '右表（查找匹配）'}</label>
          <select
            style={S.select}
            value={recordId}
            onChange={(e) => {
              setRecordId(e.target.value); setKey('')
              setOutputFields((prev) => { const n = new Set(prev); prev.forEach((f) => { if (f.startsWith(side + '.')) n.delete(f) }); return n })
              setFilters((prev) => ({ ...prev, [side]: [] }))
            }}
          >
            <option value="">选择数据源...</option>
            {histories.map((h) => <option key={h.id} value={h.id}>{h.sectionTag} ({h.meta.Time?.substring(0, 16)})</option>)}
          </select>
        </div>

        {record && (
          <>
            {/* 关联主键 */}
            <div>
              <label style={S.label}>关联主键</label>
              <select style={S.select} value={key} onChange={(e) => setKey(e.target.value)}>
                <option value="">选择关联字段...</option>
                {record.fields.map((f, i) => <option key={f} value={f}>{record.labels[i] || f}</option>)}
              </select>
            </div>

            {/* 输出列 */}
            <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <label style={{ ...S.label, marginBottom: 0 }}>输出列</label>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button style={{ fontSize: 10, fontWeight: 600, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer' }}
                    onClick={() => setOutputFields((p) => { const n = new Set(p); record.fields.forEach((f) => n.add(`${side}.${f}`)); return n })}>全选</button>
                  <button style={{ fontSize: 10, fontWeight: 600, color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer' }}
                    onClick={() => setOutputFields((p) => { const n = new Set(p); record.fields.forEach((f) => n.delete(`${side}.${f}`)); return n })}>清空</button>
                </div>
              </div>
              <div style={{ border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff', overflowY: 'auto', maxHeight: 150 }}>
                {record.fields.map((f, i) => (
                  <label key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9' }}>
                    <input type="checkbox" checked={outputFields.has(`${side}.${f}`)}
                      onChange={(e) => setOutputFields((p) => { const n = new Set(p); e.target.checked ? n.add(`${side}.${f}`) : n.delete(`${side}.${f}`); return n })}
                      style={{ width: 12, height: 12, accentColor: '#2563eb' }} />
                    <span style={{ fontSize: 11, color: '#0f172a' }}>{record.labels[i] || f}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* 预筛选 */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label style={{ ...S.label, marginBottom: 0 }}>数据预筛选</label>
                <button
                  onClick={() => setFilters((p) => ({ ...p, [side]: [...p[side], { field: '', op: 'eq', value: '' }] }))}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 600, color: '#2563eb', border: '1px solid #2563eb', borderRadius: 4, padding: '2px 8px', background: 'none', cursor: 'pointer' }}
                >
                  <Plus size={9} /> 新增
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {sideFilters.map((filter, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: 4, alignItems: 'center', background: '#fff', padding: 6, border: '1px solid #e2e8f0', borderRadius: 6 }}>
                    <select style={{ ...S.input, width: 90, padding: '4px 6px' }}
                      value={filter.field} onChange={(e) => updateFilter(side, idx, { field: e.target.value, value: '' })}>
                      <option value="">字段...</option>
                      {record.fields.map((f, i) => <option key={f} value={f}>{record.labels[i] || f}</option>)}
                    </select>
                    <select style={{ ...S.input, width: 60, padding: '4px 4px' }}
                      value={filter.op} onChange={(e) => updateFilter(side, idx, { op: e.target.value as any })}>
                      <option value="eq">等于</option>
                      <option value="neq">不等于</option>
                      <option value="gt">大于</option>
                      <option value="gte">≥</option>
                      <option value="lt">小于</option>
                      <option value="lte">≤</option>
                      <option value="contains">包含</option>
                    </select>
                    <FilterValuePicker
                      value={filter.value}
                      onChange={(v) => updateFilter(side, idx, { value: v })}
                      distinctValues={filter.field ? (sideDistinct[filter.field] ?? []) : []}
                      style={{ flex: 1, minWidth: 0 }}
                    />
                    <button onClick={() => setFilters((p) => ({ ...p, [side]: p[side].filter((_, i) => i !== idx) }))}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <Modal isOpen onClose={onClose} title="多表关联合并" width="960px" height="88vh">
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, background: '#fff' }}>
        {/* 主内容区 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* 双面板 */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            {renderPanel('left')}
            <div style={{ paddingTop: 60, color: '#cbd5e1', flexShrink: 0 }}>
              <ArrowRight size={20} />
            </div>
            {renderPanel('right')}
          </div>

          {/* 结果区 */}
          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <label style={S.label}>合并结果名称</label>
                <input
                  style={{ ...S.input, width: '100%', padding: '8px 10px', fontSize: 12 }}
                  value={resultName}
                  onChange={(e) => setResultName(e.target.value)}
                  placeholder="输入合并后的数据集名称..."
                />
              </div>
              <button
                onClick={handlePreview}
                disabled={!leftRecord || !rightRecord || !leftKey || !rightKey || loading}
                style={{ padding: '8px 20px', fontSize: 12, fontWeight: 600, border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', color: '#475569', cursor: 'pointer', whiteSpace: 'nowrap', opacity: (!leftRecord || !rightRecord || !leftKey || !rightKey || loading) ? 0.4 : 1 }}
              >
                {loading ? '计算中...' : '预览效果'}
              </button>
            </div>

            {/* 预览表格 */}
            {showPreview && previewRows.length > 0 && (
              <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
                <div style={{ padding: '8px 12px', background: '#2563eb', color: '#fff', fontSize: 11, fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>预览前 50 行数据</span>
                  <span style={{ background: 'rgba(255,255,255,0.2)', padding: '1px 8px', borderRadius: 4, fontSize: 10 }}>{previewRows.length} 条</span>
                </div>
                <div style={{ overflowX: 'auto', maxHeight: 260 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                    <thead style={{ position: 'sticky', top: 0 }}>
                      <tr>
                        {previewFields.map((k) => (
                          <th key={k} style={{ padding: '7px 10px', background: '#f1f5f9', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', fontWeight: 600, color: '#475569', textAlign: 'left', whiteSpace: 'nowrap', minWidth: 90 }}>{k}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                          {previewFields.map((k) => (
                            <td key={k} style={{ padding: '6px 10px', borderRight: '1px solid #f1f5f9', color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>{row[k]}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 底部操作栏 */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 16px', borderTop: '1px solid #e2e8f0', background: '#f8fafc', flexShrink: 0 }}>
          <button onClick={onClose}
            style={{ padding: '7px 20px', fontSize: 12, fontWeight: 500, border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', color: '#475569', cursor: 'pointer' }}>
            取消
          </button>
          <button onClick={handleSave} disabled={!showPreview || loading}
            style={{ padding: '7px 24px', fontSize: 12, fontWeight: 600, border: 'none', borderRadius: 8, background: '#2563eb', color: '#fff', cursor: 'pointer', opacity: (!showPreview || loading) ? 0.4 : 1 }}>
            {loading ? '保存中...' : '完成合并并保存'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
