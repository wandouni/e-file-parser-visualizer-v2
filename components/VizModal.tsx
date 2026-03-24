'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { Plus, Trash2, ChevronDown, ChevronRight, ChevronLeft, Save, BarChart2, X, Copy } from 'lucide-react'
import { Modal } from './Modal'
import { useApp } from '@/context/AppContext'
import { Chart } from 'react-chartjs-2'
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, Title, Tooltip, Legend, Filler,
} from 'chart.js'
import type { VizConfig, VizFilter, MultiSubjectConfig } from '@/types'
import { FilterValuePicker } from './FilterValuePicker'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler)

const COLORS = [
  '#1a6fd4', '#e05252', '#2ea043', '#f59e0b', '#8b5cf6',
  '#06b6d4', '#f97316', '#ec4899', '#10b981', '#6366f1',
  '#84cc16', '#fb923c', '#a78bfa', '#34d399', '#60a5fa',
]

const SUBJECT_PAGE_SIZE = 10

const DEFAULT_MULTI: MultiSubjectConfig = {
  keyField: '', xField: '', yFields: [], chartType: 'line',
  xAxisType: 'category', totalRule: 'sum', totalWeightField: '', checkedSubjects: [],
}

interface Props { onClose: () => void }

export default function VizModal({ onClose }: Props) {
  const { histories, currentId, updateHistory, loadHistoryRows, activeCaseId, showToast } = useApp()

  // ── Shared state ──────────────────────────────────────────────────────
  const [sourceId, setSourceId] = useState('')
  const [sidebarWidth, setSidebarWidth] = useState(320)
  const [isResizing, setIsResizing] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle')
  const [activeTab, setActiveTab] = useState<'charts' | 'multi'>('charts')

  // ── 图表配置 tab state ────────────────────────────────────────────────
  const [configs, setConfigs] = useState<VizConfig[]>([])
  const [previewData, setPreviewData] = useState<Record<string, any>>({})

  // ── 多主体分析 tab state ──────────────────────────────────────────────
  const [multiCfg, setMultiCfg] = useState<MultiSubjectConfig>(DEFAULT_MULTI)
  const [subjectSearch, setSubjectSearch] = useState('')
  const [subjectPage, setSubjectPage] = useState(1)
  const [subjectSelectMode, setSubjectSelectMode] = useState<'multi' | 'single'>('multi')
  const [multiPreviewData, setMultiPreviewData] = useState<{ main: any | null; total: any | null } | null>(null)

  const sourceRecord = histories.find((h) => h.id === sourceId)
  const rowCount = sourceRecord?.rows.length ?? 0

  // ── Init on open ──────────────────────────────────────────────────────
  useEffect(() => {
    const id = currentId || (histories.length > 0 ? histories[0].id : '')
    setSourceId(id)
    const rec = histories.find((h) => h.id === id)
    if (rec) {
      setConfigs(rec.vizConfigs.length > 0 ? JSON.parse(JSON.stringify(rec.vizConfigs)) : [])
      setMultiCfg(rec.multiSubjectConfig ? JSON.parse(JSON.stringify(rec.multiSubjectConfig)) : DEFAULT_MULTI)
      if (rec.rows.length === 0 && activeCaseId) loadHistoryRows(activeCaseId, id)
    }
    setSaveStatus('idle')
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleSourceChange(newId: string) {
    setSourceId(newId)
    const rec = histories.find((h) => h.id === newId)
    setConfigs(rec?.vizConfigs.length ? JSON.parse(JSON.stringify(rec.vizConfigs)) : [])
    setMultiCfg(rec?.multiSubjectConfig ? JSON.parse(JSON.stringify(rec.multiSubjectConfig)) : DEFAULT_MULTI)
    setSubjectSearch('')
    setSubjectPage(1)
    if (rec && rec.rows.length === 0 && activeCaseId) loadHistoryRows(activeCaseId, newId)
  }

  // ── Distinct values for viz filters ───────────────────────────────────
  const allDistinctValues = useMemo(() => {
    if (!sourceRecord || sourceRecord.rows.length === 0) return {} as Record<string, string[]>
    const result: Record<string, string[]> = {}
    for (const field of sourceRecord.fields) {
      const seen = new Set<string>()
      for (const row of sourceRecord.rows) seen.add(String(row[field] ?? ''))
      result[field] = [...seen].sort((a, b) => {
        const na = parseFloat(a), nb = parseFloat(b)
        if (!isNaN(na) && !isNaN(nb)) return na - nb
        return a.localeCompare(b, 'zh')
      })
    }
    return result
  }, [sourceId, rowCount]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── All subjects from keyField ─────────────────────────────────────────
  const allSubjects = useMemo(() => {
    if (!sourceRecord || !multiCfg.keyField || sourceRecord.rows.length === 0) return []
    const seen = new Set<string>()
    for (const row of sourceRecord.rows) {
      const v = row[multiCfg.keyField]
      if (v != null && v !== '') seen.add(v)
    }
    return [...seen].sort((a, b) => {
      const na = parseFloat(a), nb = parseFloat(b)
      if (!isNaN(na) && !isNaN(nb)) return na - nb
      return a.localeCompare(b, 'zh')
    })
  }, [sourceId, rowCount, multiCfg.keyField]) // eslint-disable-line react-hooks/exhaustive-deps

  // Default-select first 5 subjects when keyField is first set / subjects load
  useEffect(() => {
    if (allSubjects.length > 0 && multiCfg.checkedSubjects.length === 0) {
      setMultiCfg((prev) => ({
        ...prev,
        checkedSubjects: ['__total__', ...allSubjects.slice(0, 5)],
      }))
    }
  }, [allSubjects]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── 图表配置 chart data ───────────────────────────────────────────────
  const updateConfig = (id: string, updates: Partial<VizConfig>) =>
    setConfigs((prev) => prev.map((c) => c.id === id ? { ...c, ...updates } : c))

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

  // ── 多主体分析 chart data ─────────────────────────────────────────────
  useEffect(() => {
    if (!sourceRecord || rowCount === 0) { setMultiPreviewData(null); return }
    const { keyField, xField, yFields, chartType, xAxisType, totalRule, totalWeightField, checkedSubjects } = multiCfg
    if (!keyField || !xField || yFields.length === 0 || checkedSubjects.length === 0) {
      setMultiPreviewData(null); return
    }

    const timer = setTimeout(() => {
      const allRows = sourceRecord.rows
      const isScatter = chartType === 'scatter'

      // Sorted unique X values (for non-scatter)
      const xVals = isScatter ? [] : [...new Set(allRows.map((r) => r[xField]))].sort((a, b) => {
        const na = parseFloat(a), nb = parseFloat(b)
        if (!isNaN(na) && !isNaN(nb)) return na - nb
        return a.localeCompare(b, 'zh')
      })

      const nonTotalSubjects = checkedSubjects.filter((s) => s !== '__total__')
      const showTotal = checkedSubjects.includes('__total__')

      function getLabel(yField: string) {
        return sourceRecord!.labels[sourceRecord!.fields.indexOf(yField)] || yField
      }

      function makeDataset(label: string, data: any[], colorIdx: number, isTotalLine?: boolean) {
        const color = COLORS[colorIdx % COLORS.length]
        const base = {
          label,
          data,
          borderColor: color,
          backgroundColor: chartType === 'area' ? `${color}33` : color,
          borderWidth: isTotalLine ? 2.5 : 1.5,
          borderDash: isTotalLine ? [6, 3] : [],
          fill: chartType === 'area',
          pointRadius: (isScatter ? allRows.length : xVals.length) > 100 ? 0 : 3,
          tension: 0.1,
          spanGaps: true,
        }
        return base
      }

      // ── Main chart: non-total subjects, all Y fields combined ──────────
      let mainChartData: any = null
      if (nonTotalSubjects.length > 0) {
        const datasets: any[] = []
        let ci = 0
        for (const subject of nonTotalSubjects) {
          const subjectRows = allRows.filter((r) => r[keyField] === subject)
          for (const yf of yFields) {
            const yLbl = getLabel(yf)
            const label = yFields.length > 1 ? `${subject} · ${yLbl}` : subject
            if (isScatter) {
              datasets.push({
                ...makeDataset(label, subjectRows.map((r) => ({
                  x: parseFloat(r[xField]) || 0, y: parseFloat(r[yf]) || 0,
                })), ci),
              })
            } else {
              // Group by xField (average if multiple per x)
              const byX = new Map<string, number[]>()
              for (const r of subjectRows) {
                if (!byX.has(r[xField])) byX.set(r[xField], [])
                byX.get(r[xField])!.push(parseFloat(r[yf]) || 0)
              }
              datasets.push(makeDataset(label, xVals.map((x) => {
                const vals = byX.get(x)
                return vals ? vals.reduce((a, b) => a + b, 0) / vals.length : null
              }), ci))
            }
            ci++
          }
        }
        mainChartData = isScatter ? { datasets } : { labels: xVals, datasets }
      }

      // ── Total chart: 总加 for each Y field ────────────────────────────
      let totalChartData: any = null
      if (showTotal) {
        const datasets: any[] = []
        for (let yi = 0; yi < yFields.length; yi++) {
          const yf = yFields[yi]
          const label = yFields.length > 1 ? `总加 · ${getLabel(yf)}` : '总加'
          if (isScatter) {
            datasets.push(makeDataset(label, allRows.map((r) => ({
              x: parseFloat(r[xField]) || 0, y: parseFloat(r[yf]) || 0,
            })), yi, true))
          } else {
            // Group by xField and aggregate
            const groups = new Map<string, number[]>()
            const wGroups = totalRule === 'weighted_mean' ? new Map<string, number[]>() : null
            for (const r of allRows) {
              const xv = r[xField]; if (!xv) continue
              if (!groups.has(xv)) groups.set(xv, [])
              groups.get(xv)!.push(parseFloat(r[yf]) || 0)
              if (wGroups) {
                if (!wGroups.has(xv)) wGroups.set(xv, [])
                wGroups.get(xv)!.push(parseFloat(r[totalWeightField]) || 0)
              }
            }
            const data = xVals.map((x) => {
              const ys = groups.get(x); if (!ys || ys.length === 0) return null
              if (totalRule === 'sum') return ys.reduce((a, b) => a + b, 0)
              if (totalRule === 'mean') return ys.reduce((a, b) => a + b, 0) / ys.length
              if (totalRule === 'weighted_mean' && wGroups) {
                const ws = wGroups.get(x) ?? []
                const sw = ws.reduce((a, b) => a + b, 0)
                return sw === 0 ? null : ys.reduce((s, y, i) => s + y * ws[i], 0) / sw
              }
              return null
            })
            datasets.push(makeDataset(label, data, yi, true))
          }
        }
        totalChartData = isScatter ? { datasets } : { labels: xVals, datasets }
      }

      setMultiPreviewData({ main: mainChartData, total: totalChartData })
    }, 200)

    return () => clearTimeout(timer)
  }, [multiCfg, sourceId, rowCount]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Resize ────────────────────────────────────────────────────────────
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (isResizing) setSidebarWidth((prev) => Math.max(240, Math.min(460, prev + e.movementX)))
    }
    const onUp = () => { setIsResizing(false); document.body.style.cursor = '' }
    if (isResizing) { document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp); document.body.style.cursor = 'col-resize' }
    return () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
  }, [isResizing])

  // ── Save ──────────────────────────────────────────────────────────────
  function handleSave() {
    if (!sourceRecord) return
    const valid = configs.filter((c) => c.xField && c.yFields.length > 0).map(({ _collapsed: _, ...rest }) => rest)
    updateHistory({ ...sourceRecord, vizConfigs: valid, multiSubjectConfig: multiCfg })
    setSaveStatus('saved')
    setTimeout(() => setSaveStatus('idle'), 1800)
    showToast('配置已保存')
  }

  function handleClose() {
    if (sourceRecord) {
      const valid = configs.filter((c) => c.xField && c.yFields.length > 0).map(({ _collapsed: _, ...rest }) => rest)
      if (valid.length > 0 || multiCfg.keyField) {
        updateHistory({ ...sourceRecord, vizConfigs: valid, multiSubjectConfig: multiCfg })
      }
    }
    onClose()
  }

  // ── Styles ────────────────────────────────────────────────────────────
  const ipt = { border: '1px solid #e2e8f0', borderRadius: 6, padding: '5px 8px', fontSize: 11, outline: 'none', background: '#fff', color: '#0f172a', width: '100%', boxSizing: 'border-box' } as React.CSSProperties
  const lbl = { fontSize: 10, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 } as React.CSSProperties
  const typeBtn = (active: boolean) => ({
    padding: '5px 0', fontSize: 11, fontWeight: 600,
    border: `1px solid ${active ? '#2563eb' : '#e2e8f0'}`,
    borderRadius: 5, cursor: 'pointer',
    background: active ? '#2563eb' : '#fff',
    color: active ? '#fff' : '#475569',
    transition: 'all 0.12s',
  } as React.CSSProperties)

  // ── Subject list helpers ───────────────────────────────────────────────
  const filteredSubjects = useMemo(() => {
    if (!subjectSearch) return allSubjects
    const q = subjectSearch.toLowerCase()
    return allSubjects.filter((s) => s.toLowerCase().includes(q))
  }, [allSubjects, subjectSearch])

  const totalSubjectPages = Math.max(1, Math.ceil(filteredSubjects.length / SUBJECT_PAGE_SIZE))
  const pageSubjects = filteredSubjects.slice((subjectPage - 1) * SUBJECT_PAGE_SIZE, subjectPage * SUBJECT_PAGE_SIZE)

  function isSubjectChecked(s: string) { return multiCfg.checkedSubjects.includes(s) }
  function toggleSubject(s: string) {
    setMultiCfg((prev) => {
      const has = prev.checkedSubjects.includes(s)
      // 总加行始终走复选逻辑
      if (s === '__total__') {
        return { ...prev, checkedSubjects: has ? prev.checkedSubjects.filter((x) => x !== s) : [...prev.checkedSubjects, s] }
      }
      if (subjectSelectMode === 'single') {
        // 单选：保留总加状态，仅保留当前点击的主体（再次点击则取消选中）
        const keepTotal = prev.checkedSubjects.includes('__total__') ? ['__total__'] : []
        return { ...prev, checkedSubjects: has ? keepTotal : [...keepTotal, s] }
      }
      return { ...prev, checkedSubjects: has ? prev.checkedSubjects.filter((x) => x !== s) : [...prev.checkedSubjects, s] }
    })
  }

  // ── Chart renderers ───────────────────────────────────────────────────
  function renderVizChart(cfg: VizConfig) {
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

  function getMultiOptions() {
    const xType = multiCfg.chartType === 'scatter' ? 'linear' : multiCfg.xAxisType
    return {
      responsive: true, maintainAspectRatio: false, animation: false,
      interaction: { mode: 'index' as const, intersect: false },
      plugins: {
        title: { display: false },
        legend: { display: false },   // custom scrollable legend rendered in JSX
      },
      scales: {
        x: { type: xType as any, ticks: { maxTicksLimit: 20, maxRotation: 45, font: { size: 9 } } },
        y: { type: 'linear' as any, ticks: { font: { size: 9 } } },
      },
    }
  }

  const multiChartType = multiCfg.chartType === 'area' ? 'line' : multiCfg.chartType

  function renderMultiChart(
    data: any,
    title: string,
    height: number,
    cardStyle?: React.CSSProperties
  ) {
    const isBar = multiCfg.chartType === 'bar'
    return (
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 14, height, display: 'flex', flexDirection: 'column', minWidth: 0, ...cardStyle }}>
        {/* Title */}
        <div style={{ fontSize: 11, fontWeight: 700, color: '#334155', marginBottom: 5, flexShrink: 0 }}>{title}</div>

        {/* Custom legend — wraps but is capped and scrollable */}
        <div style={{
          maxHeight: 52, overflowY: 'auto', overflowX: 'hidden',
          display: 'flex', flexWrap: 'wrap', gap: '3px 14px',
          marginBottom: 7, flexShrink: 0, paddingRight: 2,
        }}>
          {data.datasets.map((ds: any, i: number) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: '#475569', whiteSpace: 'nowrap' }}>
              {isBar
                ? <span style={{ width: 10, height: 10, borderRadius: 2, background: ds.backgroundColor, display: 'inline-block', flexShrink: 0 }} />
                : <span style={{ width: 18, height: 2.5, background: ds.borderColor, display: 'inline-block', borderRadius: 2, flexShrink: 0 }} />
              }
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 140 }}>{ds.label}</span>
            </div>
          ))}
        </div>

        {/* Chart */}
        <div style={{ flex: 1, minHeight: 0, minWidth: 0 }}>
          <Chart type={multiChartType as any} data={data} options={getMultiOptions()} />
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════
  return (
    <Modal isOpen onClose={handleClose} title="数据可视化分析" width="1200px" height="92vh">
      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden', background: '#fff' }}>

        {/* ── 左侧面板 ── */}
        <div style={{ width: sidebarWidth, flexShrink: 0, position: 'relative', borderRight: '1px solid #e2e8f0', background: '#f8fafc' }}>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

            {/* 标题栏 + 保存 */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid #e2e8f0', background: '#fff', flexShrink: 0 }}>
              {/* Tab switcher */}
              <div style={{ display: 'flex', gap: 2, background: '#f1f5f9', borderRadius: 6, padding: 2 }}>
                {(['charts', 'multi'] as const).map((t) => {
                  const hasDot = t === 'charts'
                    ? configs.some((c) => c.xField && c.yFields.length > 0)
                    : !!multiCfg.keyField
                  return (
                    <button key={t} onClick={() => setActiveTab(t)} style={{
                      position: 'relative', padding: '4px 10px', fontSize: 11, fontWeight: 600, border: 'none', borderRadius: 5,
                      cursor: 'pointer', transition: 'all 0.15s',
                      background: activeTab === t ? '#fff' : 'transparent',
                      color: activeTab === t ? '#0f172a' : '#94a3b8',
                      boxShadow: activeTab === t ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    }}>
                      {t === 'charts' ? '图表配置' : '多主体分析'}
                      {hasDot && (
                        <span style={{ position: 'absolute', top: 2, right: 2, width: 5, height: 5, borderRadius: '50%', background: '#ef4444', border: '1px solid #f1f5f9' }} />
                      )}
                    </button>
                  )
                })}
              </div>
              <button onClick={handleSave} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', fontSize: 11, fontWeight: 600, border: 'none', borderRadius: 5, cursor: 'pointer', background: saveStatus === 'saved' ? '#16a34a' : '#2563eb', color: '#fff', transition: 'background 0.2s' }}>
                <Save size={11} />{saveStatus === 'saved' ? '已保存' : '保存'}
              </button>
            </div>

            {/* 数据源 */}
            <div style={{ padding: '8px 12px', borderBottom: '1px solid #e2e8f0', flexShrink: 0 }}>
              <select style={ipt} value={sourceId} onChange={(e) => handleSourceChange(e.target.value)}>
                {histories.map((h) => <option key={h.id} value={h.id}>{h.sectionTag}</option>)}
              </select>
            </div>

            {/* ── Tab content ── */}
            {activeTab === 'charts' ? (
              <>
                {/* 图表卡片列表 */}
                <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {configs.map((cfg) => (
                    <div key={cfg.id} style={{ background: '#fff', border: `1px solid ${cfg._collapsed ? '#e2e8f0' : '#2563eb'}`, borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', cursor: 'pointer', userSelect: 'none' }}
                        onClick={() => updateConfig(cfg.id, { _collapsed: !cfg._collapsed })}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                          {cfg._collapsed ? <ChevronRight size={12} color="#94a3b8" /> : <ChevronDown size={12} color="#2563eb" />}
                          <span style={{ fontSize: 11, fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cfg.title || '未命名图表'}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                          <button onClick={(e) => { e.stopPropagation(); const orig = configs.find((c) => c.id === cfg.id); if (orig) setConfigs((p) => [...p, { ...JSON.parse(JSON.stringify(orig)), id: Date.now().toString(), title: `${orig.title} (副本)`, _collapsed: false }]) }}
                            style={{ padding: 4, border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center', borderRadius: 4 }}>
                            <Copy size={11} />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); setConfigs((p) => p.filter((c) => c.id !== cfg.id)) }}
                            style={{ padding: 4, border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center', borderRadius: 4 }}>
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>

                      {!cfg._collapsed && (
                        <div style={{ padding: '10px 10px 12px', borderTop: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: 10 }}>
                          <div><label style={lbl}>图表标题</label><input style={ipt} value={cfg.title} onChange={(e) => updateConfig(cfg.id, { title: e.target.value })} /></div>
                          <div>
                            <label style={lbl}>图表类型</label>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                              {(['bar', 'line', 'area', 'scatter'] as const).map((t) => (
                                <button key={t} onClick={() => updateConfig(cfg.id, { type: t })} style={typeBtn(cfg.type === t)}>
                                  {t === 'bar' ? '柱状' : t === 'line' ? '折线' : t === 'area' ? '面积' : '散点'}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div>
                            <label style={lbl}>X 轴字段</label>
                            <select style={ipt} value={cfg.xField} onChange={(e) => updateConfig(cfg.id, { xField: e.target.value })}>
                              <option value="">选择字段...</option>
                              {sourceRecord?.fields.map((f, i) => <option key={f} value={f}>{sourceRecord.labels[i] || f}</option>)}
                            </select>
                          </div>
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
                            <select style={ipt} onChange={(e) => { if (e.target.value && !cfg.yFields.includes(e.target.value)) updateConfig(cfg.id, { yFields: [...cfg.yFields, e.target.value] }); e.target.value = '' }}>
                              <option value="">添加 Y 轴字段...</option>
                              {sourceRecord?.fields.map((f, i) => <option key={f} value={f}>{sourceRecord.labels[i] || f}</option>)}
                            </select>
                          </div>

                          {/* 数据过滤 */}
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
                                    value={f.field} onChange={(e) => { const fs = cfg.filters.map((x, j) => j === i ? { ...x, field: e.target.value, value: '' } : x); updateConfig(cfg.id, { filters: fs }) }}>
                                    <option value="">字段</option>
                                    {sourceRecord?.fields.map((field, fi) => <option key={field} value={field}>{sourceRecord.labels[fi] || field}</option>)}
                                  </select>
                                  <select style={{ fontSize: 10, border: '1px solid #e2e8f0', borderRadius: 4, padding: '3px 2px', outline: 'none', width: 42, background: '#fff', color: '#0f172a' }}
                                    value={f.op} onChange={(e) => { const fs = cfg.filters.map((x, j) => j === i ? { ...x, op: e.target.value as any } : x); updateConfig(cfg.id, { filters: fs }) }}>
                                    <option value="eq">=</option><option value="neq">≠</option>
                                    <option value="gt">&gt;</option><option value="gte">≥</option>
                                    <option value="lt">&lt;</option><option value="lte">≤</option>
                                    <option value="contains">含</option>
                                  </select>
                                  <FilterValuePicker
                                    value={f.value}
                                    onChange={(v) => { const fs = cfg.filters.map((x, j) => j === i ? { ...x, value: v } : x); updateConfig(cfg.id, { filters: fs }) }}
                                    distinctValues={f.field ? (allDistinctValues[f.field] ?? []) : []}
                                    style={{ flex: 1, minWidth: 0 }}
                                  />
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

                {/* 新增图表按钮 */}
                <div style={{ padding: '10px 12px', borderTop: '1px solid #e2e8f0', background: '#f8fafc', flexShrink: 0 }}>
                  <button onClick={() => setConfigs((prev) => [...prev, { id: Date.now().toString(), title: '新图表', type: 'bar', xField: '', yFields: [], filters: [], _collapsed: false }])}
                    style={{ border: '2px dashed #e2e8f0', borderRadius: 8, padding: '12px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, cursor: 'pointer', background: 'none', color: '#94a3b8', width: '100%' }}>
                    <Plus size={18} />
                    <span style={{ fontSize: 11, fontWeight: 600 }}>新增图表</span>
                  </button>
                </div>
              </>
            ) : (
              /* ── 多主体分析 tab ── */
              <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 12 }}>

                {/* 主体列 */}
                <div>
                  <label style={lbl}>主体列</label>
                  <select style={ipt} value={multiCfg.keyField}
                    onChange={(e) => {
                      setMultiCfg((prev) => ({ ...prev, keyField: e.target.value, checkedSubjects: [] }))
                      setSubjectSearch(''); setSubjectPage(1)
                    }}>
                    <option value="">选择主体列...</option>
                    {sourceRecord?.fields.map((f, i) => <option key={f} value={f}>{sourceRecord.labels[i] || f}</option>)}
                  </select>
                </div>

                {/* X 轴字段 */}
                <div>
                  <label style={lbl}>X 轴字段</label>
                  <select style={ipt} value={multiCfg.xField} onChange={(e) => setMultiCfg((p) => ({ ...p, xField: e.target.value }))}>
                    <option value="">选择 X 轴字段...</option>
                    {sourceRecord?.fields.map((f, i) => <option key={f} value={f}>{sourceRecord.labels[i] || f}</option>)}
                  </select>
                </div>

                {/* Y 轴字段 */}
                <div>
                  <label style={lbl}>Y 轴字段（多选）</label>
                  {multiCfg.yFields.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
                      {multiCfg.yFields.map((yf, i) => (
                        <span key={yf} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 7px', borderRadius: 4, fontSize: 10, fontWeight: 600, background: '#eff6ff', border: '1px solid #2563eb', color: '#2563eb' }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS[i % COLORS.length], display: 'inline-block', flexShrink: 0 }} />
                          {sourceRecord?.labels[sourceRecord.fields.indexOf(yf)] || yf}
                          <button onClick={() => setMultiCfg((p) => ({ ...p, yFields: p.yFields.filter((y) => y !== yf) }))}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2563eb', padding: 0, display: 'flex', alignItems: 'center', marginLeft: 2 }}>
                            <X size={9} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  <select style={ipt} onChange={(e) => { if (e.target.value && !multiCfg.yFields.includes(e.target.value)) setMultiCfg((p) => ({ ...p, yFields: [...p.yFields, e.target.value] })); e.target.value = '' }}>
                    <option value="">添加 Y 轴字段...</option>
                    {sourceRecord?.fields.map((f, i) => <option key={f} value={f}>{sourceRecord.labels[i] || f}</option>)}
                  </select>
                </div>

                {/* X 轴类型 */}
                <div>
                  <label style={lbl}>X 轴类型</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                    {(['category', 'linear'] as const).map((t) => (
                      <button key={t} onClick={() => setMultiCfg((p) => ({ ...p, xAxisType: t }))} style={typeBtn(multiCfg.xAxisType === t)}>
                        {t === 'category' ? '类别' : '数值'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 图表类型 */}
                <div>
                  <label style={lbl}>图表类型</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                    {(['bar', 'line', 'area', 'scatter'] as const).map((t) => (
                      <button key={t} onClick={() => setMultiCfg((p) => ({ ...p, chartType: t }))} style={typeBtn(multiCfg.chartType === t)}>
                        {t === 'bar' ? '柱状' : t === 'line' ? '折线' : t === 'area' ? '面积' : '散点'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 总加规则 */}
                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 10 }}>
                  <label style={lbl}>总加聚合规则</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {([
                      ['sum', '加和（Σ）'],
                      ['mean', '算术平均'],
                      ['weighted_mean', '加权平均'],
                    ] as const).map(([rule, label]) => (
                      <button key={rule} onClick={() => setMultiCfg((p) => ({ ...p, totalRule: rule }))}
                        style={{ ...typeBtn(multiCfg.totalRule === rule), textAlign: 'left', padding: '5px 10px' }}>
                        {label}
                      </button>
                    ))}
                  </div>
                  {multiCfg.totalRule === 'weighted_mean' && (
                    <div style={{ marginTop: 8 }}>
                      <label style={lbl}>权重列</label>
                      <select style={ipt} value={multiCfg.totalWeightField} onChange={(e) => setMultiCfg((p) => ({ ...p, totalWeightField: e.target.value }))}>
                        <option value="">选择权重列...</option>
                        {sourceRecord?.fields.map((f, i) => <option key={f} value={f}>{sourceRecord.labels[i] || f}</option>)}
                      </select>
                    </div>
                  )}
                </div>

                {/* 主体清单 */}
                {multiCfg.keyField && (
                  <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <label style={{ ...lbl, marginBottom: 0 }}>主体清单 ({allSubjects.length})</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {/* 单选/复选切换 */}
                        <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 5, padding: 2, gap: 2 }}>
                          {(['multi', 'single'] as const).map((m) => (
                            <button key={m} onClick={() => setSubjectSelectMode(m)} style={{
                              padding: '2px 7px', fontSize: 10, fontWeight: 600, border: 'none', borderRadius: 3, cursor: 'pointer',
                              background: subjectSelectMode === m ? '#fff' : 'transparent',
                              color: subjectSelectMode === m ? '#0f172a' : '#94a3b8',
                              boxShadow: subjectSelectMode === m ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                              transition: 'all 0.12s',
                            }}>
                              {m === 'multi' ? '复选' : '单选'}
                            </button>
                          ))}
                        </div>
                        {/* 复选模式下显示全选/反选/清空 */}
                        {subjectSelectMode === 'multi' && (<>
                          <button onClick={() => setMultiCfg((p) => ({ ...p, checkedSubjects: ['__total__', ...allSubjects] }))}
                            style={{ fontSize: 10, fontWeight: 600, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>全选</button>
                          <button onClick={() => {
                            const cur = new Set(multiCfg.checkedSubjects)
                            const inverted = allSubjects.filter((s) => !cur.has(s))
                            const keepTotal = cur.has('__total__')
                            setMultiCfg((p) => ({ ...p, checkedSubjects: keepTotal ? ['__total__', ...inverted] : inverted }))
                          }} style={{ fontSize: 10, fontWeight: 600, color: '#475569', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>反选</button>
                        </>)}
                        <button onClick={() => setMultiCfg((p) => ({ ...p, checkedSubjects: [] }))}
                          style={{ fontSize: 10, fontWeight: 600, color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>清空</button>
                      </div>
                    </div>

                    <div style={{ border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff', overflow: 'hidden' }}>
                      {/* 总加 — 固定置顶 */}
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', cursor: 'pointer', borderBottom: '1px solid #e2e8f0', background: '#fffbeb' }}>
                        <input type="checkbox" checked={isSubjectChecked('__total__')} onChange={() => toggleSubject('__total__')}
                          style={{ cursor: 'pointer', accentColor: '#d97706' }} />
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#d97706' }}>总加</span>
                      </label>

                      {/* 搜索框 */}
                      <div style={{ padding: '5px 8px', borderBottom: '1px solid #f1f5f9', background: '#fafafa' }}>
                        <input
                          type="text" placeholder="搜索主体..." value={subjectSearch}
                          onChange={(e) => { setSubjectSearch(e.target.value); setSubjectPage(1) }}
                          style={{ width: '100%', fontSize: 11, padding: '3px 7px', border: '1px solid #e2e8f0', borderRadius: 4, outline: 'none', color: '#0f172a', boxSizing: 'border-box' }}
                        />
                      </div>

                      {/* 主体列表 */}
                      <div>
                        {pageSubjects.length === 0 ? (
                          <div style={{ padding: '10px 10px', fontSize: 11, color: '#94a3b8', textAlign: 'center' }}>
                            {subjectSearch ? '无匹配主体' : '无主体数据'}
                          </div>
                        ) : pageSubjects.map((s) => (
                          <label key={s} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px', cursor: 'pointer', borderBottom: '1px solid #f8fafc' }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#f0f7ff' }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = '' }}>
                            <input type={subjectSelectMode === 'single' ? 'radio' : 'checkbox'}
                              name={subjectSelectMode === 'single' ? 'subject-single' : undefined}
                              checked={isSubjectChecked(s)} onChange={() => toggleSubject(s)}
                              style={{ cursor: 'pointer', accentColor: '#2563eb' }} />
                            <span style={{ fontSize: 11, color: isSubjectChecked(s) ? '#1d4ed8' : '#374151', fontWeight: isSubjectChecked(s) ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {s}
                            </span>
                          </label>
                        ))}
                      </div>

                      {/* 分页 */}
                      {totalSubjectPages > 1 && (
                        <div style={{ padding: '5px 10px', borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc' }}>
                          <button onClick={() => setSubjectPage((p) => Math.max(1, p - 1))} disabled={subjectPage === 1}
                            style={{ width: 22, height: 22, border: '1px solid #e2e8f0', borderRadius: 4, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: subjectPage === 1 ? 'not-allowed' : 'pointer', opacity: subjectPage === 1 ? 0.4 : 1, color: '#475569' }}>
                            <ChevronLeft size={11} />
                          </button>
                          <span style={{ fontSize: 10, color: '#64748b' }}>
                            {subjectPage}/{totalSubjectPages} 页 · {filteredSubjects.length} 项
                          </span>
                          <button onClick={() => setSubjectPage((p) => Math.min(totalSubjectPages, p + 1))} disabled={subjectPage === totalSubjectPages}
                            style={{ width: 22, height: 22, border: '1px solid #e2e8f0', borderRadius: 4, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: subjectPage === totalSubjectPages ? 'not-allowed' : 'pointer', opacity: subjectPage === totalSubjectPages ? 0.4 : 1, color: '#475569' }}>
                            <ChevronRight size={11} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 拖拽分隔条 */}
        <div
          style={{ width: 4, cursor: 'col-resize', background: isResizing ? '#2563eb' : '#e2e8f0', flexShrink: 0, transition: 'background 0.15s' }}
          onMouseDown={() => setIsResizing(true)}
        />

        {/* ── 右侧预览画布 ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: '#f1f5f9', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', borderBottom: '1px solid #e2e8f0', background: '#fff', flexShrink: 0 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#475569' }}>
              {activeTab === 'charts' ? '预览画布' : '多主体预览'}
            </span>
            {activeTab === 'charts' && (
              <span style={{ fontSize: 10, padding: '2px 8px', border: '1px solid #e2e8f0', borderRadius: 4, color: '#94a3b8' }}>{configs.length} 个图表</span>
            )}
            {activeTab === 'multi' && multiCfg.checkedSubjects.length > 0 && (
              <span style={{ fontSize: 10, padding: '2px 8px', border: '1px solid #e2e8f0', borderRadius: 4, color: '#94a3b8' }}>
                {multiCfg.checkedSubjects.filter((s) => s !== '__total__').length} 主体 · {multiCfg.yFields.length} Y 字段
              </span>
            )}
          </div>

          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', padding: 16 }}>
            {activeTab === 'charts' ? (
              configs.length === 0 ? (
                <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', gap: 10 }}>
                  <BarChart2 size={44} style={{ opacity: 0.1 }} />
                  <p style={{ fontSize: 12 }}>请在左侧添加并配置图表</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14 }}>
                  {configs.map((cfg) => (
                    <div key={cfg.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 14, height: 320, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                      <div style={{ flex: 1, minHeight: 0, minWidth: 0 }}>{renderVizChart(cfg)}</div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              /* 多主体分析右侧 */
              !multiPreviewData || (!multiPreviewData.main && !multiPreviewData.total) ? (
                <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', gap: 10 }}>
                  <BarChart2 size={44} style={{ opacity: 0.1 }} />
                  <p style={{ fontSize: 12 }}>请配置主体列、X 轴字段和 Y 轴字段</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {multiPreviewData.total && renderMultiChart(multiPreviewData.total, '总加', 260, { border: '1px solid #ffe4b2' })}
                  {multiPreviewData.main && renderMultiChart(multiPreviewData.main, '主体对比', 320)}
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}
