'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle, XCircle, Info, X } from 'lucide-react'

export interface ToastItem {
  id: string
  message: string
  type: 'success' | 'error' | 'info'
}

interface ContainerProps {
  toasts: ToastItem[]
  onRemove: (id: string) => void
}

export default function ToastContainer({ toasts, onRemove }: ContainerProps) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null
  return createPortal(
    <>
      <style>{`
        @keyframes toast-in {
          from { opacity: 0; transform: translateY(-12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div style={{ position: 'fixed', top: 80, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none', alignItems: 'center' }}>
        {toasts.map((t) => <Toast key={t.id} toast={t} onRemove={onRemove} />)}
      </div>
    </>,
    document.body
  )
}

function Toast({ toast, onRemove }: { toast: ToastItem; onRemove: (id: string) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onRemove(toast.id), 2800)
    return () => clearTimeout(timer)
  }, [toast.id, onRemove])

  const palette = {
    success: { bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d', icon: '#22c55e' },
    error:   { bg: '#fef2f2', border: '#fecaca', text: '#dc2626', icon: '#ef4444' },
    info:    { bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8', icon: '#3b82f6' },
  }
  const c = palette[toast.type]
  const Icon = toast.type === 'success' ? CheckCircle : toast.type === 'error' ? XCircle : Info

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
      background: c.bg, border: `1px solid ${c.border}`, borderRadius: 10,
      boxShadow: '0 4px 16px rgba(0,0,0,0.12)', pointerEvents: 'all',
      minWidth: 220, maxWidth: 360, animation: 'toast-in 0.2s ease-out',
    }}>
      <Icon size={16} color={c.icon} style={{ flexShrink: 0 }} />
      <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: c.text, lineHeight: 1.4 }}>{toast.message}</span>
      <button onClick={() => onRemove(toast.id)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: c.icon, display: 'flex', alignItems: 'center', padding: 2, flexShrink: 0, opacity: 0.7 }}>
        <X size={12} />
      </button>
    </div>
  )
}
