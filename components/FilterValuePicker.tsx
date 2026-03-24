'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'

const PAGE_SIZE = 10

interface Props {
  value: string
  onChange: (v: string) => void
  distinctValues: string[]
  placeholder?: string
  style?: React.CSSProperties
}

export function FilterValuePicker({ value, onChange, distinctValues, placeholder = '值...', style }: Props) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [anchor, setAnchor] = useState<{ top: number; left: number; width: number } | null>(null)
  const [mounted, setMounted] = useState(false)
  const triggerRef = useRef<HTMLDivElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (
        dropRef.current && !dropRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const filtered = useMemo(() => {
    if (!search) return distinctValues
    const q = search.toLowerCase()
    return distinctValues.filter((v) => v.toLowerCase().includes(q))
  }, [distinctValues, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageVals = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function openDropdown() {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const w = Math.max(rect.width, 180)
    const left = Math.min(rect.left, window.innerWidth - w - 8)
    // Flip up if too close to bottom
    const spaceBelow = window.innerHeight - rect.bottom
    const dropH = Math.min(filtered.length * 33 + 80, 320)
    const top = spaceBelow < dropH && rect.top > dropH ? rect.top - dropH - 2 : rect.bottom + 2
    setAnchor({ top, left, width: w })
    setSearch('')
    setPage(1)
    setOpen(true)
  }

  function select(v: string) {
    onChange(v)
    setOpen(false)
  }

  return (
    <>
      <div ref={triggerRef} style={{ position: 'relative', display: 'flex', alignItems: 'center', ...style }}>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          style={{
            flex: 1, border: '1px solid #e2e8f0', borderRadius: 4,
            padding: distinctValues.length > 0 ? '3px 22px 3px 5px' : '3px 5px',
            fontSize: 10, outline: 'none', background: '#fff', color: '#0f172a',
            width: '100%', boxSizing: 'border-box', minWidth: 0,
          }}
        />
        {distinctValues.length > 0 && (
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); open ? setOpen(false) : openDropdown() }}
            style={{
              position: 'absolute', right: 3, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer',
              color: open ? '#2563eb' : '#94a3b8', display: 'flex', alignItems: 'center', padding: 0,
            }}
          >
            <ChevronDown size={10} />
          </button>
        )}
      </div>

      {mounted && open && anchor && createPortal(
        <div
          ref={dropRef}
          style={{
            position: 'fixed', top: anchor.top, left: anchor.left,
            width: anchor.width, minWidth: 160, maxWidth: 280,
            background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8,
            boxShadow: '0 6px 24px rgba(0,0,0,0.13)', zIndex: 99999, overflow: 'hidden',
          }}
        >
          {/* Search */}
          <div style={{ padding: '6px 8px', borderBottom: '1px solid #f1f5f9' }}>
            <input
              autoFocus
              type="text"
              placeholder="搜索..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              style={{ width: '100%', fontSize: 11, padding: '3px 7px', border: '1px solid #e2e8f0', borderRadius: 4, outline: 'none', color: '#0f172a', boxSizing: 'border-box' }}
            />
          </div>

          {/* Count */}
          <div style={{ padding: '2px 10px 3px', fontSize: 10, color: '#94a3b8', background: '#fafafa', borderBottom: '1px solid #f1f5f9' }}>
            {filtered.length} 项
          </div>

          {/* Values */}
          <div style={{ maxHeight: 220, overflowY: 'auto' }}>
            {pageVals.length === 0 ? (
              <div style={{ padding: '12px 8px', textAlign: 'center', fontSize: 11, color: '#94a3b8' }}>无匹配项</div>
            ) : pageVals.map((v) => (
              <div
                key={v}
                onClick={() => select(v)}
                style={{
                  padding: '6px 10px', fontSize: 11, cursor: 'pointer',
                  color: v === value ? '#2563eb' : '#374151',
                  fontWeight: v === value ? 600 : 400,
                  borderBottom: '1px solid #f8fafc',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#f0f7ff' }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = '' }}
              >
                {v === '' ? <em style={{ color: '#94a3b8' }}>(空)</em> : v}
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ padding: '5px 10px', borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc' }}>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                style={{ width: 20, height: 20, border: '1px solid #e2e8f0', borderRadius: 4, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.4 : 1, color: '#475569' }}
              >
                <ChevronLeft size={10} />
              </button>
              <span style={{ fontSize: 10, color: '#64748b' }}>{page} / {totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                style={{ width: 20, height: 20, border: '1px solid #e2e8f0', borderRadius: 4, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: page === totalPages ? 'not-allowed' : 'pointer', opacity: page === totalPages ? 0.4 : 1, color: '#475569' }}
              >
                <ChevronRight size={10} />
              </button>
            </div>
          )}
        </div>,
        document.body
      )}
    </>
  )
}
