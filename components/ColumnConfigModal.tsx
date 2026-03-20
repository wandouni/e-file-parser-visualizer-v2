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
  const { updateHistory, showToast } = useApp()
  const [tempConfig, setTempConfig] = useState<Record<string, boolean>>({})

  useEffect(() => { setTempConfig({ ...record.colConfig }) }, [record])

  function handleApply() {
    updateHistory({ ...record, colConfig: tempConfig })
    showToast('显示配置已保存')
    onClose()
  }

  const selected = Object.values(tempConfig).filter(Boolean).length

  return (
    <Modal isOpen onClose={onClose} title="列显示配置" width="480px" height="70vh">
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, background: '#fff' }}>

        {/* 操作栏 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 16 }}>
            <button
              onClick={() => { const c: Record<string, boolean> = {}; record.fields.forEach((f) => (c[f] = true)); setTempConfig(c) }}
              style={{ fontSize: 12, fontWeight: 600, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >全选</button>
            <button
              onClick={() => { const c: Record<string, boolean> = {}; record.fields.forEach((f) => (c[f] = false)); setTempConfig(c) }}
              style={{ fontSize: 12, fontWeight: 600, color: '#475569', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >全隐藏</button>
          </div>
          <span style={{ fontSize: 11, color: '#94a3b8' }}>已选 {selected} / {record.fields.length} 列</span>
        </div>

        {/* 复选框网格 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {record.fields.map((field, i) => (
              <label
                key={field}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                  padding: '8px 10px', border: `1px solid ${tempConfig[field] ? '#2563eb' : '#e2e8f0'}`,
                  borderRadius: 8, background: tempConfig[field] ? '#eff6ff' : '#fff',
                  transition: 'border-color 0.12s, background 0.12s',
                }}
              >
                <input
                  type="checkbox"
                  checked={!!tempConfig[field]}
                  onChange={() => setTempConfig((prev) => ({ ...prev, [field]: !prev[field] }))}
                  style={{ width: 14, height: 14, accentColor: '#2563eb', flexShrink: 0 }}
                />
                <span
                  style={{ fontSize: 11, fontWeight: 500, color: tempConfig[field] ? '#2563eb' : '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  title={record.labels[i] || field}
                >
                  {record.labels[i] || field}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* 底部按钮 */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 16px', borderTop: '1px solid #e2e8f0', background: '#f8fafc', flexShrink: 0 }}>
          <button
            onClick={onClose}
            style={{ padding: '7px 20px', fontSize: 12, fontWeight: 500, border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', color: '#475569', cursor: 'pointer' }}
          >取消</button>
          <button
            onClick={handleApply}
            style={{ padding: '7px 24px', fontSize: 12, fontWeight: 600, border: 'none', borderRadius: 8, background: '#2563eb', color: '#fff', cursor: 'pointer' }}
          >应用配置</button>
        </div>
      </div>
    </Modal>
  )
}
