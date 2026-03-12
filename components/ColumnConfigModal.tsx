'use client'

import { useState, useEffect } from 'react'
import { Modal } from './Modal'
import { useApp } from '@/context/AppContext'
import type { HistoryRecord } from '@/types'

interface Props {
  onClose: () => void
  record: HistoryRecord
}

export default function ColumnConfigModal({ onClose, record }: Props) {
  const { updateHistory } = useApp()
  const [tempConfig, setTempConfig] = useState<Record<string, boolean>>({})

  useEffect(() => { setTempConfig({ ...record.colConfig }) }, [record])

  function handleApply() {
    updateHistory({ ...record, colConfig: tempConfig })
    onClose()
  }

  const selected = Object.values(tempConfig).filter(Boolean).length

  return (
    <Modal isOpen onClose={onClose} title="列显示配置" width="500px" height="80vh">
      <div className="flex flex-col h-full bg-white">
        {/* 操作栏 */}
        <div className="flex items-center justify-between px-4 py-2 border-b shrink-0" style={{ borderColor: 'var(--border)', background: '#f8fafc' }}>
          <div className="flex gap-4">
            <button onClick={() => { const c: Record<string, boolean> = {}; record.fields.forEach((f) => (c[f] = true)); setTempConfig(c) }}
              className="text-xs font-medium" style={{ color: 'var(--accent)' }}>全选</button>
            <button onClick={() => { const c: Record<string, boolean> = {}; record.fields.forEach((f) => (c[f] = false)); setTempConfig(c) }}
              className="text-xs font-medium" style={{ color: 'var(--text2)' }}>隐藏</button>
          </div>
          <span className="text-[10px]" style={{ color: 'var(--text3)' }}>已选择 {selected} / {record.fields.length}</span>
        </div>

        {/* 复选框网格 */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-2 gap-2">
            {record.fields.map((field, i) => (
              <label
                key={field}
                className="flex items-center gap-2 cursor-pointer p-2 border rounded-lg transition-all"
                style={{
                  borderColor: tempConfig[field] ? 'var(--accent)' : 'var(--border)',
                  background: tempConfig[field] ? 'var(--accent-light)' : 'white',
                }}
              >
                <input
                  type="checkbox"
                  checked={!!tempConfig[field]}
                  onChange={() => setTempConfig((prev) => ({ ...prev, [field]: !prev[field] }))}
                  className="w-3.5 h-3.5"
                  style={{ accentColor: 'var(--accent)' }}
                />
                <span className="text-[11px] font-medium truncate" style={{ color: tempConfig[field] ? 'var(--accent)' : 'var(--text2)' }}
                  title={record.labels[i] || field}>
                  {record.labels[i] || field}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="p-4 border-t shrink-0 flex justify-end gap-2" style={{ borderColor: 'var(--border)', background: '#f8fafc' }}>
          <button onClick={onClose} className="px-5 py-1.5 text-xs font-medium border rounded-lg hover:bg-gray-50 transition-colors"
            style={{ borderColor: 'var(--border)', color: 'var(--text2)' }}>取消</button>
          <button onClick={handleApply} className="px-6 py-1.5 text-xs font-medium text-white rounded-lg transition-opacity hover:opacity-90"
            style={{ background: 'var(--accent)' }}>应用配置</button>
        </div>
      </div>
    </Modal>
  )
}
