'use client'

import { useState, useEffect } from 'react'
import { Plus, X, ArrowRight } from 'lucide-react'
import { Modal } from './Modal'
import { useApp } from '@/context/AppContext'
import type { HistoryRecord, JoinFilter, Row } from '@/types'

interface Props { onClose: () => void }

export default function JoinModal({ onClose }: Props) {
  const { histories, addHistory, activeCaseId } = useApp()

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
      leftHistoryId: leftId,
      rightHistoryId: rightId,
      leftKey, rightKey,
      leftFields: leftSelected,
      rightFields: rightSelected,
      leftFilters: filters.left.filter((f) => f.field),
      rightFilters: filters.right.filter((f) => f.field),
      resultName,
      previewOnly,
    }
  }

  async function handlePreview() {
    if (!leftRecord || !rightRecord || !leftKey || !rightKey) return
    setLoading(true)
    const res = await fetch('/api/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildRequest(true)),
    })
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
    const res = await fetch('/api/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildRequest(false)),
    })
    const { data, error } = await res.json()
    if (error) { alert(error.message); setLoading(false); return }
    addHistory({
      id: data.id, caseId: data.case_id, importTime: data.import_time,
      importedBy: data.imported_by, sectionTag: data.section_tag,
      meta: data.meta, fields: data.fields, labels: data.labels,
      rows: data.rows, colConfig: data.col_config, pageSize: data.page_size,
      vizConfigs: data.viz_configs, sortOrder: data.sort_order,
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

    return (
      <div className="flex-1 flex flex-col gap-3 p-4 border rounded-lg" style={{ borderColor: 'var(--border)', background: '#f8fafc' }}>
        <div>
          <label className="text-[10px] font-medium block mb-1" style={{ color: 'var(--text2)' }}>
            {side === 'left' ? '左表（保留全部）' : '右表（查找匹配）'}
          </label>
          <select className="w-full border rounded-lg px-2 py-1.5 text-xs outline-none bg-white"
            style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
            value={recordId}
            onChange={(e) => {
              setRecordId(e.target.value); setKey('')
              setOutputFields((prev) => { const n = new Set(prev); prev.forEach((f) => { if (f.startsWith(side + '.')) n.delete(f) }); return n })
              setFilters((prev) => ({ ...prev, [side]: [] }))
            }}>
            <option value="">选择数据源...</option>
            {histories.map((h) => <option key={h.id} value={h.id}>{h.sectionTag} ({h.meta.Time?.substring(0, 16)})</option>)}
          </select>
        </div>

        {record && (
          <>
            <div>
              <label className="text-[10px] font-medium block mb-1" style={{ color: 'var(--text2)' }}>关联主键</label>
              <select className="w-full border rounded-lg px-2 py-1.5 text-xs outline-none bg-white"
                style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
                value={key} onChange={(e) => setKey(e.target.value)}>
                <option value="">选择关联字段...</option>
                {record.fields.map((f, i) => <option key={f} value={f}>{record.labels[i] || f}</option>)}
              </select>
            </div>

            <div className="flex flex-col flex-1 min-h-[120px]">
              <div className="flex justify-between items-center mb-1">
                <label className="text-[10px] font-medium" style={{ color: 'var(--text2)' }}>输出列</label>
                <div className="flex gap-2">
                  <button className="text-[9px] font-medium" style={{ color: 'var(--accent)' }}
                    onClick={() => setOutputFields((p) => { const n = new Set(p); record.fields.forEach((f) => n.add(`${side}.${f}`)); return n })}>全选</button>
                  <button className="text-[9px] font-medium" style={{ color: 'var(--text3)' }}
                    onClick={() => setOutputFields((p) => { const n = new Set(p); record.fields.forEach((f) => n.delete(`${side}.${f}`)); return n })}>清空</button>
                </div>
              </div>
              <div className="border rounded-lg bg-white overflow-y-auto max-h-[140px]" style={{ borderColor: 'var(--border)' }}>
                {record.fields.map((f, i) => (
                  <label key={f} className="flex items-center gap-2 px-2 py-1 hover:bg-gray-50 cursor-pointer">
                    <input type="checkbox" checked={outputFields.has(`${side}.${f}`)}
                      onChange={(e) => setOutputFields((p) => { const n = new Set(p); e.target.checked ? n.add(`${side}.${f}`) : n.delete(`${side}.${f}`); return n })}
                      className="w-3 h-3" style={{ accentColor: 'var(--accent)' }} />
                    <span className="text-[10px]" style={{ color: 'var(--text)' }}>{record.labels[i] || f}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-[10px] font-medium" style={{ color: 'var(--text2)' }}>数据预筛选</label>
                <button onClick={() => setFilters((p) => ({ ...p, [side]: [...p[side], { field: '', op: 'eq', value: '' }] }))}
                  className="text-[9px] font-medium flex items-center gap-1 px-1.5 py-0.5 border rounded"
                  style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}>
                  <Plus size={9} /> 新增
                </button>
              </div>
              <div className="space-y-1">
                {sideFilters.map((filter, idx) => (
                  <div key={idx} className="flex gap-1 items-center bg-white p-1 border rounded" style={{ borderColor: 'var(--border)' }}>
                    <select className="text-[9px] border rounded px-1 py-0.5 w-20 outline-none" style={{ borderColor: 'var(--border)' }}
                      value={filter.field} onChange={(e) => updateFilter(side, idx, { field: e.target.value })}>
                      <option value="">字段...</option>
                      {record.fields.map((f, i) => <option key={f} value={f}>{record.labels[i] || f}</option>)}
                    </select>
                    <select className="text-[9px] border rounded px-1 py-0.5 w-16 outline-none" style={{ borderColor: 'var(--border)' }}
                      value={filter.op} onChange={(e) => updateFilter(side, idx, { op: e.target.value as any })}>
                      <option value="eq">等于</option>
                      <option value="neq">不等于</option>
                      <option value="gt">大于</option>
                      <option value="gte">≥</option>
                      <option value="lt">小于</option>
                      <option value="lte">≤</option>
                      <option value="contains">包含</option>
                    </select>
                    <input className="text-[9px] border rounded flex-1 min-w-0 px-1 py-0.5 outline-none" style={{ borderColor: 'var(--border)' }}
                      value={filter.value} onChange={(e) => updateFilter(side, idx, { value: e.target.value })} />
                    <button onClick={() => setFilters((p) => ({ ...p, [side]: p[side].filter((_, i) => i !== idx) }))}
                      className="p-0.5 hover:text-red-500" style={{ color: 'var(--text3)' }}><X size={11} /></button>
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
    <Modal isOpen onClose={onClose} title="多表关联合并" width="1000px" height="90vh">
      <div className="flex flex-col h-full bg-white">
        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex gap-3 items-start">
            {renderPanel('left')}
            <div className="pt-16" style={{ color: 'var(--border)' }}><ArrowRight size={22} /></div>
            {renderPanel('right')}
          </div>

          {/* 结果区 */}
          <div className="mt-5 pt-5 border-t" style={{ borderColor: 'var(--border)' }}>
            <div className="flex gap-3 items-end mb-4">
              <div className="flex-1">
                <label className="text-[10px] font-medium block mb-1" style={{ color: 'var(--text2)' }}>合并结果名称</label>
                <input className="w-full border rounded-lg px-3 py-1.5 text-xs outline-none"
                  style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
                  value={resultName} onChange={(e) => setResultName(e.target.value)}
                  placeholder="输入合并后的数据集名称..." />
              </div>
              <button onClick={handlePreview} disabled={!leftRecord || !rightRecord || !leftKey || !rightKey || loading}
                className="border rounded-lg px-5 py-1.5 text-xs font-medium hover:bg-gray-50 disabled:opacity-30 transition-colors whitespace-nowrap"
                style={{ borderColor: 'var(--border)', color: 'var(--text2)' }}>
                {loading ? '计算中...' : '预览效果'}
              </button>
            </div>

            {showPreview && previewRows.length > 0 && (
              <div className="border rounded-lg overflow-hidden" style={{ borderColor: 'var(--border)' }}>
                <div className="px-3 py-2 text-[10px] font-medium text-white flex justify-between items-center"
                  style={{ background: 'var(--accent)' }}>
                  <span>预览前 50 行数据</span>
                  <span className="bg-white/20 px-1.5 py-0.5 rounded">{previewRows.length} 条</span>
                </div>
                <div className="overflow-x-auto max-h-[280px]">
                  <table className="w-full text-left border-collapse text-[10px]">
                    <thead className="sticky top-0 border-b" style={{ background: '#f1f5f9', borderColor: 'var(--border)' }}>
                      <tr>
                        {previewFields.map((k) => (
                          <th key={k} className="px-2 py-1.5 border-r font-medium min-w-[90px]" style={{ borderColor: 'var(--border)', color: 'var(--text2)' }}>{k}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y" style={{ color: 'var(--text)' }}>
                      {previewRows.map((row, i) => (
                        <tr key={i} className="hover:bg-blue-50">
                          {previewFields.map((k) => (
                            <td key={k} className="px-2 py-1 border-r truncate max-w-[180px]" style={{ borderColor: 'var(--border)' }}>{row[k]}</td>
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

        <div className="p-4 border-t flex justify-end gap-2 shrink-0" style={{ borderColor: 'var(--border)', background: '#f8fafc' }}>
          <button onClick={onClose} className="px-5 py-1.5 text-xs font-medium border rounded-lg hover:bg-gray-50"
            style={{ borderColor: 'var(--border)', color: 'var(--text2)' }}>取消</button>
          <button onClick={handleSave} disabled={!showPreview || loading}
            className="px-6 py-1.5 text-xs font-medium text-white rounded-lg disabled:opacity-30 hover:opacity-90"
            style={{ background: 'var(--accent)' }}>
            {loading ? '保存中...' : '完成合并并保存'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
