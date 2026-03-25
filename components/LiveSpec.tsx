'use client'

import { useState, useEffect, useCallback } from 'react'
import { allSpecs } from '@/live-spec.all'

interface LiveSpecProps {
  content: string
  pageName?: string
}

type CopyState = 'idle' | 'copied'

export default function LiveSpec({ content, pageName = '当前页面' }: LiveSpecProps) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [copyCurrentState, setCopyCurrentState] = useState<CopyState>('idle')
  const [copyAllState, setCopyAllState] = useState<CopyState>('idle')

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleCopy = useCallback(
    async (type: 'current' | 'all') => {
      const text = type === 'current' ? content : allSpecs
      try {
        await navigator.clipboard.writeText(text)
        if (type === 'current') {
          setCopyCurrentState('copied')
          setTimeout(() => setCopyCurrentState('idle'), 1800)
        } else {
          setCopyAllState('copied')
          setTimeout(() => setCopyAllState('idle'), 1800)
        }
      } catch {}
    },
    [content]
  )

  if (!mounted) return null

  return (
    <>
      {/* 悬浮球 */}
      <button
        onClick={() => setOpen(true)}
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 9998,
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          background: '#D60078',
          color: '#fff',
          border: 'none',
          cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(214,0,120,0.35)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '15px',
          fontWeight: 700,
          fontFamily: '"SF Pro Display", "Helvetica Neue", Arial, sans-serif',
          letterSpacing: '-0.5px',
          transition: 'opacity 0.15s, box-shadow 0.15s',
          userSelect: 'none',
        }}
        onMouseEnter={e => {
          ;(e.currentTarget as HTMLButtonElement).style.opacity = '0.88'
          ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 14px rgba(214,0,120,0.45)'
        }}
        onMouseLeave={e => {
          ;(e.currentTarget as HTMLButtonElement).style.opacity = '1'
          ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '0 2px 8px rgba(214,0,120,0.35)'
        }}
        title="查看需求文档 · live-spec"
        aria-label="查看需求文档"
      >
        Z
      </button>

      {/* 遮罩 */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9998,
            background: 'rgba(0,0,0,0.25)',
            backdropFilter: 'blur(1px)',
          }}
        />
      )}

      {/* 抽屉面板 */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          zIndex: 9999,
          height: '100%',
          width: '500px',
          background: '#fff',
          boxShadow: '-4px 0 32px rgba(0,0,0,0.12)',
          display: 'flex',
          flexDirection: 'column',
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        {/* 头部 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 18px 12px',
            borderBottom: '1px solid #f0f0f0',
            flexShrink: 0,
            background: '#fafafa',
          }}
        >
          <div>
            <div style={{ fontSize: '10px', color: '#aaa', letterSpacing: '0.05em', marginBottom: '2px' }}>
              LIVE SPEC
            </div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#1a1a1a' }}>
              {pageName}
            </div>
          </div>

          {/* 复制按钮组 + 关闭 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <CopyButton
              label="复制当前"
              state={copyCurrentState}
              onClick={() => handleCopy('current')}
            />
            <CopyButton
              label="复制全部"
              state={copyAllState}
              onClick={() => handleCopy('all')}
            />
            <button
              onClick={() => setOpen(false)}
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '6px',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#999',
                fontSize: '18px',
                lineHeight: 1,
                marginLeft: '2px',
              }}
              onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.background = '#f0f0f0')}
              onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.background = 'transparent')}
            >
              ×
            </button>
          </div>
        </div>

        {/* 需求内容 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px' }}>
          <pre
            style={{
              fontFamily: '"JetBrains Mono", "Fira Code", "SF Mono", Menlo, monospace',
              fontSize: '12px',
              lineHeight: '1.8',
              color: '#374151',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              margin: 0,
            }}
          >
            {content}
          </pre>
        </div>

        {/* 底部 */}
        <div
          style={{
            padding: '8px 18px',
            borderTop: '1px solid #f0f0f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
            background: '#fafafa',
          }}
        >
          <span style={{ fontSize: '11px', color: '#ccc' }}>
            仅开发环境可见 · live-spec skill
          </span>
          <span style={{ fontSize: '11px', color: '#ccc' }}>
            {content.split('\n').filter(Boolean).length} 行
          </span>
        </div>
      </div>
    </>
  )
}

// 复制按钮子组件
function CopyButton({
  label,
  state,
  onClick,
}: {
  label: string
  state: CopyState
  onClick: () => void
}) {
  const copied = state === 'copied'
  return (
    <button
      onClick={onClick}
      style={{
        height: '28px',
        padding: '0 10px',
        borderRadius: '6px',
        border: `1px solid ${copied ? '#22c55e' : '#e5e7eb'}`,
        background: copied ? '#f0fdf4' : '#fff',
        color: copied ? '#16a34a' : '#555',
        fontSize: '12px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        transition: 'all 0.15s',
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={e => {
        if (!copied)
          (e.currentTarget as HTMLButtonElement).style.borderColor = '#6366f1'
      }}
      onMouseLeave={e => {
        if (!copied)
          (e.currentTarget as HTMLButtonElement).style.borderColor = '#e5e7eb'
      }}
    >
      <span>{copied ? '✓' : '⎘'}</span>
      <span>{copied ? '已复制' : label}</span>
    </button>
  )
}

// live-spec skill v2
