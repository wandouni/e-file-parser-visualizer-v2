'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { BarChart2, Settings, ArrowUp, ArrowDown, ArrowUpDown, ChevronLeft, ChevronRight, ListFilter, X } from 'lucide-react'
import { useApp } from '@/context/AppContext'

interface MainContentProps {
  onViz: () => void
  onColConfig: () => void
}

const FILTER_PAGE_SIZE = 10  // values per page inside the filter dropdown

export default function MainContent({ onViz, onColConfig }: MainContentProps) {
  const { histories, currentId, updateHistory, loadHistoryRows, activeCaseId, myRole } = useApp()

  const [sortState, setSortState] = useState<{ field: string; dir: 'asc' | 'desc' } | null>(null)
  // Record<field, Set<value>> — empty Set means "show all"
  const [filterState, setFilterState] = useState<Record<string, Set<string>>>({})
  const [currentPage, setCurrentPage] = useState(1)

  // Filter dropdown state
  const [openFilter, setOpenFilter] = useState<string | null>(null)
  const [filterSearch, setFilterSearch] = useState('')
  const [filterPage, setFilterPage] = useState(1)
  const [filterAnchor, setFilterAnchor] = useState<{ top: number; left: number; width: number } | null>(null)
  const [mounted, setMounted] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    setSortState(null)
    setFilterState({})
    setCurrentPage(1)
    setOpenFilter(null)
    if (currentId && activeCaseId) {
      const record = histories.find((h) => h.id === currentId)
      if (record && record.rows.length === 0) {
        loadHistoryRows(activeCaseId, currentId)
      }
    }
  }, [currentId])

  // Close dropdown on outside click
  useEffect(() => {
    if (!openFilter) return
    function onDown(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenFilter(null)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [openFilter])

  const currentRecord = useMemo(
    () => histories.find((h) => h.id === currentId),
    [histories, currentId]
  )

  // Distinct sorted values per visible field
  const distinctValues = useMemo(() => {
    if (!currentRecord) return {} as Record<string, string[]>
    const result: Record<string, string[]> = {}
    for (const field of currentRecord.fields) {
      const seen = new Set<string>()
      for (const row of currentRecord.rows) seen.add(String(row[field] ?? ''))
      result[field] = [...seen].sort((a, b) => {
        const na = parseFloat(a), nb = parseFloat(b)
        if (!isNaN(na) && !isNaN(nb)) return na - nb
        return a.localeCompare(b, 'zh')
      })
    }
    return result
  }, [currentRecord])

  const processedRows = useMemo(() => {
    if (!currentRecord) return []
    let rows = [...currentRecord.rows]

    const activeFilters = Object.entries(filterState).filter(([, set]) => set.size > 0)
    if (activeFilters.length > 0) {
      rows = rows.filter((row) =>
        activeFilters.every(([field, set]) => set.has(String(row[field] ?? '')))
      )
    }

    if (sortState) {
      const { field, dir } = sortState
      rows.sort((a, b) => {
        const va = a[field] || '', vb = b[field] || ''
        const na = parseFloat(va), nb = parseFloat(vb)
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
  const hasAnyFilter = Object.values(filterState).some((s) => s.size > 0)

  function openFilterFor(field: string, el: HTMLElement) {
    if (openFilter === field) { setOpenFilter(null); return }
    const rect = el.getBoundingClientRect()
    const dropW = Math.max(rect.width, 220)
    const left = Math.min(rect.left, window.innerWidth - dropW - 8)
    setFilterAnchor({ top: rect.bottom + 2, left, width: dropW })
    setOpenFilter(field)
    setFilterSearch('')
    setFilterPage(1)
  }

  function toggleValue(field: string, val: string) {
    setFilterState((prev) => {
      const s = new Set(prev[field] || [])
      if (s.has(val)) s.delete(val); else s.add(val)
      return { ...prev, [field]: s }
    })
    setCurrentPage(1)
  }

  function clearFilter(field: string) {
    setFilterState((prev) => { const n = { ...prev }; delete n[field]; return n })
    setCurrentPage(1)
  }

  // --- Dropdown content ---
  const dropdownField = openFilter
  const allVals = dropdownField ? (distinctValues[dropdownField] || []) : []
  const searched = filterSearch
    ? allVals.filter((v) => v.toLowerCase().includes(filterSearch.toLowerCase()))
    : allVals
  const totalValPages = Math.max(1, Math.ceil(searched.length / FILTER_PAGE_SIZE))
  const pageVals = searched.slice((filterPage - 1) * FILTER_PAGE_SIZE, filterPage * FILTER_PAGE_SIZE)
  const selectedSet: Set<string> = (dropdownField ? filterState[dropdownField] : null) || new Set()

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
            <ToolbarBtn onClick={onViz} icon={<BarChart2 size={12} />} label="可视化分析" accent
              dot={!!(currentRecord.vizConfigs.length > 0 || currentRecord.multiSubjectConfig?.keyField)} />
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
                  const selectedCount = filterState[field]?.size ?? 0
                  const isFiltered = selectedCount > 0
                  const isOpen = openFilter === field

                  return (
                    <th
                      key={field}
                      style={{ padding: 0, borderRight: '1px solid #e2e8f0', minWidth: 100, background: isFiltered ? '#eff6ff' : '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'stretch' }}>
                        {/* Sort area */}
                        <div
                          onClick={() => setSortState((prev) => {
                            if (prev?.field !== field) return { field, dir: 'asc' }
                            if (prev.dir === 'asc') return { field, dir: 'desc' }
                            return null
                          })}
                          style={{ flex: 1, padding: '8px 6px 8px 8px', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', userSelect: 'none', minWidth: 0 }}
                        >
                          <span style={{ fontSize: 11, fontWeight: 600, color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
                          <span style={{ flexShrink: 0, color: '#2563eb' }}>
                            {isSorted
                              ? sortState!.dir === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />
                              : <ArrowUpDown size={11} style={{ color: '#cbd5e1' }} />
                            }
                          </span>
                        </div>

                        {/* Filter button */}
                        <button
                          onClick={(e) => openFilterFor(field, e.currentTarget.closest('th') as HTMLElement)}
                          title={isFiltered ? `已选 ${selectedCount} 项` : '筛选'}
                          style={{
                            flexShrink: 0, padding: '0 8px', border: 'none', borderLeft: '1px solid #e2e8f0',
                            background: isOpen ? '#dbeafe' : isFiltered ? '#bfdbfe' : 'transparent',
                            color: isFiltered || isOpen ? '#2563eb' : '#94a3b8',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3,
                            transition: 'background 0.1s',
                          }}
                        >
                          <ListFilter size={11} />
                          {isFiltered && <span style={{ fontSize: 10, fontWeight: 700 }}>{selectedCount}</span>}
                        </button>
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
        {hasAnyFilter && (
          <div style={{ padding: '7px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#2563eb', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden', fontSize: 11, color: '#fff', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 700, opacity: 0.85, flexShrink: 0 }}>筛选中:</span>
              {Object.entries(filterState).filter(([, s]) => s.size > 0).map(([k, s]) => {
                const lbl = currentRecord.labels[currentRecord.fields.indexOf(k)] || k
                return (
                  <span key={k} style={{ background: 'rgba(255,255,255,0.18)', padding: '2px 6px', borderRadius: 4, fontSize: 10, display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
                    {lbl}: {s.size === 1 ? [...s][0] : `${s.size} 项`}
                    <button onClick={() => clearFilter(k)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.75)', display: 'flex', alignItems: 'center', padding: 0 }}>
                      <X size={10} />
                    </button>
                  </span>
                )
              })}
              <span style={{ color: 'rgba(191,219,254,0.9)', marginLeft: 2 }}>({processedRows.length} 条)</span>
            </div>
            <button
              onClick={() => { setFilterState({}); setCurrentPage(1) }}
              style={{ background: '#fff', color: '#2563eb', border: 'none', borderRadius: 4, padding: '3px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer', flexShrink: 0, marginLeft: 8 }}
            >
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
                      width: 26, height: 26,
                      border: p === currentPage ? '1px solid #2563eb' : typeof p === 'number' ? '1px solid #e2e8f0' : 'none',
                      borderRadius: 5, fontSize: 11, fontWeight: 600,
                      cursor: typeof p === 'number' ? 'pointer' : 'default',
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

      {/* 筛选下拉弹层 (portal, 避免被 overflow:hidden 裁剪) */}
      {mounted && openFilter && filterAnchor && createPortal(
        <div
          ref={dropdownRef}
          style={{
            position: 'fixed',
            top: filterAnchor.top,
            left: filterAnchor.left,
            width: filterAnchor.width,
            minWidth: 200,
            maxWidth: 300,
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            boxShadow: '0 6px 24px rgba(0,0,0,0.12)',
            zIndex: 9999,
            overflow: 'hidden',
          }}
        >
          {/* 搜索框 */}
          <div style={{ padding: '8px 8px 6px', borderBottom: '1px solid #f1f5f9' }}>
            <input
              autoFocus
              type="text"
              placeholder="搜索值..."
              value={filterSearch}
              onChange={(e) => { setFilterSearch(e.target.value); setFilterPage(1) }}
              style={{ width: '100%', fontSize: 11, padding: '4px 8px', border: '1px solid #e2e8f0', borderRadius: 4, outline: 'none', color: '#0f172a', boxSizing: 'border-box' }}
            />
          </div>

          {/* 全选 / 清除 */}
          <div style={{ padding: '5px 8px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={() => {
                setFilterState((prev) => ({ ...prev, [openFilter]: new Set(searched) }))
                setCurrentPage(1)
              }}
              style={{ fontSize: 10, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 600 }}
            >
              {filterSearch ? '全选结果' : '全选'}
            </button>
            <span style={{ color: '#e2e8f0' }}>|</span>
            <button
              onClick={() => { clearFilter(openFilter); }}
              style={{ fontSize: 10, color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              清除筛选
            </button>
            <span style={{ marginLeft: 'auto', fontSize: 10, color: '#94a3b8' }}>
              {searched.length} 项
            </span>
          </div>

          {/* 值列表 */}
          <div>
            {pageVals.length === 0 ? (
              <div style={{ padding: '14px 8px', textAlign: 'center', fontSize: 11, color: '#94a3b8' }}>无匹配项</div>
            ) : (
              pageVals.map((val) => {
                const checked = selectedSet.has(val)
                return (
                  <label
                    key={val}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', cursor: 'pointer', borderBottom: '1px solid #f8fafc' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#f8fafc' }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = '' }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleValue(openFilter, val)}
                      style={{ cursor: 'pointer', flexShrink: 0, accentColor: '#2563eb' }}
                    />
                    <span style={{ fontSize: 11, color: checked ? '#1d4ed8' : '#374151', fontWeight: checked ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {val === '' ? <em style={{ color: '#94a3b8' }}>(空)</em> : val}
                    </span>
                  </label>
                )
              })
            )}
          </div>

          {/* 分页 */}
          {totalValPages > 1 && (
            <div style={{ padding: '6px 10px', borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc' }}>
              <button
                onClick={() => setFilterPage((p) => Math.max(1, p - 1))}
                disabled={filterPage === 1}
                style={{ width: 22, height: 22, border: '1px solid #e2e8f0', borderRadius: 4, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: filterPage === 1 ? 'not-allowed' : 'pointer', opacity: filterPage === 1 ? 0.4 : 1, color: '#475569' }}
              >
                <ChevronLeft size={11} />
              </button>
              <span style={{ fontSize: 10, color: '#64748b' }}>{filterPage} / {totalValPages} 页</span>
              <button
                onClick={() => setFilterPage((p) => Math.min(totalValPages, p + 1))}
                disabled={filterPage === totalValPages}
                style={{ width: 22, height: 22, border: '1px solid #e2e8f0', borderRadius: 4, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: filterPage === totalValPages ? 'not-allowed' : 'pointer', opacity: filterPage === totalValPages ? 0.4 : 1, color: '#475569' }}
              >
                <ChevronRight size={11} />
              </button>
            </div>
          )}
        </div>,
        document.body
      )}
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

function ToolbarBtn({ onClick, icon, label, accent, dot }: { onClick: () => void; icon: React.ReactNode; label: string; accent?: boolean; dot?: boolean }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative', display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', fontSize: 12, fontWeight: 500,
        border: `1px solid ${accent && hovered ? '#2563eb' : '#e2e8f0'}`,
        borderRadius: 6, cursor: 'pointer',
        background: accent && hovered ? '#2563eb' : '#fff',
        color: accent && hovered ? '#fff' : '#475569',
        transition: 'all 0.15s',
      }}
    >
      {icon} {label}
      {dot && (
        <span style={{ position: 'absolute', top: 3, right: 3, width: 6, height: 6, borderRadius: '50%', background: '#ef4444', border: '1.5px solid #fff' }} />
      )}
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
