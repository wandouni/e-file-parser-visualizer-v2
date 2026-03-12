'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, ChevronDown, ChevronRight, Save, BarChart2, X, Copy } from 'lucide-react'
import { Modal } from './Modal'
import { useApp } from '@/context/AppContext'
import { Chart } from 'react-chartjs-2'
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, Title, Tooltip, Legend, Filler,
} from 'chart.js'
import type { VizConfig, VizFilter } from '@/types'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler)

const COLORS = ['#1a6fd4', '#e05252', '#2ea043', '#f59e0b', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899']

interface Props { onClose: () => void }

export default function VizModal({ onClose }: Props) {
  const { histories, currentId, updateHistory, loadHistoryRows, activeCaseId } = useApp()
  const [sourceId, setSourceId] = useState('')
  const [configs, setConfigs] = useState<VizConfig[]>([])
  const [sidebarWidth, setSidebarWidth] = useState(340)
  const [isResizing, setIsResizing] = useState(false)
  const [previewData, setPreviewData] = useState<Record<string, any>>({})
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle')

  const sourceRecord = histories.find((h) => h.id === sourceId)

  // 初始化：确保 rows 已加载
  useEffect(() => {
    const id = currentId || (histories.length > 0 ? histories[0].id : '')
    setSourceId(id)
    const rec = histories.find((h) => h.id === id)
    if (rec) {
      setConfigs(rec.vizConfigs.length > 0 ? JSON.parse(JSON.stringify(rec.vizConfigs)) : [])
      // 如果 rows 为空，按需加载
      if (rec.rows.length === 0 && activeCaseId) loadHistoryRows(activeCaseId, id)
    }
    setSaveStatus('idle')
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // 切换数据源
  function handleSourceChange(newId: string) {
    setSourceId(newId)
    const rec = histories.find((h) => h.id === newId)
    setConfigs(rec?.vizConfigs.length ? JSON.parse(JSON.stringify(rec.vizConfigs)) : [])
    if (rec && rec.rows.length === 0 && activeCaseId) loadHistoryRows(activeCaseId, newId)
  }

  const updateConfig = (id: string, updates: Partial<VizConfig>) =>
    setConfigs((prev) => prev.map((c) => c.id === id ? { ...c, ...updates } : c))

  function handleAddChart() {
    setConfigs((prev) => [...prev, { id: Date.now().toString(), title: '新图表', type: 'bar', xField: '', yFields: [], filters: [], _collapsed: false }])
  }

  function handleDuplicate(id: string) {
    const orig = configs.find((c) => c.id === id)
    if (orig) setConfigs((prev) => [...prev, { ...JSON.parse(JSON.stringify(orig)), id: Date.now().toString(), title: `${orig.title} (副本)`, _collapsed: false }])
  }

  // 280ms 防抖生成图表数据
  useEffect(() => {
    if (!sourceRecord || sourceRecord.rows.length === 0) return
    const timer = setTimeout(() => {
      const newData: Record<string, any> = {}
      configs.forEach((cfg) => {
        if (!cfg.xField || cfg.yFields.length === 0) return
        let rows = sourceRecord.rows
        if (cfg.filters.length > 0) {
          rows = rows.filter((row) => cfg.filters.every((f) => {
            if (!f.field) return true
            const val = row[f.field]; const target = f.value
            const nv = parseFloat(val); const nt = parseFloat(target); const isNum = !isNaN(nv) && !isNaN(nt)
            switch (f.op) {
              case 'eq': return val === target
              case 'neq': return val !== target
              case 'gt': return isNum ? nv > nt : val > target
              case 'gte': return isNum ? nv >= nt : val >= target
              case 'lt': return isNum ? nv < nt : val < target
              case 'lte': return isNum ? nv <= nt : val <= target
              case 'contains': return val.toLowerCase().includes(target.toLowerCase())
              default: return true
            }
          }))
        }
        if (cfg.type === 'scatter') {
          newData[cfg.id] = {
            datasets: cfg.yFields.map((yf, i) => ({
              label: sourceRecord.labels[sourceRecord.fields.indexOf(yf)] || yf,
              data: rows.map((r) => ({ x: parseFloat(r[cfg.xField]) || 0, y: parseFloat(r[yf]) || 0 })),
              backgroundColor: COLORS[i % COLORS.length],
              borderColor: COLORS[i % COLORS.length],
              pointRadius: rows.length > 100 ? 0 : 4,
            })),
          }
        } else {
          newData[cfg.id] = {
            labels: rows.map((r) => r[cfg.xField]),
            datasets: cfg.yFields.map((yf, i) => ({
              label: sourceRecord.labels[sourceRecord.fields.indexOf(yf)] || yf,
              data: rows.map((r) => parseFloat(r[yf]) || 0),
              backgroundColor: cfg.type === 'area' ? `${COLORS[i % COLORS.length]}33` : COLORS[i % COLORS.length],
              borderColor: COLORS[i % COLORS.length],
              borderWidth: 1,
              fill: cfg.type === 'area',
              pointRadius: rows.length > 100 ? 0 : 3,
              tension: 0.1,
            })),
          }
        }
      })
      setPreviewData(newData)
    }, 280)
    return () => clearTimeout(timer)
  }, [configs, sourceRecord])

  // 拖拽分隔条
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (isResizing) setSidebarWidth((prev) => Math.max(200, Math.min(420, prev + e.movementX)))
    }
    const onUp = () => { setIsResizing(false); document.body.style.cursor = '' }
    if (isResizing) { document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp); document.body.style.cursor = 'col-resize' }
    return () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
  }, [isResizing])

  function handleSave() {
    if (!sourceRecord) return
    const valid = configs.filter((c) => c.xField && c.yFields.length > 0).map(({ _collapsed: _, ...rest }) => rest)
    updateHistory({ ...sourceRecord, vizConfigs: valid })
    setSaveStatus('saved')
    setTimeout(() => setSaveStatus('idle'), 1800)
  }

  function handleClose() {
    if (sourceRecord) {
      const valid = configs.filter((c) => c.xField && c.yFields.length > 0).map(({ _collapsed: _, ...rest }) => rest)
      if (valid.length > 0) updateHistory({ ...sourceRecord, vizConfigs: valid })
    }
    onClose()
  }

  function renderChart(cfg: VizConfig) {
    const data = previewData[cfg.id]
    if (!data) return <div className="flex items-center justify-center h-full text-xs" style={{ color: 'var(--text3)' }}>配置不完整或无数据</div>
    const chartType = cfg.type === 'area' ? 'line' : cfg.type
    const options: any = {
      responsive: true, maintainAspectRatio: false, animation: false,
      plugins: { title: { display: true, text: cfg.title, font: { size: 11 } }, legend: { position: 'top', labels: { font: { size: 10 } } } },
      scales: {
        x: { type: cfg.type === 'scatter' ? 'linear' : 'category', ticks: { maxTicksLimit: 20, maxRotation: 45, font: { size: 9 } } },
        y: { type: 'linear', ticks: { font: { size: 9 } } },
      },
    }
    return <Chart type={chartType as any} data={data} options={options} />
  }

  return (
    <Modal isOpen onClose={handleClose} title="数据可视化分析" width="1200px" height="92vh">
      <div className="flex flex-col h-full overflow-hidden bg-white">
        <div className="flex flex-1 overflow-hidden">
          {/* 左侧配置面板 */}
          <div className="flex flex-col border-r shrink-0" style={{ width: sidebarWidth, borderColor: 'var(--border)', background: '#f8fafc' }}>
            <div className="px-4 py-2 border-b flex justify-between items-center bg-white sticky top-0 z-10" style={{ borderColor: 'var(--border)' }}>
              <span className="text-[10px] font-medium" style={{ color: 'var(--text2)' }}>图表配置</span>
              <button onClick={handleSave}
                className={`flex items-center gap-1 px-3 py-1 text-[10px] font-medium rounded transition-all ${saveStatus === 'saved' ? 'bg-green-600 text-white' : 'text-white'}`}
                style={saveStatus !== 'saved' ? { background: 'var(--accent)' } : undefined}>
                <Save size={11} />{saveStatus === 'saved' ? '已保存' : '保存配置'}
              </button>
            </div>

            {/* 数据源选择 */}
            <div className="px-3 py-2 border-b" style={{ borderColor: 'var(--border)' }}>
              <select className="w-full border rounded-lg px-2 py-1.5 text-xs outline-none bg-white"
                style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
                value={sourceId} onChange={(e) => handleSourceChange(e.target.value)}>
                {histories.map((h) => <option key={h.id} value={h.id}>{h.sectionTag}</option>)}
              </select>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {configs.map((cfg) => (
                <div key={cfg.id} className={`bg-white border rounded-lg transition-all ${cfg._collapsed ? '' : 'border-blue-400'}`}
                  style={{ borderColor: cfg._collapsed ? 'var(--border)' : undefined }}>
                  {/* 卡片头 */}
                  <div className="flex items-center justify-between p-2 cursor-pointer hover:bg-gray-50 rounded-t-lg"
                    onClick={() => updateConfig(cfg.id, { _collapsed: !cfg._collapsed })}>
                    <div className="flex items-center gap-1.5 overflow-hidden">
                      {cfg._collapsed ? <ChevronRight size={11} /> : <ChevronDown size={11} />}
                      <span className="text-[11px] font-medium truncate" style={{ color: 'var(--text)' }}>{cfg.title || '未命名图表'}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={(e) => { e.stopPropagation(); handleDuplicate(cfg.id) }} className="p-1 rounded hover:bg-gray-100" style={{ color: 'var(--text3)' }}><Copy size={11} /></button>
                      <button onClick={(e) => { e.stopPropagation(); setConfigs((p) => p.filter((c) => c.id !== cfg.id)) }} className="p-1 rounded hover:bg-red-50" style={{ color: 'var(--text3)' }}><Trash2 size={11} /></button>
                    </div>
                  </div>

                  {/* 卡片体 */}
                  {!cfg._collapsed && (
                    <div className="p-3 border-t space-y-3" style={{ borderColor: 'var(--border)', background: '#f8fafc' }}>
                      <div>
                        <label className="text-[9px] font-medium block mb-1" style={{ color: 'var(--text2)' }}>图表标题</label>
                        <input className="w-full border rounded px-2 py-1 text-[11px] outline-none bg-white"
                          style={{ borderColor: 'var(--border)' }}
                          value={cfg.title} onChange={(e) => updateConfig(cfg.id, { title: e.target.value })} />
                      </div>
                      <div>
                        <label className="text-[9px] font-medium block mb-1" style={{ color: 'var(--text2)' }}>图表类型</label>
                        <div className="grid grid-cols-2 gap-1">
                          {(['bar', 'line', 'area', 'scatter'] as const).map((t) => (
                            <button key={t} onClick={() => updateConfig(cfg.id, { type: t })}
                              className={`py-1 text-[9px] font-medium border rounded transition-all ${cfg.type === t ? 'text-white' : 'bg-white hover:border-blue-400'}`}
                              style={cfg.type === t ? { background: 'var(--accent)', borderColor: 'var(--accent)' } : { borderColor: 'var(--border)', color: 'var(--text2)' }}>
                              {t === 'bar' ? '柱状' : t === 'line' ? '折线' : t === 'area' ? '面积' : '散点'}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="text-[9px] font-medium block mb-1" style={{ color: 'var(--text2)' }}>X 轴字段</label>
                        <select className="w-full border rounded px-2 py-1 text-[11px] outline-none bg-white"
                          style={{ borderColor: 'var(--border)' }}
                          value={cfg.xField} onChange={(e) => updateConfig(cfg.id, { xField: e.target.value })}>
                          <option value="">选择字段...</option>
                          {sourceRecord?.fields.map((f, i) => <option key={f} value={f}>{sourceRecord.labels[i] || f}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-[9px] font-medium block mb-1" style={{ color: 'var(--text2)' }}>Y 轴字段（多选）</label>
                        <div className="flex flex-wrap gap-1 mb-1">
                          {cfg.yFields.map((yf, i) => (
                            <span key={yf} className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium border"
                              style={{ background: 'var(--accent-light)', borderColor: 'var(--accent)', color: 'var(--accent)' }}>
                              <span className="w-2 h-2 rounded-full inline-block" style={{ background: COLORS[i % COLORS.length] }} />
                              {sourceRecord?.labels[sourceRecord.fields.indexOf(yf)] || yf}
                              <button onClick={() => updateConfig(cfg.id, { yFields: cfg.yFields.filter((y) => y !== yf) })} className="hover:text-red-600 ml-0.5"><X size={9} /></button>
                            </span>
                          ))}
                        </div>
                        <select className="w-full border rounded px-2 py-1 text-[11px] outline-none bg-white"
                          style={{ borderColor: 'var(--border)' }}
                          onChange={(e) => { if (e.target.value && !cfg.yFields.includes(e.target.value)) { updateConfig(cfg.id, { yFields: [...cfg.yFields, e.target.value] }) } e.target.value = '' }}>
                          <option value="">添加 Y 轴字段...</option>
                          {sourceRecord?.fields.map((f, i) => <option key={f} value={f}>{sourceRecord.labels[i] || f}</option>)}
                        </select>
                      </div>
                      {/* 过滤条件 */}
                      <div className="pt-2 border-t space-y-2" style={{ borderColor: 'var(--border)' }}>
                        <div className="flex justify-between items-center">
                          <label className="text-[9px] font-medium" style={{ color: 'var(--text2)' }}>数据过滤</label>
                          <button onClick={() => updateConfig(cfg.id, { filters: [...cfg.filters, { field: '', op: 'eq', value: '' }] })}
                            className="text-[9px] font-medium px-1.5 py-0.5 border rounded" style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}>+ 新增</button>
                        </div>
                        {cfg.filters.map((f, i) => (
                          <div key={i} className="flex gap-1 items-center bg-white p-1 border rounded" style={{ borderColor: 'var(--border)' }}>
                            <select className="text-[9px] border rounded px-1 py-0.5 w-16 outline-none" style={{ borderColor: 'var(--border)' }}
                              value={f.field} onChange={(e) => { const fs = cfg.filters.map((x, j) => j === i ? { ...x, field: e.target.value } : x); updateConfig(cfg.id, { filters: fs }) }}>
                              <option value="">字段</option>
                              {sourceRecord?.fields.map((field) => <option key={field} value={field}>{field}</option>)}
                            </select>
                            <select className="text-[9px] border rounded px-1 py-0.5 w-10 outline-none" style={{ borderColor: 'var(--border)' }}
                              value={f.op} onChange={(e) => { const fs = cfg.filters.map((x, j) => j === i ? { ...x, op: e.target.value as any } : x); updateConfig(cfg.id, { filters: fs }) }}>
                              <option value="eq">=</option><option value="neq">≠</option>
                              <option value="gt">&gt;</option><option value="gte">≥</option>
                              <option value="lt">&lt;</option><option value="lte">≤</option>
                              <option value="contains">含</option>
                            </select>
                            <input className="text-[9px] border rounded flex-1 min-w-0 px-1 py-0.5 outline-none" style={{ borderColor: 'var(--border)' }}
                              value={f.value} onChange={(e) => { const fs = cfg.filters.map((x, j) => j === i ? { ...x, value: e.target.value } : x); updateConfig(cfg.id, { filters: fs }) }} />
                            <button onClick={() => updateConfig(cfg.id, { filters: cfg.filters.filter((_, j) => j !== i) })}
                              className="p-0.5 hover:text-red-500" style={{ color: 'var(--text3)' }}><Trash2 size={10} /></button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              <button onClick={handleAddChart}
                className="w-full border-2 border-dashed rounded-lg p-4 flex flex-col items-center gap-2 hover:border-blue-400 hover:bg-blue-50 transition-all"
                style={{ borderColor: 'var(--border)', color: 'var(--text3)' }}>
                <Plus size={18} />
                <span className="text-[10px] font-medium">新增图表</span>
              </button>
            </div>
          </div>

          {/* 分隔条 */}
          <div className={`w-[3px] cursor-col-resize transition-colors ${isResizing ? 'bg-blue-500' : 'hover:bg-blue-400'}`}
            style={{ background: isResizing ? undefined : 'var(--border)' }}
            onMouseDown={() => setIsResizing(true)} />

          {/* 右侧预览面板 */}
          <div className="flex-1 flex flex-col min-w-0" style={{ background: '#f1f5f9' }}>
            <div className="px-4 py-2 border-b flex justify-between items-center shrink-0 bg-white" style={{ borderColor: 'var(--border)' }}>
              <span className="text-[10px] font-medium" style={{ color: 'var(--text2)' }}>预览画布</span>
              <span className="text-[9px] px-1.5 py-0.5 border rounded" style={{ borderColor: 'var(--border)', color: 'var(--text3)' }}>{configs.length} 个图表</span>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {configs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center" style={{ color: 'var(--text3)' }}>
                  <BarChart2 size={44} className="opacity-10 mb-3" />
                  <p className="text-xs">请在左侧添加并配置图表</p>
                </div>
              ) : (
                <div className={`grid gap-4 ${configs.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  {configs.map((cfg) => (
                    <div key={cfg.id} className="bg-white border rounded-lg p-4 h-[350px] hover:border-blue-400 transition-colors" style={{ borderColor: 'var(--border)' }}>
                      <div className="h-full">{renderChart(cfg)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  )
}
