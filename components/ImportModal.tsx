'use client'

import { useState, useRef } from 'react'
import { Upload, FileText, X, AlertCircle, Folder, ChevronRight, FolderOpen, CheckCircle, Loader2, ChevronDown } from 'lucide-react'
import { Modal } from './Modal'
import { useApp } from '@/context/AppContext'
import { formatFileSize } from '@/lib/utils'
import type { HistoryRecord } from '@/types'

interface Props {
  onClose: () => void
}

type DirEntry = {
  file: File
  path: string
  dir: string
  name: string
  checked: boolean
}

type FileStatus = 'idle' | 'importing' | 'done' | 'skipped'

type TruncInfo = { totalRows: number }  // kept rows = 500K, totalRows = full count

export default function ImportModal({ onClose }: Props) {
  const { addHistory, activeCaseId } = useApp()
  const [activeTab, setActiveTab] = useState<'text' | 'file' | 'dir'>('text')
  const [textInput, setTextInput] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [importing, setImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Batch (multi-file) import progress state
  const [batchStatuses, setBatchStatuses] = useState<Record<string, FileStatus>>({})
  const [batchErrors, setBatchErrors] = useState<Record<string, string>>({})
  const [batchTruncs, setBatchTruncs] = useState<Record<string, TruncInfo>>({})
  const [batchDone, setBatchDone] = useState(false)

  // Directory import state
  const dirInputRef = useRef<HTMLInputElement>(null)
  const [dirEntries, setDirEntries] = useState<DirEntry[]>([])
  const [collapsedDirs, setCollapsedDirs] = useState<Set<string>>(new Set())
  const [dirStatuses, setDirStatuses] = useState<Record<string, FileStatus>>({})
  const [dirErrors, setDirErrors] = useState<Record<string, string>>({})
  const [dirTruncs, setDirTruncs] = useState<Record<string, TruncInfo>>({})
  const [dirDone, setDirDone] = useState(false)

  // Shared: which file keys have error detail expanded
  const [expandedErrors, setExpandedErrors] = useState<Set<string>>(new Set())

  const groupedByDir = dirEntries.reduce<Record<string, DirEntry[]>>((acc, e) => {
    ;(acc[e.dir] = acc[e.dir] || []).push(e)
    return acc
  }, {})
  const sortedDirs = Object.keys(groupedByDir).sort()
  const checkedCount = dirEntries.filter((e) => e.checked).length

  function toggleError(key: string) {
    setExpandedErrors((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // Shared response parser for both import functions
  function parseImportResponse(json: any): { record: HistoryRecord | null; errorMsg: string | null; truncInfo: TruncInfo | null } {
    if (json.error) return { record: null, errorMsg: json.error.message || '解析失败', truncInfo: null }
    const d = json.data
    const truncInfo: TruncInfo | null = d._truncated ? { totalRows: d._totalRows } : null
    return {
      record: {
        id: d.id,
        caseId: d.case_id,
        importTime: d.import_time,
        importedBy: d.imported_by,
        sectionTag: d.section_tag,
        meta: d.meta,
        fields: d.fields,
        labels: d.labels,
        rows: d.rows ?? [],
        colConfig: d.col_config,
        pageSize: d.page_size,
        vizConfigs: d.viz_configs,
        multiSubjectConfig: d.multi_subject_config ?? null,
        sortOrder: d.sort_order,
      },
      errorMsg: null,
      truncInfo,
    }
  }

  // Mode B: text paste tab — text already decoded in browser, send as Blob
  async function importFromText(
    caseId: string,
    text: string,
    fileName?: string,
  ): Promise<{ record: HistoryRecord | null; errorMsg: string | null; truncInfo: TruncInfo | null }> {
    const form = new FormData()
    form.append('text', new Blob([text], { type: 'text/plain' }), 'content')
    if (fileName) form.append('fileName', fileName)
    const res = await fetch(`/api/cases/${caseId}/histories/import-text`, { method: 'POST', body: form })
    return parseImportResponse(await res.json())
  }

  // Mode A: file/dir tabs — send raw File, server handles encoding detection.
  // No client-side FileReader: avoids 2× memory spike and 10MB Blob limit.
  async function importFile(
    caseId: string,
    file: File,
    fileName?: string,
    folder?: string,
  ): Promise<{ record: HistoryRecord | null; errorMsg: string | null; truncInfo: TruncInfo | null }> {
    const form = new FormData()
    form.append('file', file)
    if (fileName) form.append('fileName', fileName)
    if (folder) form.append('folder', folder)
    const res = await fetch(`/api/cases/${caseId}/histories/import-text`, { method: 'POST', body: form })
    return parseImportResponse(await res.json())
  }

  // ── 粘贴文本 ──────────────────────────────────────────────────

  async function handleTextImport() {
    setError(null)
    if (!textInput.trim()) { setError('请输入文本内容'); return }
    if (!activeCaseId) { setError('未选择案例'); return }
    setImporting(true)
    try {
      const { record, errorMsg, truncInfo } = await importFromText(activeCaseId, textInput, 'Imported Text')
      if (errorMsg) { setError(errorMsg); return }
      if (record) {
        addHistory(record)
        if (truncInfo) {
          setError(`已导入（行数超限：文件共 ${truncInfo.totalRows.toLocaleString()} 行，已截取前 500,000 行）`)
        } else {
          onClose()
          setTextInput('')
        }
      }
    } catch (e: any) {
      setError(e?.message || '导入失败')
    } finally {
      setImporting(false)
    }
  }

  // ── 多文件导入 ─────────────────────────────────────────────────

  function addFiles(newFiles: File[]) {
    // Reset progress state when user adds new files
    if (Object.keys(batchStatuses).length > 0 || batchDone) {
      setBatchStatuses({})
      setBatchErrors({})
      setBatchTruncs({})
      setBatchDone(false)
      setExpandedErrors(new Set())
    }
    const valid = newFiles.filter((f) => /\.(txt|e|dat|csv|log)$/i.test(f.name) || f.type.startsWith('text/'))
    setFiles((prev) => {
      const existing = new Set(prev.map((f) => f.name))
      return [...prev, ...valid.filter((f) => !existing.has(f.name))]
    })
  }

  function removeFile(name: string) {
    setFiles((prev) => prev.filter((f) => f.name !== name))
    setBatchStatuses((prev) => { const n = { ...prev }; delete n[name]; return n })
    setBatchErrors((prev) => { const n = { ...prev }; delete n[name]; return n })
    setExpandedErrors((prev) => { const n = new Set(prev); n.delete(name); return n })
  }

  async function handleBatchImport() {
    if (!activeCaseId || files.length === 0) return
    setImporting(true)
    setError(null)
    setBatchDone(false)
    setExpandedErrors(new Set())

    const initStatuses: Record<string, FileStatus> = {}
    for (const f of files) initStatuses[f.name] = 'idle'
    setBatchStatuses(initStatuses)
    setBatchErrors({})
    setBatchTruncs({})

    const saved: HistoryRecord[] = []

    for (const file of files) {
      setBatchStatuses((prev) => ({ ...prev, [file.name]: 'importing' }))
      try {
        const { record, errorMsg, truncInfo } = await importFile(activeCaseId, file, file.name)
        if (errorMsg) {
          setBatchStatuses((prev) => ({ ...prev, [file.name]: 'skipped' }))
          setBatchErrors((prev) => ({ ...prev, [file.name]: errorMsg }))
        } else if (record) {
          saved.push(record)
          setBatchStatuses((prev) => ({ ...prev, [file.name]: 'done' }))
          if (truncInfo) setBatchTruncs((prev) => ({ ...prev, [file.name]: truncInfo }))
        } else {
          setBatchStatuses((prev) => ({ ...prev, [file.name]: 'skipped' }))
          setBatchErrors((prev) => ({ ...prev, [file.name]: '保存失败，请稍后重试' }))
        }
      } catch (e: any) {
        setBatchStatuses((prev) => ({ ...prev, [file.name]: 'skipped' }))
        setBatchErrors((prev) => ({ ...prev, [file.name]: e?.message || '导入失败' }))
      }
    }

    for (const r of [...saved].reverse()) addHistory(r)
    setImporting(false)
    setBatchDone(true)
  }

  // ── 目录导入 ───────────────────────────────────────────────────

  function handleDirChange(e: React.ChangeEvent<HTMLInputElement>) {
    const allFiles = Array.from(e.target.files || [])
    const txtFiles = allFiles.filter((f) => f.name.toLowerCase().endsWith('.txt'))
    const entries: DirEntry[] = txtFiles.map((f) => {
      const relativePath = (f as any).webkitRelativePath as string || f.name
      const parts = relativePath.split('/')
      const name = parts[parts.length - 1]
      const dir = parts.slice(0, -1).join('/')
      return { file: f, path: relativePath, dir, name, checked: true }
    })
    setDirEntries(entries)
    setCollapsedDirs(new Set())
    setDirStatuses({})
    setDirErrors({})
    setDirDone(false)
    setError(null)
    setExpandedErrors(new Set())
    e.target.value = ''
  }

  function toggleDirCheck(dir: string) {
    const items = groupedByDir[dir] || []
    const allChecked = items.every((e) => e.checked)
    setDirEntries((prev) => prev.map((e) => (e.dir === dir ? { ...e, checked: !allChecked } : e)))
  }

  function toggleEntryCheck(path: string) {
    setDirEntries((prev) => prev.map((e) => (e.path === path ? { ...e, checked: !e.checked } : e)))
  }

  function toggleCollapseDir(dir: string) {
    setCollapsedDirs((prev) => {
      const next = new Set(prev)
      if (next.has(dir)) next.delete(dir)
      else next.add(dir)
      return next
    })
  }

  async function handleDirImport() {
    if (!activeCaseId) return
    setImporting(true)
    setError(null)
    setDirDone(false)
    setExpandedErrors(new Set())

    const toImport = dirEntries.filter((e) => e.checked)
    const initStatuses: Record<string, FileStatus> = {}
    for (const e of toImport) initStatuses[e.path] = 'idle'
    setDirStatuses(initStatuses)
    setDirErrors({})
    setDirTruncs({})

    const saved: HistoryRecord[] = []

    for (const entry of toImport) {
      setDirStatuses((prev) => ({ ...prev, [entry.path]: 'importing' }))
      try {
        const { record, errorMsg, truncInfo } = await importFile(activeCaseId, entry.file, entry.name, entry.dir)
        if (errorMsg) {
          setDirStatuses((prev) => ({ ...prev, [entry.path]: 'skipped' }))
          setDirErrors((prev) => ({ ...prev, [entry.path]: errorMsg }))
        } else if (record) {
          saved.push(record)
          setDirStatuses((prev) => ({ ...prev, [entry.path]: 'done' }))
          if (truncInfo) setDirTruncs((prev) => ({ ...prev, [entry.path]: truncInfo }))
        } else {
          setDirStatuses((prev) => ({ ...prev, [entry.path]: 'skipped' }))
          setDirErrors((prev) => ({ ...prev, [entry.path]: '保存失败，请稍后重试' }))
        }
      } catch (e: any) {
        setDirStatuses((prev) => ({ ...prev, [entry.path]: 'skipped' }))
        setDirErrors((prev) => ({ ...prev, [entry.path]: e?.message || '导入失败' }))
      }
    }

    for (const r of [...saved].reverse()) addHistory(r)
    setImporting(false)
    setDirDone(true)
  }

  // ── Render ─────────────────────────────────────────────────────

  const TABS = [
    { key: 'text' as const, label: '粘贴文本' },
    { key: 'file' as const, label: `多文件${files.length > 0 ? ` (${files.length})` : ''}` },
    { key: 'dir' as const, label: `目录导入${dirEntries.length > 0 ? ` (${dirEntries.length})` : ''}` },
  ]

  // Batch tab derived values
  const batchIsRunning = importing && activeTab === 'file'
  const batchDoneCount = Object.values(batchStatuses).filter((s) => s === 'done').length
  const batchSkippedCount = Object.values(batchStatuses).filter((s) => s === 'skipped').length
  const batchProcessedCount = batchDoneCount + batchSkippedCount
  const batchTotal = files.length
  const batchProgressPct = batchTotal > 0 ? (batchProcessedCount / batchTotal) * 100 : 0
  const batchIsActive = Object.keys(batchStatuses).length > 0

  // Dir tab derived values
  const toImportPaths = new Set(dirEntries.filter((e) => e.checked).map((e) => e.path))
  const dirDoneCount = Object.values(dirStatuses).filter((s) => s === 'done').length
  const dirSkippedCount = Object.values(dirStatuses).filter((s) => s === 'skipped').length
  const dirProcessedCount = dirDoneCount + dirSkippedCount
  const dirTotalCount = toImportPaths.size
  const dirProgressPct = dirTotalCount > 0 ? (dirProcessedCount / dirTotalCount) * 100 : 0
  const dirIsRunning = importing && activeTab === 'dir'

  return (
    <Modal isOpen onClose={onClose} title="导入新数据" width="580px">
      <style>{`@keyframes importSpin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0, flex: 1 }}>

        {/* 选项卡 */}
        <div style={{ display: 'flex', border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{ flex: 1, padding: '8px 0', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'background 0.15s, color 0.15s', background: activeTab === tab.key ? '#2563eb' : '#f8fafc', color: activeTab === tab.key ? '#fff' : '#475569' }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── 粘贴文本 ── */}
        {activeTab === 'text' && (
          <>
            <textarea
              style={{ width: '100%', height: 240, padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontFamily: 'monospace', fontSize: 11, outline: 'none', resize: 'none', background: '#f8fafc', color: '#0f172a', boxSizing: 'border-box', lineHeight: 1.6 }}
              placeholder={`<! Region=XX Time='2024-01-01 00:00:00' Type=Sample !>\n<DataSection>\n@ ID PeriodID Value\n/@ 编号 时段 数值\n001 1 100.00\n002 2 200.00\n</DataSection>`}
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
            />
            {error && <ErrorBox message={error} />}
            <ImportBtn label={importing ? '解析中...' : '解析并导入'} disabled={importing} onClick={handleTextImport} />
          </>
        )}

        {/* ── 多文件 ── */}
        {activeTab === 'file' && (
          <>
            {/* Drag-drop zone: only when not started */}
            {!batchIsActive && (
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files) addFiles(Array.from(e.dataTransfer.files)) }}
                onClick={() => fileInputRef.current?.click()}
                style={{ border: `2px dashed ${isDragging ? '#2563eb' : '#e2e8f0'}`, borderRadius: 10, padding: '28px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: isDragging ? '#eff6ff' : '#f8fafc', transition: 'border-color 0.15s, background 0.15s', gap: 6, flexShrink: 0 }}
              >
                <Upload size={26} style={{ color: '#94a3b8' }} />
                <p style={{ fontSize: 12, fontWeight: 600, color: '#475569', margin: 0 }}>点击或拖拽文件到此处</p>
                <p style={{ fontSize: 11, color: '#94a3b8', margin: 0 }}>支持 .txt .e .dat .csv .log</p>
                <input ref={fileInputRef} type="file" multiple accept=".txt,.e,.dat,.csv,.log,text/*" style={{ display: 'none' }} onChange={(e) => { if (e.target.files) addFiles(Array.from(e.target.files)) }} />
              </div>
            )}

            {/* Progress bar */}
            {batchIsActive && (
              <div style={{ flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: '#64748b' }}>
                    {batchIsRunning
                      ? <>正在导入 <b style={{ color: '#2563eb' }}>{batchProcessedCount}</b> / <b>{batchTotal}</b>…</>
                      : batchDoneCount > 0
                        ? <><b style={{ color: '#16a34a' }}>{batchDoneCount}</b> 个导入成功{batchSkippedCount > 0 ? <>，<b style={{ color: '#d97706' }}>{batchSkippedCount}</b> 个失败</> : ''}</>
                        : <b style={{ color: '#d97706' }}>全部失败（非 E 文件格式）</b>
                    }
                  </span>
                  {!batchIsRunning && (
                    <button
                      onClick={() => { fileInputRef.current?.click() }}
                      style={{ fontSize: 11, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                    >
                      + 继续添加
                    </button>
                  )}
                </div>
                <div style={{ height: 4, background: '#e2e8f0', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${batchProgressPct}%`, background: batchDone && batchDoneCount === 0 ? '#f59e0b' : '#2563eb', borderRadius: 2, transition: 'width 0.25s ease' }} />
                </div>
                <input ref={fileInputRef} type="file" multiple accept=".txt,.e,.dat,.csv,.log,text/*" style={{ display: 'none' }} onChange={(e) => { if (e.target.files) addFiles(Array.from(e.target.files)) }} />
              </div>
            )}

            {/* File list */}
            {files.length > 0 && (
              <div style={{ overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 8, maxHeight: 280 }}>
                {files.map((f) => {
                  const status: FileStatus = batchStatuses[f.name] ?? 'idle'
                  const errMsg = batchErrors[f.name]
                  const truncInfo = batchTruncs[f.name]
                  const errorExpanded = expandedErrors.has(f.name)
                  const isSkippedWithErr = status === 'skipped' && !!errMsg
                  return (
                    <div key={f.name}>
                      <div
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderBottom: '1px solid #f1f5f9', background: status === 'done' ? '#f0fdf4' : status === 'skipped' ? '#fffbeb' : '#fff', cursor: isSkippedWithErr ? 'pointer' : 'default', transition: 'background 0.2s' }}
                        onClick={() => { if (isSkippedWithErr) toggleError(f.name) }}
                      >
                        <div style={{ width: 16, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {batchIsActive
                            ? <StatusIcon status={status} inScope />
                            : <FileText size={13} style={{ color: '#94a3b8' }} />
                          }
                        </div>
                        <div style={{ flex: 1, overflow: 'hidden' }}>
                          <div style={{ fontSize: 11, fontWeight: status === 'done' || status === 'skipped' ? 600 : 400, color: status === 'done' ? '#15803d' : status === 'skipped' ? '#92400e' : '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {f.name}
                          </div>
                          {!batchIsActive && <div style={{ fontSize: 10, color: '#94a3b8' }}>{formatFileSize(f.size)}</div>}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                          <span style={{ fontSize: 10, color: status === 'done' ? '#16a34a' : status === 'skipped' ? '#d97706' : '#94a3b8' }}>
                            {status === 'done' ? (truncInfo ? '已截断导入' : '已导入') : status === 'skipped' ? '失败' : status === 'importing' ? '导入中…' : formatFileSize(f.size)}
                          </span>
                          {isSkippedWithErr && (
                            <ChevronDown size={12} style={{ color: '#d97706', transition: 'transform 0.15s', transform: errorExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }} />
                          )}
                          {!batchIsActive && (
                            <button onClick={(e) => { e.stopPropagation(); removeFile(f.name) }} style={{ padding: 3, borderRadius: 4, border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center' }}>
                              <X size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                      {status === 'done' && truncInfo && (
                        <div style={{ padding: '4px 10px 5px 34px', background: '#fffbeb', borderBottom: '1px solid #fde68a', fontSize: 10, color: '#78350f', lineHeight: 1.5 }}>
                          文件共 {truncInfo.totalRows.toLocaleString()} 行，已截取前 500,000 行导入
                        </div>
                      )}
                      {isSkippedWithErr && errorExpanded && (
                        <div style={{ padding: '5px 10px 6px 34px', background: '#fef3c7', borderBottom: '1px solid #fde68a', fontSize: 10, color: '#78350f', lineHeight: 1.5, wordBreak: 'break-all' }}>
                          {errMsg}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {batchDone ? (
              <button
                onClick={onClose}
                style={{ width: '100%', padding: '9px 0', fontSize: 13, fontWeight: 600, color: '#fff', background: batchDoneCount > 0 ? '#16a34a' : '#d97706', border: 'none', borderRadius: 8, cursor: 'pointer', flexShrink: 0 }}
              >
                {batchDoneCount > 0 ? `完成（已导入 ${batchDoneCount} 个）` : '关闭'}
              </button>
            ) : (
              <ImportBtn
                label={batchIsRunning ? `导入中… ${batchProcessedCount} / ${batchTotal}` : `开始批量导入${files.length > 0 ? ` (${files.length})` : ''}`}
                disabled={files.length === 0 || batchIsRunning}
                onClick={handleBatchImport}
              />
            )}
          </>
        )}

        {/* ── 目录导入 ── */}
        {activeTab === 'dir' && (
          <>
            <input ref={dirInputRef} type="file" multiple style={{ display: 'none' }} onChange={handleDirChange} {...({ webkitdirectory: '' } as any)} />

            {dirEntries.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '48px 16px' }}>
                <FolderOpen size={44} style={{ color: '#94a3b8' }} />
                <p style={{ fontSize: 12, color: '#64748b', margin: 0, textAlign: 'center', lineHeight: 1.6 }}>
                  选择一个目录，将自动扫描其中所有 .txt 文件<br />
                  <span style={{ color: '#94a3b8' }}>非 E 文件格式将在导入时自动跳过</span>
                </p>
                <button onClick={() => dirInputRef.current?.click()} style={{ padding: '9px 24px', fontSize: 13, fontWeight: 600, color: '#fff', background: '#2563eb', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
                  选择目录
                </button>
              </div>
            ) : (
              <>
                {/* Toolbar */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                  <span style={{ fontSize: 11, color: '#64748b' }}>
                    {dirIsRunning || dirDone
                      ? dirIsRunning
                        ? <>正在导入 <b style={{ color: '#2563eb' }}>{dirProcessedCount}</b> / <b>{dirTotalCount}</b>…</>
                        : dirDoneCount > 0
                          ? <><b style={{ color: '#16a34a' }}>{dirDoneCount}</b> 个导入成功{dirSkippedCount > 0 ? <>，<b style={{ color: '#d97706' }}>{dirSkippedCount}</b> 个失败</> : ''}</>
                          : <b style={{ color: '#d97706' }}>全部失败（非 E 文件格式）</b>
                      : <>共 <b style={{ color: '#374151' }}>{dirEntries.length}</b> 个文件，已选 <b style={{ color: '#2563eb' }}>{checkedCount}</b> 个</>
                    }
                  </span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {!dirIsRunning && !dirDone && (
                      <>
                        <SmallBtn label="全选" onClick={() => setDirEntries((p) => p.map((e) => ({ ...e, checked: true })))} />
                        <SmallBtn label="全不选" onClick={() => setDirEntries((p) => p.map((e) => ({ ...e, checked: false })))} />
                      </>
                    )}
                    <SmallBtn label="重新选择" onClick={() => { if (!dirIsRunning) dirInputRef.current?.click() }} />
                  </div>
                </div>

                {/* Progress bar */}
                {(dirIsRunning || dirDone) && (
                  <div style={{ height: 4, background: '#e2e8f0', borderRadius: 2, overflow: 'hidden', flexShrink: 0 }}>
                    <div style={{ height: '100%', width: `${dirProgressPct}%`, background: dirDone && dirDoneCount === 0 ? '#f59e0b' : '#2563eb', borderRadius: 2, transition: 'width 0.25s ease' }} />
                  </div>
                )}

                {/* File tree */}
                <div style={{ flex: 1, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 8, minHeight: 0, maxHeight: 300 }}>
                  {sortedDirs.map((dir) => {
                    const items = groupedByDir[dir]
                    const allChecked = items.every((e) => e.checked)
                    const someChecked = items.some((e) => e.checked)
                    const isCollapsed = collapsedDirs.has(dir)
                    const depth = dir.split('/').length - 1
                    const displayName = dir.split('/').pop() || dir

                    return (
                      <div key={dir}>
                        <div
                          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 10px', paddingLeft: 10 + depth * 16, background: '#f8fafc', borderBottom: '1px solid #e2e8f0', cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => toggleCollapseDir(dir)}
                        >
                          {!dirIsRunning && !dirDone && (
                            <input
                              type="checkbox"
                              checked={allChecked}
                              ref={(el) => { if (el) el.indeterminate = someChecked && !allChecked }}
                              onClick={(e) => e.stopPropagation()}
                              onChange={() => toggleDirCheck(dir)}
                              style={{ cursor: 'pointer', flexShrink: 0 }}
                            />
                          )}
                          <ChevronRight size={12} style={{ color: '#64748b', flexShrink: 0, transition: 'transform 0.15s', transform: isCollapsed ? 'rotate(0deg)' : 'rotate(90deg)' }} />
                          <Folder size={13} style={{ color: '#f59e0b', flexShrink: 0 }} />
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{displayName}</span>
                          <span style={{ fontSize: 11, color: '#94a3b8', flexShrink: 0 }}>{items.length} 个</span>
                        </div>

                        {!isCollapsed && items.map((entry) => {
                          const status: FileStatus = dirStatuses[entry.path] ?? 'idle'
                          const inScope = toImportPaths.has(entry.path)
                          const errMsg = dirErrors[entry.path]
                          const truncInfo = dirTruncs[entry.path]
                          const isSkippedWithErr = status === 'skipped' && !!errMsg
                          const errorExpanded = expandedErrors.has(entry.path)
                          const isActive = dirIsRunning || dirDone
                          return (
                            <div key={entry.path}>
                              <div
                                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', paddingLeft: 28 + depth * 16, borderBottom: '1px solid #f8fafc', background: status === 'done' ? '#f0fdf4' : status === 'skipped' ? '#fffbeb' : '#fff', cursor: isSkippedWithErr ? 'pointer' : isActive ? 'default' : 'pointer', transition: 'background 0.2s' }}
                                onClick={() => {
                                  if (isSkippedWithErr) toggleError(entry.path)
                                  else if (!isActive) toggleEntryCheck(entry.path)
                                }}
                              >
                                {!isActive ? (
                                  <input type="checkbox" checked={entry.checked} onClick={(e) => e.stopPropagation()} onChange={() => toggleEntryCheck(entry.path)} style={{ cursor: 'pointer', flexShrink: 0 }} />
                                ) : (
                                  <div style={{ width: 14, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <StatusIcon status={status} inScope={inScope} />
                                  </div>
                                )}
                                <FileText size={12} style={{ color: status === 'done' ? '#16a34a' : status === 'skipped' ? '#d97706' : '#94a3b8', flexShrink: 0 }} />
                                <span style={{ fontSize: 11, color: status === 'done' ? '#15803d' : status === 'skipped' ? '#92400e' : '#374151', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: status === 'done' || status === 'skipped' ? 600 : 400 }}>
                                  {entry.name}
                                </span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                                  <span style={{ fontSize: 10, color: status === 'done' ? '#16a34a' : status === 'skipped' ? '#d97706' : '#94a3b8' }}>
                                    {status === 'done' ? (truncInfo ? '已截断导入' : '已导入') : status === 'skipped' ? '失败' : formatFileSize(entry.file.size)}
                                  </span>
                                  {isSkippedWithErr && (
                                    <ChevronDown size={12} style={{ color: '#d97706', transition: 'transform 0.15s', transform: errorExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }} />
                                  )}
                                </div>
                              </div>
                              {status === 'done' && truncInfo && (
                                <div style={{ padding: '4px 10px 5px', paddingLeft: 28 + depth * 16 + 22, background: '#fffbeb', borderBottom: '1px solid #fde68a', fontSize: 10, color: '#78350f', lineHeight: 1.5 }}>
                                  文件共 {truncInfo.totalRows.toLocaleString()} 行，已截取前 500,000 行导入
                                </div>
                              )}
                              {isSkippedWithErr && errorExpanded && (
                                <div style={{ padding: '5px 10px 6px', paddingLeft: 28 + depth * 16 + 22, background: '#fef3c7', borderBottom: '1px solid #fde68a', fontSize: 10, color: '#78350f', lineHeight: 1.5, wordBreak: 'break-all' }}>
                                  {errMsg}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>

                {dirDone ? (
                  <button onClick={onClose} style={{ width: '100%', padding: '9px 0', fontSize: 13, fontWeight: 600, color: '#fff', background: dirDoneCount > 0 ? '#16a34a' : '#d97706', border: 'none', borderRadius: 8, cursor: 'pointer', flexShrink: 0 }}>
                    {dirDoneCount > 0 ? `完成（已导入 ${dirDoneCount} 个）` : '关闭'}
                  </button>
                ) : (
                  <ImportBtn
                    label={dirIsRunning ? `导入中… ${dirProcessedCount} / ${dirTotalCount}` : `导入选中文件 (${checkedCount})`}
                    disabled={checkedCount === 0 || dirIsRunning}
                    onClick={handleDirImport}
                  />
                )}
              </>
            )}
          </>
        )}
      </div>
    </Modal>
  )
}

function StatusIcon({ status, inScope }: { status: FileStatus; inScope: boolean }) {
  if (!inScope) return null
  if (status === 'importing') return <Loader2 size={13} style={{ color: '#2563eb', animation: 'importSpin 0.8s linear infinite' }} />
  if (status === 'done') return <CheckCircle size={13} style={{ color: '#16a34a' }} />
  if (status === 'skipped') return <AlertCircle size={13} style={{ color: '#d97706' }} />
  return <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#e2e8f0', display: 'inline-block' }} />
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 12px', color: '#ef4444' }}>
      <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
      <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{message}</span>
    </div>
  )
}

function ImportBtn({ label, disabled, onClick }: { label: string; disabled: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{ width: '100%', padding: '9px 0', fontSize: 13, fontWeight: 600, color: '#fff', background: disabled ? '#93c5fd' : '#2563eb', border: 'none', borderRadius: 8, cursor: disabled ? 'not-allowed' : 'pointer', transition: 'background 0.15s', flexShrink: 0 }}>
      {label}
    </button>
  )
}

function SmallBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ padding: '4px 10px', fontSize: 11, fontWeight: 500, color: '#475569', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 5, cursor: 'pointer' }}>
      {label}
    </button>
  )
}
