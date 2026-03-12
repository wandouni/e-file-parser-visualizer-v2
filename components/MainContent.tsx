'use client'

import { useState, useEffect, useMemo } from 'react'
import { BarChart2, Settings, ArrowUp, ArrowDown, ArrowUpDown, ChevronLeft, ArrowRight } from 'lucide-react'
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

  // 切换记录时按需加载 rows
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
      <div className="flex-1 flex flex-col items-center justify-center" style={{ background: 'var(--bg-main)', color: 'var(--text3)' }}>
        <BarChart2 size={48} className="mb-4 opacity-20" />
        <p className="text-sm">暂无数据，请导入或选择历史记录</p>
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
    <div className="flex-1 p-2 overflow-hidden flex flex-col min-w-0 bg-white">
      <div className="bg-white border flex flex-col h-full overflow-hidden rounded" style={{ borderColor: 'var(--border)' }}>
        {/* 工具栏 */}
        <div className="h-10 border-b flex items-center px-3 gap-3 shrink-0" style={{ borderColor: 'var(--border)', background: '#f8fafc' }}>
          <div className="text-xs font-medium truncate max-w-xs" style={{ color: 'var(--text)' }}>
            {currentRecord.sectionTag}
            <span className="ml-2 text-xs" style={{ color: 'var(--text3)' }}>{currentRecord.meta.Time?.substring(0, 16)}</span>
          </div>
          <div className="ml-auto flex gap-1.5">
            <button
              onClick={onViz}
              className="flex items-center gap-1 px-3 py-1 text-xs font-medium border rounded transition-all hover:text-white"
              style={{ borderColor: 'var(--border)', color: 'var(--text2)' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--accent)'; (e.currentTarget as HTMLElement).style.color = 'white'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ''; (e.currentTarget as HTMLElement).style.color = 'var(--text2)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)' }}
            >
              <BarChart2 size={12} />可视化分析
            </button>
            {(myRole === 'owner' || myRole === 'editor') && (
              <button
                onClick={onColConfig}
                className="flex items-center gap-1 px-3 py-1 text-xs font-medium border rounded transition-all hover:bg-gray-100"
                style={{ borderColor: 'var(--border)', color: 'var(--text2)' }}
              >
                <Settings size={12} />显示配置
              </button>
            )}
          </div>
        </div>

        {/* 表格区域 */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left border-collapse">
            <thead className="text-xs sticky top-0 z-10 border-b" style={{ background: '#f1f5f9', borderColor: 'var(--border)' }}>
              <tr>
                {visibleFields.map((field) => {
                  const label = currentRecord.labels[currentRecord.fields.indexOf(field)] || field
                  const isSorted = sortState?.field === field
                  const hasFilter = !!filterState[field]
                  return (
                    <th key={field} className="p-0 border-r min-w-[100px]" style={{ borderColor: 'var(--border)', background: hasFilter ? 'var(--accent-light)' : undefined }}>
                      <div className="flex flex-col">
                        <div
                          className="px-2 py-1.5 flex items-center justify-between cursor-pointer hover:bg-gray-200 select-none group"
                          onClick={() => setSortState((prev) => {
                            if (prev?.field !== field) return { field, dir: 'asc' }
                            if (prev.dir === 'asc') return { field, dir: 'desc' }
                            return null
                          })}
                        >
                          <span className="truncate text-[10px] font-medium" style={{ color: 'var(--text2)' }}>{label}</span>
                          <span className="ml-1">
                            {isSorted ? (
                              sortState!.dir === 'asc' ? <ArrowUp size={11} style={{ color: 'var(--accent)' }} /> : <ArrowDown size={11} style={{ color: 'var(--accent)' }} />
                            ) : (
                              <ArrowUpDown size={11} className="opacity-0 group-hover:opacity-100" style={{ color: 'var(--text3)' }} />
                            )}
                          </span>
                        </div>
                        <div className="px-1.5 pb-1.5">
                          <input
                            type="text"
                            placeholder="过滤..."
                            className="w-full text-[10px] px-1.5 py-0.5 border rounded outline-none"
                            style={{ borderColor: 'var(--border)' }}
                            value={filterState[field] || ''}
                            onChange={(e) => { setFilterState((prev) => ({ ...prev, [field]: e.target.value })); setCurrentPage(1) }}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                      </div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody className="divide-y text-xs" style={{ color: 'var(--text)' }}>
              {paginatedRows.length > 0 ? (
                paginatedRows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-blue-50 transition-colors">
                    {visibleFields.map((field) => (
                      <td key={field} className="px-2 py-1 border-r truncate max-w-[200px]" style={{ borderColor: 'var(--border)' }} title={row[field]}>
                        {row[field]}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={visibleFields.length} className="px-4 py-10 text-center text-xs" style={{ color: 'var(--text3)' }}>
                    无匹配数据
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* 过滤状态栏 */}
        {Object.values(filterState).some(Boolean) && (
          <div className="px-3 py-1.5 flex items-center justify-between text-xs shrink-0" style={{ background: 'var(--accent)', color: 'white' }}>
            <div className="flex items-center gap-2 overflow-hidden">
              <span className="font-bold opacity-80">过滤中:</span>
              {Object.entries(filterState).filter(([, v]) => v).map(([k, v]) => (
                <span key={k} className="bg-white/10 px-1.5 py-0.5 rounded text-[10px] whitespace-nowrap">
                  {currentRecord.labels[currentRecord.fields.indexOf(k)] || k}: {v}
                </span>
              ))}
              <span className="text-blue-200 ml-1">({processedRows.length} 条)</span>
            </div>
            <button onClick={() => setFilterState({})} className="bg-white text-blue-700 px-2 py-0.5 rounded font-bold text-[10px] hover:bg-blue-50 shrink-0 ml-2">
              重置
            </button>
          </div>
        )}

        {/* 分页栏 */}
        <div className="h-10 border-t flex items-center justify-between px-3 shrink-0" style={{ borderColor: 'var(--border)', background: '#f8fafc' }}>
          <div className="text-[10px] font-bold" style={{ color: 'var(--text3)' }}>
            <span style={{ color: 'var(--text)' }}>共 {currentRecord.rows.length}</span>
            {processedRows.length !== currentRecord.rows.length && (
              <span className="ml-1" style={{ color: 'var(--accent)' }}>/ 过滤后 {processedRows.length}</span>
            )}
            <span className="mx-2 opacity-30">|</span>
            {currentPage} / {totalPages} 页
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="w-6 h-6 flex items-center justify-center border rounded bg-white hover:bg-gray-100 disabled:opacity-30"
                style={{ borderColor: 'var(--border)' }}
              >
                <ChevronLeft size={14} />
              </button>

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
                    className={`w-6 h-6 flex items-center justify-center text-[10px] font-bold border rounded transition-all ${
                      p === currentPage ? 'text-white' : typeof p === 'number' ? 'bg-white hover:bg-gray-100' : 'cursor-default border-transparent'
                    }`}
                    style={{
                      background: p === currentPage ? 'var(--accent)' : undefined,
                      borderColor: p === currentPage ? 'var(--accent)' : 'var(--border)',
                      color: p === currentPage ? 'white' : typeof p === 'number' ? 'var(--text2)' : 'var(--text3)',
                    }}
                  >
                    {p}
                  </button>
                ))
              })()}

              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="w-6 h-6 flex items-center justify-center border rounded bg-white hover:bg-gray-100 disabled:opacity-30"
                style={{ borderColor: 'var(--border)' }}
              >
                <ArrowRight size={14} />
              </button>
            </div>

            <div className="flex items-center gap-1 ml-2">
              <span className="text-[9px] font-bold" style={{ color: 'var(--text3)' }}>每页</span>
              <select
                value={currentRecord.pageSize}
                onChange={(e) => { updateHistory({ ...currentRecord, pageSize: Number(e.target.value) }); setCurrentPage(1) }}
                className="text-[10px] font-bold border rounded px-1 py-0.5 outline-none bg-white cursor-pointer"
                style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
              >
                {[10, 20, 35, 50, 100].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
