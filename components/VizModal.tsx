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
  const { histories, currentId, updateHistory, loadHistoryRows, activeCaseId, showToast } = useApp()
  const [sourceId, setSourceId] = useState('')
  const [configs, setConfigs] = useState<VizConfig[]>([])
  const [sidebarWidth, setSidebarWidth] = useState(320)
  const [isResizing, setIsResizing] = useState(false)
  const [previewData, setPreviewData] = useState<Record<string, any>>({})
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle')

  const sourceRecord = histories.find((h) => h.id === sourceId)

  useEffect(() => {
    const id = currentId || (histories.length > 0 ? histories[0].id : '')
    setSourceId(id)
    const rec = histories.find((h) => h.id === id)
    if (rec) {
      setConfigs(rec.vizConfigs.length > 0 ? JSON.parse(JSON.stringify(rec.vizConfigs)) : [])
      if (rec.rows.length === 0 && activeCaseId) loadHistoryRows(activeCaseId, id)
    }
    setSaveStatus('idle')
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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

  // 图表数据计算：依赖 configs、sourceId 以及 rows 长度，确保 rows 加载后触发
  const rowCount = sourceRecord?.rows.length ?? 0
  useEffect(() => {
    if (!sourceRecord || rowCount === 0) return
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
    }, 120)
    return () => clearTimeout(timer)
  }, [configs, sourceId, rowCount]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (isResizing) setSidebarWidth((prev) => Math.max(220, Math.min(440, prev + e.movementX)))
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
    showToast('图表配置已保存')
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
    if (!data) return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 12, color: '#94a3b8' }}>
        配置不完整或无数据
      </div>
    )
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

  const ipt = { border: '1px solid #e2e8f0', borderRadius: 6, padding: '5px 8px', fontSize: 11, outline: 'none', background: '#fff', color: '#0f172a', width: '100%', boxSizing: 'border-box' } as React.CSSProperties
  const lbl = { fontSize: 10, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 } as React.CSSProperties

  return (
    <Modal isOpen onClose={handleClose} title="数据可视化分析" width="1200px" height="92vh">
      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden', background: '#fff' }}>

        {/* 左侧配置面板：position:relative + 内部 absolute inset:0 是让嵌套 flex 滚动最可靠的方式 */}
        <div style={{ width: sidebarWidth, flexShrink: 0, position: 'relative', borderRight: '1px solid #e2e8f0', background: '#f8fafc' }}>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* 面板标题栏 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid #e2e8f0', background: '#fff', flexShrink: 0 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#475569' }}>图表配置</span>
            <button
              onClick={handleSave}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', fontSize: 11, fontWeight: 600, border: 'none', borderRadius: 5, cursor: 'pointer', background: saveStatus === 'saved' ? '#16a34a' : '#2563eb', color: '#fff', transition: 'background 0.2s' }}
            >
              <Save size={11} />{saveStatus === 'saved' ? '已保存' : '保存配置'}
            </button>
          </div>

          {/* 数据源选择 */}
          <div style={{ padding: '8px 12px', borderBottom: '1px solid #e2e8f0', flexShrink: 0 }}>
            <select style={ipt} value={sourceId} onChange={(e) => handleSourceChange(e.target.value)}>
              {histories.map((h) => <option key={h.id} value={h.id}>{h.sectionTag}</option>)}
            </select>
          </div>

          {/* 图表卡片列表 */}
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {configs.map((cfg) => (
              <div key={cfg.id} style={{ background: '#fff', border: `1px solid ${cfg._collapsed ? '#e2e8f0' : '#2563eb'}`, borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>

                {/* 卡片标题行 */}
                <div
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', cursor: 'pointer', userSelect: 'none' }}
                  onClick={() => updateConfig(cfg.id, { _collapsed: !cfg._collapsed })}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                    {cfg._collapsed ? <ChevronRight size={12} color="#94a3b8" /> : <ChevronDown size={12} color="#2563eb" />}
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cfg.title || '未命名图表'}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                    <button onClick={(e) => { e.stopPropagation(); handleDuplicate(cfg.id) }}
                      style={{ padding: 4, border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center', borderRadius: 4 }}>
                      <Copy size={11} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setConfigs((p) => p.filter((c) => c.id !== cfg.id)) }}
                      style={{ padding: 4, border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center', borderRadius: 4 }}>
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>

                {/* 卡片内容 */}
                {!cfg._collapsed && (
                  <div style={{ padding: '10px 10px 12px', borderTop: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: 10 }}>

                    {/* 标题 */}
                    <div>
                      <label style={lbl}>图表标题</label>
                      <input style={ipt} value={cfg.title} onChange={(e) => updateConfig(cfg.id, { title: e.target.value })} />
                    </div>

                    {/* 类型 */}
                    <div>
                      <label style={lbl}>图表类型</label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                        {(['bar', 'line', 'area', 'scatter'] as const).map((t) => (
                          <button key={t} onClick={() => updateConfig(cfg.id, { type: t })}
                            style={{ padding: '5px 0', fontSize: 11, fontWeight: 600, border: `1px solid ${cfg.type === t ? '#2563eb' : '#e2e8f0'}`, borderRadius: 5, cursor: 'pointer', background: cfg.type === t ? '#2563eb' : '#fff', color: cfg.type === t ? '#fff' : '#475569', transition: 'all 0.12s' }}>
                            {t === 'bar' ? '柱状' : t === 'line' ? '折线' : t === 'area' ? '面积' : '散点'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* X轴 */}
                    <div>
                      <label style={lbl}>X 轴字段</label>
                      <select style={ipt} value={cfg.xField} onChange={(e) => updateConfig(cfg.id, { xField: e.target.value })}>
                        <option value="">选择字段...</option>
                        {sourceRecord?.fields.map((f, i) => <option key={f} value={f}>{sourceRecord.labels[i] || f}</option>)}
                      </select>
                    </div>

                    {/* Y轴 */}
                    <div>
                      <label style={lbl}>Y 轴字段（多选）</label>
                      {cfg.yFields.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
                          {cfg.yFields.map((yf, i) => (
                            <span key={yf} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 7px', borderRadius: 4, fontSize: 10, fontWeight: 600, background: '#eff6ff', border: '1px solid #2563eb', color: '#2563eb' }}>
                              <span style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS[i % COLORS.length], display: 'inline-block', flexShrink: 0 }} />
                              {sourceRecord?.labels[sourceRecord.fields.indexOf(yf)] || yf}
                              <button onClick={() => updateConfig(cfg.id, { yFields: cfg.yFields.filter((y) => y !== yf) })}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2563eb', padding: 0, display: 'flex', alignItems: 'center', marginLeft: 2 }}>
                                <X size={9} />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                      <select style={ipt}
                        onChange={(e) => { if (e.target.value && !cfg.yFields.includes(e.target.value)) { updateConfig(cfg.id, { yFields: [...cfg.yFields, e.target.value] }) } e.target.value = '' }}>
                        <option value="">添加 Y 轴字段...</option>
                        {sourceRecord?.fields.map((f, i) => <option key={f} value={f}>{sourceRecord.labels[i] || f}</option>)}
                      </select>
                    </div>

                    {/* 过滤条件 */}
                    <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <label style={{ ...lbl, marginBottom: 0 }}>数据过滤</label>
                        <button onClick={() => updateConfig(cfg.id, { filters: [...cfg.filters, { field: '', op: 'eq', value: '' }] })}
                          style={{ fontSize: 10, fontWeight: 600, color: '#2563eb', border: '1px solid #2563eb', borderRadius: 4, padding: '2px 7px', background: 'none', cursor: 'pointer' }}>
                          + 新增
                        </button>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {cfg.filters.map((f, i) => (
                          <div key={i} style={{ display: 'flex', gap: 3, alignItems: 'center', background: '#fff', padding: 5, border: '1px solid #e2e8f0', borderRadius: 5 }}>
                            <select style={{ fontSize: 10, border: '1px solid #e2e8f0', borderRadius: 4, padding: '3px 4px', outline: 'none', width: 70, background: '#fff', color: '#0f172a' }}
                              value={f.field} onChange={(e) => { const fs = cfg.filters.map((x, j) => j === i ? { ...x, field: e.target.value } : x); updateConfig(cfg.id, { filters: fs }) }}>
                              <option value="">字段</option>
                              {sourceRecord?.fields.map((field) => <option key={field} value={field}>{field}</option>)}
                            </select>
                            <select style={{ fontSize: 10, border: '1px solid #e2e8f0', borderRadius: 4, padding: '3px 2px', outline: 'none', width: 42, background: '#fff', color: '#0f172a' }}
                              value={f.op} onChange={(e) => { const fs = cfg.filters.map((x, j) => j === i ? { ...x, op: e.target.value as any } : x); updateConfig(cfg.id, { filters: fs }) }}>
                              <option value="eq">=</option><option value="neq">≠</option>
                              <option value="gt">&gt;</option><option value="gte">≥</option>
                              <option value="lt">&lt;</option><option value="lte">≤</option>
                              <option value="contains">含</option>
                            </select>
                            <input style={{ fontSize: 10, border: '1px solid #e2e8f0', borderRadius: 4, padding: '3px 5px', outline: 'none', flex: 1, minWidth: 0, background: '#fff', color: '#0f172a' }}
                              value={f.value} onChange={(e) => { const fs = cfg.filters.map((x, j) => j === i ? { ...x, value: e.target.value } : x); updateConfig(cfg.id, { filters: fs }) }} />
                            <button onClick={() => updateConfig(cfg.id, { filters: cfg.filters.filter((_, j) => j !== i) })}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                              <Trash2 size={10} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}

          </div>

          {/* 新增图表按钮 — 固定在底部 */}
          <div style={{ padding: '10px 12px', borderTop: '1px solid #e2e8f0', background: '#f8fafc', flexShrink: 0 }}>
            <button onClick={handleAddChart}
              style={{ border: '2px dashed #e2e8f0', borderRadius: 8, padding: '12px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, cursor: 'pointer', background: 'none', color: '#94a3b8', transition: 'border-color 0.15s', width: '100%' }}>
              <Plus size={18} />
              <span style={{ fontSize: 11, fontWeight: 600 }}>新增图表</span>
            </button>
          </div>
          </div>
        </div>

        {/* 拖拽分隔条 */}
        <div
          style={{ width: 4, cursor: 'col-resize', background: isResizing ? '#2563eb' : '#e2e8f0', flexShrink: 0, transition: 'background 0.15s' }}
          onMouseDown={() => setIsResizing(true)}
        />

        {/* 右侧预览画布 */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: '#f1f5f9', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', borderBottom: '1px solid #e2e8f0', background: '#fff', flexShrink: 0 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#475569' }}>预览画布</span>
            <span style={{ fontSize: 10, padding: '2px 8px', border: '1px solid #e2e8f0', borderRadius: 4, color: '#94a3b8' }}>{configs.length} 个图表</span>
          </div>
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', padding: 16 }}>
            {configs.length === 0 ? (
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', gap: 10 }}>
                <BarChart2 size={44} style={{ opacity: 0.1 }} />
                <p style={{ fontSize: 12 }}>请在左侧添加并配置图表</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14 }}>
                {configs.map((cfg) => (
                  <div key={cfg.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 14, height: 320, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    <div style={{ flex: 1, minHeight: 0, minWidth: 0 }}>{renderChart(cfg)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}
