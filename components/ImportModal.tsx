'use client'

import { useState, useRef } from 'react'
import { Upload, FileText, X, AlertCircle, Folder, ChevronRight, FolderOpen, CheckCircle, Loader2 } from 'lucide-react'
import { Modal } from './Modal'
import { useApp } from '@/context/AppContext'
import { formatFileSize } from '@/lib/utils'
import type { HistoryRecord } from '@/types'

interface Props {
  onClose: () => void
}

type DirEntry = {
  file: File
  path: string     // webkitRelativePath
  dir: string      // path without filename
  name: string     // filename only
  checked: boolean
}

type FileStatus = 'idle' | 'importing' | 'done' | 'skipped'

export default function ImportModal({ onClose }: Props) {
  const { addHistory, activeCaseId } = useApp()
  const [activeTab, setActiveTab] = useState<'text' | 'file' | 'dir'>('text')
  const [textInput, setTextInput] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [importing, setImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Directory import state
  const dirInputRef = useRef<HTMLInputElement>(null)
  const [dirEntries, setDirEntries] = useState<DirEntry[]>([])
  const [collapsedDirs, setCollapsedDirs] = useState<Set<string>>(new Set())
  const [fileStatuses, setFileStatuses] = useState<Record<string, FileStatus>>({})
  const [importDone, setImportDone] = useState(false)

  const groupedByDir = dirEntries.reduce<Record<string, DirEntry[]>>((acc, e) => {
    ;(acc[e.dir] = acc[e.dir] || []).push(e)
    return acc
  }, {})
  const sortedDirs = Object.keys(groupedByDir).sort()
  const checkedCount = dirEntries.filter((e) => e.checked).length

  const readFile = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const text = e.target?.result as string
        if (text.includes('\ufffd')) {
          const gbk = new FileReader()
          gbk.onload = (e2) => resolve(e2.target?.result as string)
          gbk.onerror = reject
          gbk.readAsText(file, 'gbk')
        } else {
          resolve(text)
        }
      }
      reader.onerror = reject
      reader.readAsText(file, 'utf-8')
    })

  async function callParse(text: string, fileName?: string) {
    const res = await fetch('/api/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, fileName }),
    })
    return res.json()
  }

  async function saveHistory(caseId: string, record: any): Promise<HistoryRecord | null> {
    const res = await fetch(`/api/cases/${caseId}/histories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record),
    })
    const { data } = await res.json()
    if (!data) return null
    return {
      id: data.id,
      caseId: data.case_id,
      importTime: data.import_time,
      importedBy: data.imported_by,
      sectionTag: data.section_tag,
      meta: data.meta,
      fields: data.fields,
      labels: data.labels,
      rows: data.rows,
      colConfig: data.col_config,
      pageSize: data.page_size,
      vizConfigs: data.viz_configs,
      sortOrder: data.sort_order,
    }
  }

  async function handleTextImport() {
    setError(null)
    if (!textInput.trim()) { setError('请输入文本内容'); return }
    if (!activeCaseId) { setError('未选择案例'); return }

    setImporting(true)
    const { data, error: parseErr } = await callParse(textInput, 'Imported Text')
    if (parseErr) { setError(parseErr.message); setImporting(false); return }

    const saved = await saveHistory(activeCaseId, data)
    if (saved) { addHistory(saved); onClose(); setTextInput('') }
    setImporting(false)
  }

  function addFiles(newFiles: File[]) {
    const valid = newFiles.filter((f) => /\.(txt|e|dat|csv|log)$/i.test(f.name) || f.type.startsWith('text/'))
    setFiles((prev) => {
      const existing = new Set(prev.map((f) => f.name))
      return [...prev, ...valid.filter((f) => !existing.has(f.name))]
    })
  }

  async function handleBatchImport() {
    if (!activeCaseId || files.length === 0) return
    setImporting(true)
    setError(null)
    const saved: HistoryRecord[] = []
    const failedFiles: string[] = []

    for (const file of files) {
      try {
        const content = await readFile(file)
        const { data, error: parseErr } = await callParse(content, file.name)
        if (parseErr) { failedFiles.push(file.name); continue }
        const record = await saveHistory(activeCaseId, data)
        if (record) saved.push(record)
        else failedFiles.push(file.name)
      } catch { failedFiles.push(file.name) }
    }

    for (const r of [...saved].reverse()) addHistory(r)
    setImporting(false)

    if (failedFiles.length > 0) {
      setError(`以下 ${failedFiles.length} 个文件解析失败（非 E 文件格式）：\n${failedFiles.join('、')}`)
      if (saved.length > 0) setFiles(files.filter((f) => failedFiles.includes(f.name)))
    } else {
      onClose()
      setFiles([])
    }
  }

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
    setFileStatuses({})
    setImportDone(false)
    setError(null)
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
    setImportDone(false)

    const toImport = dirEntries.filter((e) => e.checked)

    // Initialize all statuses to 'idle'
    const initStatuses: Record<string, FileStatus> = {}
    for (const e of toImport) initStatuses[e.path] = 'idle'
    setFileStatuses(initStatuses)

    const saved: HistoryRecord[] = []

    for (const entry of toImport) {
      setFileStatuses((prev) => ({ ...prev, [entry.path]: 'importing' }))
      try {
        const content = await readFile(entry.file)
        const { data, error: parseErr } = await callParse(content, entry.name)
        if (parseErr) {
          setFileStatuses((prev) => ({ ...prev, [entry.path]: 'skipped' }))
          continue
        }
        const dataWithFolder = { ...data, meta: { ...data.meta, __folder__: entry.dir } }
        const record = await saveHistory(activeCaseId, dataWithFolder)
        if (record) {
          saved.push(record)
          setFileStatuses((prev) => ({ ...prev, [entry.path]: 'done' }))
        } else {
          setFileStatuses((prev) => ({ ...prev, [entry.path]: 'skipped' }))
        }
      } catch {
        setFileStatuses((prev) => ({ ...prev, [entry.path]: 'skipped' }))
      }
    }

    for (const r of [...saved].reverse()) addHistory(r)
    setImporting(false)
    setImportDone(true)

    if (saved.length === 0 && toImport.length > 0) {
      setError(`所有选中文件均无法解析（非 E 文件格式），共跳过 ${toImport.length} 个`)
    }
  }

  const TABS = [
    { key: 'text' as const, label: '粘贴文本' },
    { key: 'file' as const, label: `多文件${files.length > 0 ? ` (${files.length})` : ''}` },
    { key: 'dir' as const, label: `目录导入${dirEntries.length > 0 ? ` (${dirEntries.length})` : ''}` },
  ]

  return (
    <Modal isOpen onClose={onClose} title="导入新数据" width="580px">
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0, flex: 1 }}>

        {/* 选项卡 */}
        <div style={{ display: 'flex', border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                flex: 1,
                padding: '8px 0',
                fontSize: 12,
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                transition: 'background 0.15s, color 0.15s',
                background: activeTab === tab.key ? '#2563eb' : '#f8fafc',
                color: activeTab === tab.key ? '#fff' : '#475569',
              }}
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
              placeholder={`<! Grid=广东 Time='2025-03-06 17:15:10' Type=日前 !>\n<SystemBalance>\n@ ResultID PeriodID Value\n// 结果ID 时段 数值\nN0000 1 15255.26\n</SystemBalance>`}
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
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files) addFiles(Array.from(e.dataTransfer.files)) }}
              onClick={() => fileInputRef.current?.click()}
              style={{ border: `2px dashed ${isDragging ? '#2563eb' : '#e2e8f0'}`, borderRadius: 10, padding: '32px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: isDragging ? '#eff6ff' : '#f8fafc', transition: 'border-color 0.15s, background 0.15s', gap: 6 }}
            >
              <Upload size={28} style={{ color: '#94a3b8' }} />
              <p style={{ fontSize: 12, fontWeight: 600, color: '#475569', margin: 0 }}>点击或拖拽文件到此处</p>
              <p style={{ fontSize: 11, color: '#94a3b8', margin: 0 }}>支持 .txt .e .dat .csv .log</p>
              <input ref={fileInputRef} type="file" multiple accept=".txt,.e,.dat,.csv,.log,text/*" style={{ display: 'none' }} onChange={(e) => { if (e.target.files) addFiles(Array.from(e.target.files)) }} />
            </div>

            {files.length > 0 && (
              <div style={{ maxHeight: 160, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 8 }}>
                {files.map((f, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderBottom: i < files.length - 1 ? '1px solid #f1f5f9' : 'none', background: '#fff' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                      <FileText size={14} style={{ color: '#94a3b8', flexShrink: 0 }} />
                      <div style={{ overflow: 'hidden' }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</div>
                        <div style={{ fontSize: 10, color: '#94a3b8' }}>{formatFileSize(f.size)}</div>
                      </div>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); setFiles(files.filter((_, idx) => idx !== i)) }} style={{ padding: 4, borderRadius: 4, border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center' }}>
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {error && <ErrorBox message={error} />}
            <ImportBtn label={importing ? '导入中...' : `开始批量导入${files.length > 0 ? ` (${files.length})` : ''}`} disabled={files.length === 0 || importing} onClick={handleBatchImport} />
          </>
        )}

        {/* ── 目录导入 ── */}
        {activeTab === 'dir' && (
          <>
            <style>{`@keyframes importSpin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>

            {/* Hidden dir input */}
            <input
              ref={dirInputRef}
              type="file"
              multiple
              style={{ display: 'none' }}
              onChange={handleDirChange}
              {...({ webkitdirectory: '' } as any)}
            />

            {dirEntries.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '48px 16px' }}>
                <FolderOpen size={44} style={{ color: '#94a3b8' }} />
                <p style={{ fontSize: 12, color: '#64748b', margin: 0, textAlign: 'center', lineHeight: 1.6 }}>
                  选择一个目录，将自动扫描其中所有 .txt 文件<br />
                  <span style={{ color: '#94a3b8' }}>非 E 文件格式将在导入时自动跳过</span>
                </p>
                <button
                  onClick={() => dirInputRef.current?.click()}
                  style={{ padding: '9px 24px', fontSize: 13, fontWeight: 600, color: '#fff', background: '#2563eb', border: 'none', borderRadius: 8, cursor: 'pointer' }}
                >
                  选择目录
                </button>
              </div>
            ) : (() => {
              const toImportPaths = new Set(dirEntries.filter(e => e.checked).map(e => e.path))
              const doneCount = Object.values(fileStatuses).filter(s => s === 'done').length
              const skippedCount = Object.values(fileStatuses).filter(s => s === 'skipped').length
              const processedCount = doneCount + skippedCount
              const totalCount = toImportPaths.size
              const progressPct = totalCount > 0 ? (processedCount / totalCount) * 100 : 0
              const isRunning = importing
              const isDone = importDone

              return (
                <>
                  {/* Toolbar */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                    {isRunning || isDone ? (
                      <span style={{ fontSize: 11, color: '#64748b' }}>
                        {isRunning
                          ? <>正在导入 <b style={{ color: '#2563eb' }}>{processedCount}</b> / <b>{totalCount}</b>…</>
                          : doneCount > 0
                            ? <><b style={{ color: '#16a34a' }}>{doneCount}</b> 个导入成功{skippedCount > 0 ? <>，<b style={{ color: '#d97706' }}>{skippedCount}</b> 个已跳过</> : ''}</>
                            : <b style={{ color: '#d97706' }}>全部跳过（非 E 文件格式）</b>
                        }
                      </span>
                    ) : (
                      <span style={{ fontSize: 11, color: '#64748b' }}>
                        共 <b style={{ color: '#374151' }}>{dirEntries.length}</b> 个文件，已选 <b style={{ color: '#2563eb' }}>{checkedCount}</b> 个
                      </span>
                    )}
                    <div style={{ display: 'flex', gap: 6 }}>
                      {!isRunning && !isDone && (
                        <>
                          <SmallBtn label="全选" onClick={() => setDirEntries((p) => p.map((e) => ({ ...e, checked: true })))} />
                          <SmallBtn label="全不选" onClick={() => setDirEntries((p) => p.map((e) => ({ ...e, checked: false })))} />
                        </>
                      )}
                      <SmallBtn label="重新选择" onClick={() => { if (!isRunning) dirInputRef.current?.click() }} />
                    </div>
                  </div>

                  {/* Progress bar */}
                  {(isRunning || isDone) && (
                    <div style={{ height: 4, background: '#e2e8f0', borderRadius: 2, overflow: 'hidden', flexShrink: 0 }}>
                      <div style={{
                        height: '100%',
                        width: `${progressPct}%`,
                        background: isDone && skippedCount === totalCount ? '#f59e0b' : '#2563eb',
                        borderRadius: 2,
                        transition: 'width 0.25s ease',
                      }} />
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
                          {/* Folder row */}
                          <div
                            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 10px', paddingLeft: 10 + depth * 16, background: '#f8fafc', borderBottom: '1px solid #e2e8f0', cursor: 'pointer', userSelect: 'none' }}
                            onClick={() => toggleCollapseDir(dir)}
                          >
                            {!isRunning && !isDone && (
                              <input
                                type="checkbox"
                                checked={allChecked}
                                ref={(el) => { if (el) el.indeterminate = someChecked && !allChecked }}
                                onClick={(e) => e.stopPropagation()}
                                onChange={() => toggleDirCheck(dir)}
                                style={{ cursor: 'pointer', flexShrink: 0 }}
                              />
                            )}
                            <ChevronRight
                              size={12}
                              style={{ color: '#64748b', flexShrink: 0, transition: 'transform 0.15s', transform: isCollapsed ? 'rotate(0deg)' : 'rotate(90deg)' }}
                            />
                            <Folder size={13} style={{ color: '#f59e0b', flexShrink: 0 }} />
                            <span style={{ fontSize: 12, fontWeight: 600, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{displayName}</span>
                            <span style={{ fontSize: 11, color: '#94a3b8', flexShrink: 0 }}>{items.length} 个</span>
                          </div>

                          {/* Files in this folder */}
                          {!isCollapsed && items.map((entry) => {
                            const status: FileStatus = fileStatuses[entry.path] ?? 'idle'
                            const inScope = toImportPaths.has(entry.path)
                            return (
                              <div
                                key={entry.path}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: 8,
                                  padding: '6px 10px', paddingLeft: 28 + depth * 16,
                                  borderBottom: '1px solid #f8fafc',
                                  background: status === 'done' ? '#f0fdf4' : status === 'skipped' ? '#fffbeb' : '#fff',
                                  cursor: isRunning || isDone ? 'default' : 'pointer',
                                  transition: 'background 0.2s',
                                }}
                                onClick={() => { if (!isRunning && !isDone) toggleEntryCheck(entry.path) }}
                              >
                                {!isRunning && !isDone ? (
                                  <input
                                    type="checkbox"
                                    checked={entry.checked}
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={() => toggleEntryCheck(entry.path)}
                                    style={{ cursor: 'pointer', flexShrink: 0 }}
                                  />
                                ) : (
                                  <div style={{ width: 14, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    {!inScope ? null
                                      : status === 'importing' ? <Loader2 size={13} style={{ color: '#2563eb', animation: 'importSpin 0.8s linear infinite' }} />
                                      : status === 'done' ? <CheckCircle size={13} style={{ color: '#16a34a' }} />
                                      : status === 'skipped' ? <AlertCircle size={13} style={{ color: '#d97706' }} />
                                      : <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#e2e8f0', display: 'inline-block' }} />
                                    }
                                  </div>
                                )}
                                <FileText size={12} style={{ color: status === 'done' ? '#16a34a' : status === 'skipped' ? '#d97706' : '#94a3b8', flexShrink: 0 }} />
                                <span style={{
                                  fontSize: 11,
                                  color: status === 'done' ? '#15803d' : status === 'skipped' ? '#92400e' : '#374151',
                                  flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                  fontWeight: status === 'done' || status === 'skipped' ? 600 : 400,
                                }}>
                                  {entry.name}
                                </span>
                                <span style={{ fontSize: 10, color: '#94a3b8', flexShrink: 0 }}>
                                  {status === 'done' ? '已导入' : status === 'skipped' ? '已跳过' : formatFileSize(entry.file.size)}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      )
                    })}
                  </div>

                  {error && <ErrorBox message={error} />}

                  {isDone ? (
                    <button
                      onClick={onClose}
                      style={{ width: '100%', padding: '9px 0', fontSize: 13, fontWeight: 600, color: '#fff', background: doneCount > 0 ? '#16a34a' : '#d97706', border: 'none', borderRadius: 8, cursor: 'pointer', flexShrink: 0 }}
                    >
                      {doneCount > 0 ? `完成（已导入 ${doneCount} 个）` : '关闭'}
                    </button>
                  ) : (
                    <ImportBtn
                      label={isRunning ? `导入中… ${processedCount} / ${totalCount}` : `导入选中文件 (${checkedCount})`}
                      disabled={checkedCount === 0 || isRunning}
                      onClick={handleDirImport}
                    />
                  )}
                </>
              )
            })()}
          </>
        )}
      </div>
    </Modal>
  )
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
    <button
      onClick={onClick}
      disabled={disabled}
      style={{ width: '100%', padding: '9px 0', fontSize: 13, fontWeight: 600, color: '#fff', background: disabled ? '#93c5fd' : '#2563eb', border: 'none', borderRadius: 8, cursor: disabled ? 'not-allowed' : 'pointer', transition: 'background 0.15s', flexShrink: 0 }}
    >
      {label}
    </button>
  )
}

function SmallBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{ padding: '4px 10px', fontSize: 11, fontWeight: 500, color: '#475569', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 5, cursor: 'pointer' }}
    >
      {label}
    </button>
  )
}
