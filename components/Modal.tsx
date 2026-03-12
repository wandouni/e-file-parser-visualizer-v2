'use client'

import { useEffect } from 'react'
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
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  if (!isOpen) return null

  return createPortal(
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div
        className="bg-white shadow-2xl flex flex-col max-h-[90vh] overflow-hidden rounded-lg border"
        style={{ width, height, borderColor: 'var(--border)' }}
      >
        {title && (
          <div className="flex items-center justify-between px-4 py-2.5 border-b shrink-0" style={{ borderColor: 'var(--border)', background: '#f8fafc' }}>
            <h3 className="text-xs font-bold" style={{ color: 'var(--text)' }}>{title}</h3>
            <button onClick={onClose} className="p-1 rounded hover:bg-red-50 transition-colors" style={{ color: 'var(--text3)' }}>
              <X size={15} />
            </button>
          </div>
        )}
        <div className="flex-1 overflow-auto">{children}</div>
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
  if (!isOpen) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white shadow-2xl border rounded-xl w-full max-w-sm overflow-hidden" style={{ borderColor: 'var(--border)' }}>
        <div className="p-6">
          {title && <p className="text-sm font-bold mb-2" style={{ color: 'var(--text)' }}>{title}</p>}
          <p className="text-xs leading-relaxed" style={{ color: 'var(--text2)' }}>{message}</p>
        </div>
        <div className="flex border-t" style={{ borderColor: 'var(--border)' }}>
          <button onClick={onClose} className="flex-1 px-4 py-3 text-xs font-medium hover:bg-gray-50 transition-colors border-r" style={{ color: 'var(--text2)', borderColor: 'var(--border)' }}>
            {cancelText}
          </button>
          <button onClick={onConfirm} className="flex-1 px-4 py-3 text-xs font-medium hover:bg-blue-50 transition-colors" style={{ color: 'var(--accent)' }}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
