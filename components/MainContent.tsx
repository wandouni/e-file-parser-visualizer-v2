'use client'

import { useState, useEffect, useMemo } from 'react'
import { BarChart2, Settings, ArrowUp, ArrowDown, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { useApp } from '@/context/AppContext'

interface MainContentProps {
  onViz: () => void
  onColConfig: () => void
}

export default function MainContent({ onViz, onColConfig }: MainContentProps) {
  const { histories, currentId, updateHistory, loadHistoryRows, activeCaseId, myRole } = useApp()

  const [sortState, setSortState] = useState<{ field: string; dir: 'asc' | 'desc' } | null>(null)
  const [filterState, setFilterState] = useState<Record<string, string>>({})
  const [currentPage, setCurrentPage] = useState(1)

  const currentRecord = useMemo(() => histories.find((h) => h.id === currentId), [histories, currentId])

  useEffect(() => {
    setSortState(null)
    setFilterState({})
    setCurrentPage(1)
    if (currentId && activeCaseId) {
      const record = histories.find((h) => h.id === currentId)
      if (record && record.rows.length === 0) {
        loadHistoryRows(activeCaseId, currentId)
      }
    }
  }, [currentId])

  const processedRows = useMemo(() => {
    if (!currentRecord) return []
    let rows = [...currentRecord.rows]

    const activeFilters = Object.entries(filterState).filter(([, val]) => val)
    if (activeFilters.length > 0) {
      rows = rows.filter((row) =>
        activeFilters.every(([field, val]) =>
          String(row[field] || '').toLowerCase().includes(val.toLowerCase())
        )
      )
    }

    if (sortState) {
      const { field, dir } = sortState
      rows.sort((a, b) => {
        const va = a[field] || ''
        const vb = b[field] || ''
        const na = parseFloat(va)
        const nb = parseFloat(vb)
        if (!isNaN(na) && !isNaN(nb)) return dir === 'asc' ? na - nb : nb - na
        return dir === 'asc' ? va.localeCompare(vb, 'zh') : vb.localeCompare(va, 'zh')
      })
    }

    return rows
  }, [currentRecord, filterState, sortState])

  if (!currentRecord) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9', color: '#94a3b8' }}>
        <BarChart2 size={44} style={{ opacity: 0.2, marginBottom: 12 }} />
        <p style={{ fontSize: 13 }}>暂无数据，请导入或选择历史记录</p>
      </div>
    )
  }

  const totalPages = Math.max(1, Math.ceil(processedRows.length / currentRecord.pageSize))
  const paginatedRows = processedRows.slice(
    (currentPage - 1) * currentRecord.pageSize,
    currentPage * currentRecord.pageSize
  )
  const visibleFields = currentRecord.fields.filter((f) => currentRecord.colConfig[f])

  return (
    <div style={{ flex: 1, padding: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column', minWidth: 0, background: '#f1f5f9' }}>
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

        {/* 工具栏 */}
        <div style={{ height: 44, borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', padding: '0 14px', gap: 12, flexShrink: 0, background: '#f8fafc' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 320 }}>
            {currentRecord.sectionTag}
            {currentRecord.meta.Time && (
              <span style={{ marginLeft: 8, fontSize: 11, color: '#94a3b8', fontWeight: 400 }}>{currentRecord.meta.Time.substring(0, 16)}</span>
            )}
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            <ToolbarBtn onClick={onViz} icon={<BarChart2 size={12} />} label="可视化分析" accent />
            {(myRole === 'owner' || myRole === 'editor') && (
              <ToolbarBtn onClick={onColConfig} icon={<Settings size={12} />} label="显示配置" />
            )}
          </div>
        </div>

        {/* 表格区域 */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
              <tr>
                {visibleFields.map((field) => {
                  const label = currentRecord.labels[currentRecord.fields.indexOf(field)] || field
                  const isSorted = sortState?.field === field
                  const hasFilter = !!filterState[field]
                  return (
                    <th
                      key={field}
                      style={{ padding: 0, borderRight: '1px solid #e2e8f0', minWidth: 100, background: hasFilter ? '#eff6ff' : '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}
                    >
                      <div
                        onClick={() => setSortState((prev) => {
                          if (prev?.field !== field) return { field, dir: 'asc' }
                          if (prev.dir === 'asc') return { field, dir: 'desc' }
                          return null
                        })}
                        style={{ padding: '7px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none' }}
                      >
                        <span style={{ fontSize: 11, fontWeight: 600, color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
                        <span style={{ marginLeft: 4, flexShrink: 0, color: '#2563eb' }}>
                          {isSorted
                            ? sortState!.dir === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />
                            : <ArrowUpDown size={11} style={{ color: '#cbd5e1' }} />
                          }
                        </span>
                      </div>
                      <div style={{ padding: '0 6px 6px' }}>
                        <input
                          type="text"
                          placeholder="过滤..."
                          value={filterState[field] || ''}
                          onChange={(e) => { setFilterState((prev) => ({ ...prev, [field]: e.target.value })); setCurrentPage(1) }}
                          onClick={(e) => e.stopPropagation()}
                          style={{ width: '100%', fontSize: 10, padding: '3px 6px', border: '1px solid #e2e8f0', borderRadius: 4, outline: 'none', background: '#fff', color: '#0f172a', boxSizing: 'border-box' }}
                        />
                      </div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {paginatedRows.length > 0 ? (
                paginatedRows.map((row, idx) => (
                  <TableRow key={idx} row={row} fields={visibleFields} />
                ))
              ) : (
                <tr>
                  <td colSpan={visibleFields.length} style={{ padding: '40px 16px', textAlign: 'center', fontSize: 12, color: '#94a3b8' }}>
                    无匹配数据
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* 过滤状态栏 */}
        {Object.values(filterState).some(Boolean) && (
          <div style={{ padding: '7px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#2563eb', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden', fontSize: 11, color: '#fff' }}>
              <span style={{ fontWeight: 700, opacity: 0.85, flexShrink: 0 }}>过滤中:</span>
              {Object.entries(filterState).filter(([, v]) => v).map(([k, v]) => (
                <span key={k} style={{ background: 'rgba(255,255,255,0.15)', padding: '2px 7px', borderRadius: 4, fontSize: 10, whiteSpace: 'nowrap' }}>
                  {currentRecord.labels[currentRecord.fields.indexOf(k)] || k}: {v}
                </span>
              ))}
              <span style={{ color: 'rgba(191,219,254,0.9)', marginLeft: 2 }}>({processedRows.length} 条)</span>
            </div>
            <button onClick={() => setFilterState({})} style={{ background: '#fff', color: '#2563eb', border: 'none', borderRadius: 4, padding: '3px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer', flexShrink: 0, marginLeft: 8 }}>
              重置
            </button>
          </div>
        )}

        {/* 分页栏 */}
        <div style={{ height: 44, borderTop: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 14px', flexShrink: 0, background: '#f8fafc' }}>
          <div style={{ fontSize: 11, color: '#64748b' }}>
            <span style={{ color: '#0f172a', fontWeight: 600 }}>共 {currentRecord.rows.length}</span> 条
            {processedRows.length !== currentRecord.rows.length && (
              <span style={{ marginLeft: 6, color: '#2563eb' }}>/ 过滤后 {processedRows.length} 条</span>
            )}
            <span style={{ margin: '0 8px', color: '#e2e8f0' }}>|</span>
            第 {currentPage} / {totalPages} 页
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <PageBtn onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>
                <ChevronLeft size={13} />
              </PageBtn>

              {(() => {
                const pages: (number | '...')[] = []
                if (totalPages <= 5) {
                  for (let i = 1; i <= totalPages; i++) pages.push(i)
                } else {
                  pages.push(1)
                  if (currentPage > 3) pages.push('...')
                  for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) pages.push(i)
                  if (currentPage < totalPages - 2) pages.push('...')
                  pages.push(totalPages)
                }
                return pages.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => typeof p === 'number' && setCurrentPage(p)}
                    disabled={typeof p !== 'number'}
                    style={{
                      width: 26, height: 26, border: p === currentPage ? '1px solid #2563eb' : typeof p === 'number' ? '1px solid #e2e8f0' : 'none',
                      borderRadius: 5, fontSize: 11, fontWeight: 600, cursor: typeof p === 'number' ? 'pointer' : 'default',
                      background: p === currentPage ? '#2563eb' : '#fff',
                      color: p === currentPage ? '#fff' : typeof p === 'number' ? '#475569' : '#94a3b8',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >{p}</button>
                ))
              })()}

              <PageBtn onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                <ChevronRight size={13} />
              </PageBtn>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 4 }}>
              <span style={{ fontSize: 11, color: '#94a3b8' }}>每页</span>
              <select
                value={currentRecord.pageSize}
                onChange={(e) => { updateHistory({ ...currentRecord, pageSize: Number(e.target.value) }); setCurrentPage(1) }}
                style={{ fontSize: 11, fontWeight: 600, border: '1px solid #e2e8f0', borderRadius: 5, padding: '3px 6px', outline: 'none', background: '#fff', color: '#0f172a', cursor: 'pointer' }}
              >
                {[10, 22, 35, 50, 100].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function TableRow({ row, fields }: { row: Record<string, string>; fields: string[] }) {
  const [hovered, setHovered] = useState(false)
  return (
    <tr
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ background: hovered ? '#f0f7ff' : '#fff', transition: 'background 0.08s', borderBottom: '1px solid #f1f5f9' }}
    >
      {fields.map((field) => (
        <td key={field} style={{ padding: '7px 8px', fontSize: 12, color: '#334155', borderRight: '1px solid #f1f5f9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }} title={row[field]}>
          {row[field]}
        </td>
      ))}
    </tr>
  )
}

function ToolbarBtn({ onClick, icon, label, accent }: { onClick: () => void; icon: React.ReactNode; label: string; accent?: boolean }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', fontSize: 12, fontWeight: 500,
        border: `1px solid ${accent && hovered ? '#2563eb' : '#e2e8f0'}`,
        borderRadius: 6, cursor: 'pointer',
        background: accent && hovered ? '#2563eb' : '#fff',
        color: accent && hovered ? '#fff' : '#475569',
        transition: 'all 0.15s',
      }}
    >
      {icon} {label}
    </button>
  )
}

function PageBtn({ onClick, disabled, children }: { onClick: () => void; disabled: boolean; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{ width: 26, height: 26, border: '1px solid #e2e8f0', borderRadius: 5, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.35 : 1, color: '#475569' }}
    >
      {children}
    </button>
  )
}
