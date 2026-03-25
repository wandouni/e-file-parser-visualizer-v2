'use client'

import { useEffect, useId } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  children: React.ReactNode
  title?: string
  width?: string
  height?: string
}

export function Modal({ isOpen, onClose, children, title, width = '640px', height }: ModalProps) {
  const titleId = useId()

  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? titleId : undefined}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      <div style={{ background: '#fff', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', width: `min(${width}, calc(100vw - 32px))`, height: height || 'auto', maxHeight: '92vh', overflow: 'hidden', borderRadius: 10, border: '1px solid #e2e8f0' }}>
        {title && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', flexShrink: 0 }}>
            <h3 id={titleId} style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', margin: 0 }}>{title}</h3>
            <button onClick={onClose} aria-label="关闭" style={{ padding: 4, border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center', borderRadius: 4 }}>
              <X size={15} aria-hidden="true" />
            </button>
          </div>
        )}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>{children}</div>
      </div>
    </div>,
    document.body
  )
}

interface ConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title?: string
  message: string
  confirmText?: string
  cancelText?: string
}

export function ConfirmModal({ isOpen, onClose, onConfirm, title, message, confirmText = '确定', cancelText = '取消' }: ConfirmModalProps) {
  const titleId = useId()
  const descId = useId()

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return createPortal(
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={title ? titleId : undefined}
      aria-describedby={descId}
      style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(0,0,0,0.55)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: '#fff', borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.18)', width: '100%', maxWidth: 280, overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px 12px' }}>
          {title && <p id={titleId} style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', margin: '0 0 4px' }}>{title}</p>}
          <p id={descId} style={{ fontSize: 12, color: '#64748b', margin: 0, lineHeight: 1.5 }}>{message}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, padding: '0 12px 12px', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{ padding: '5px 14px', fontSize: 12, fontWeight: 500, color: '#475569', background: '#f1f5f9', border: 'none', borderRadius: 6, cursor: 'pointer' }}
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            style={{ padding: '5px 14px', fontSize: 12, fontWeight: 600, color: '#fff', background: '#ef4444', border: 'none', borderRadius: 6, cursor: 'pointer' }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
