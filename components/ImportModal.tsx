'use client'

import { useState, useRef } from 'react'
import { Upload, FileText, X, AlertCircle } from 'lucide-react'
import { Modal } from './Modal'
import { useApp } from '@/context/AppContext'
import { formatFileSize } from '@/lib/utils'
import type { HistoryRecord } from '@/types'

interface Props {
  onClose: () => void
}

export default function ImportModal({ onClose }: Props) {
  const { addHistory, activeCaseId } = useApp()
  const [activeTab, setActiveTab] = useState<'text' | 'file'>('text')
  const [textInput, setTextInput] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [importing, setImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
    if (saved) {
      addHistory(saved)
      onClose()
      setTextInput('')
    }
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
    let success = 0, fail = 0
    const saved: HistoryRecord[] = []

    for (const file of files) {
      try {
        const content = await readFile(file)
        const { data, error: parseErr } = await callParse(content, file.name)
        if (parseErr) { fail++; continue }
        const record = await saveHistory(activeCaseId, data)
        if (record) { saved.push(record); success++ }
        else fail++
      } catch { fail++ }
    }

    // 按倒序 addHistory（让第一个文件排在最前）
    for (const r of [...saved].reverse()) addHistory(r)
    if (fail > 0) alert(`导入完成：成功 ${success} 个，失败 ${fail} 个`)
    setImporting(false)
    onClose()
    setFiles([])
  }

  return (
    <Modal isOpen onClose={onClose} title="导入新数据" width="600px" height="auto">
      <div className="p-4">
        {/* Tabs */}
        <div className="flex border rounded-lg overflow-hidden mb-4" style={{ borderColor: 'var(--border)' }}>
          {(['text', 'file'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 text-xs font-medium transition-colors ${activeTab === tab ? 'text-white' : 'hover:bg-gray-50'}`}
              style={activeTab === tab ? { background: 'var(--accent)' } : { color: 'var(--text2)' }}
            >
              {tab === 'text' ? '粘贴文本' : `批量导入${files.length > 0 ? ` (${files.length})` : ''}`}
            </button>
          ))}
        </div>

        {activeTab === 'text' ? (
          <div className="space-y-3">
            <textarea
              className="w-full h-[250px] p-3 border rounded-lg font-mono text-[10px] outline-none resize-none"
              style={{ borderColor: 'var(--border)', background: '#f8fafc', color: 'var(--text)' }}
              placeholder={`<! Grid=广东 Time='2025-03-06 17:15:10' Type=日前 !>\n<SystemBalance>\n@ ResultID PeriodID Value\n// 结果ID 时段 数值\nN0000 1 15255.26\n</SystemBalance>`}
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
            />
            {error && (
              <div className="flex items-center gap-2 text-xs bg-red-50 border border-red-200 rounded-lg p-2.5" style={{ color: 'var(--danger)' }}>
                <AlertCircle size={14} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}
            <button
              onClick={handleTextImport}
              disabled={importing}
              className="w-full py-2 text-xs font-medium text-white rounded-lg disabled:opacity-60 transition-opacity"
              style={{ background: 'var(--accent)' }}
            >
              {importing ? '解析中...' : '解析并导入'}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div
              className={`border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center cursor-pointer transition-colors ${isDragging ? 'border-blue-500 bg-blue-50' : 'hover:border-blue-400'}`}
              style={{ borderColor: isDragging ? undefined : 'var(--border)' }}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files) addFiles(Array.from(e.dataTransfer.files)) }}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={28} className="mb-2" style={{ color: 'var(--text3)' }} />
              <p className="text-xs font-medium" style={{ color: 'var(--text)' }}>点击或拖拽文件到此处</p>
              <p className="text-[10px] mt-1" style={{ color: 'var(--text3)' }}>支持 .txt .e .dat .csv .log</p>
              <input ref={fileInputRef} type="file" multiple accept=".txt,.e,.dat,.csv,.log,text/*" className="hidden"
                onChange={(e) => { if (e.target.files) addFiles(Array.from(e.target.files)) }} />
            </div>

            {files.length > 0 && (
              <div className="max-h-[150px] overflow-y-auto border rounded-lg divide-y" style={{ borderColor: 'var(--border)' }}>
                {files.map((f, i) => (
                  <div key={i} className="flex items-center justify-between p-2 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <FileText size={14} style={{ color: 'var(--text3)' }} className="shrink-0" />
                      <div className="overflow-hidden">
                        <div className="text-[10px] font-medium truncate" style={{ color: 'var(--text)' }}>{f.name}</div>
                        <div className="text-[9px]" style={{ color: 'var(--text3)' }}>{formatFileSize(f.size)}</div>
                      </div>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); setFiles(files.filter((_, idx) => idx !== i)) }} className="p-1 rounded hover:bg-red-50" style={{ color: 'var(--text3)' }}>
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={handleBatchImport}
              disabled={files.length === 0 || importing}
              className="w-full py-2 text-xs font-medium text-white rounded-lg disabled:opacity-60 transition-opacity"
              style={{ background: 'var(--accent)' }}
            >
              {importing ? '导入中...' : `开始批量导入${files.length > 0 ? ` (${files.length})` : ''}`}
            </button>
          </div>
        )}
      </div>
    </Modal>
  )
}
