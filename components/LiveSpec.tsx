'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { allSpecs } from '@/live-spec.all'

export interface SpecVersion {
  version: string
  label: string
  note: string
  createdAt: string
  spec: string
}

interface LiveSpecProps {
  content: string
  pageName?: string
  history?: SpecVersion[]
}

type CopyState = 'idle' | 'copied'

type DiffLine = { text: string; type: 'added' | 'removed' | 'modified' | 'unchanged' }

// 按编号分节，将每节的描述行也纳入对比
function computeDiff(prevSpec: string, currSpec: string): DiffLine[] {
  const getKey = (line: string) => {
    const m = line.match(/^\s*([\d]+(?:\.[\d]+)*)\s/)
    return m ? m[1] : null
  }

  // 把 spec 按编号行分节：每节 = header 行 + 紧随的非编号描述行
  const buildSections = (lines: string[]) => {
    const map = new Map<string, { header: string; descs: string[] }>()
    let cur: string | null = null
    for (const line of lines) {
      const k = getKey(line)
      if (k !== null) {
        cur = k
        map.set(k, { header: line, descs: [] })
      } else if (cur) {
        map.get(cur)!.descs.push(line)
      }
    }
    return map
  }

  const prevSecs = buildSections(prevSpec.split('\n'))
  const currSecs = buildSections(currSpec.split('\n'))
  const result: DiffLine[] = []

  let currentKey: string | null = null
  let descIdx = 0

  for (const line of currSpec.split('\n')) {
    const k = getKey(line)
    if (k !== null) {
      currentKey = k
      descIdx = 0
      if (!prevSecs.has(k)) {
        result.push({ text: '+ ' + line, type: 'added' })
      } else if (prevSecs.get(k)!.header !== line) {
        result.push({ text: '~ ' + line, type: 'modified' })
      } else {
        result.push({ text: line, type: 'unchanged' })
      }
    } else if (!line.trim()) {
      result.push({ text: line, type: 'unchanged' })
    } else {
      // 描述行：与上一版本同节同位置的描述行对比
      if (currentKey && prevSecs.has(currentKey)) {
        const prevDescs = prevSecs.get(currentKey)!.descs.filter(d => d.trim())
        const p = prevDescs[descIdx]
        if (p === undefined) {
          result.push({ text: '+ ' + line, type: 'added' })
        } else if (p !== line) {
          result.push({ text: '~ ' + line, type: 'modified' })
        } else {
          result.push({ text: line, type: 'unchanged' })
        }
      } else if (currentKey && !prevSecs.has(currentKey)) {
        result.push({ text: '+ ' + line, type: 'added' })
      } else {
        result.push({ text: line, type: 'unchanged' })
      }
      descIdx++
    }
  }

  // 追加在 prev 中存在、curr 中已删除的节
  for (const [k, sec] of prevSecs) {
    if (!currSecs.has(k)) {
      result.push({ text: '- ' + sec.header, type: 'removed' })
      for (const d of sec.descs.filter(d => d.trim())) {
        result.push({ text: '- ' + d, type: 'removed' })
      }
    }
  }

  return result
}

export default function LiveSpec({
  content,
  pageName = '当前页面',
  history = [],
}: LiveSpecProps) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [copyCurrentState, setCopyCurrentState] = useState<CopyState>('idle')
  const [copyAllState, setCopyAllState] = useState<CopyState>('idle')

  const [selectedIdx, setSelectedIdx] = useState(history.length - 1)

  const selectedVersion = history[selectedIdx] ?? history[0]

  const diffLines = useMemo(() => {
    if (!selectedVersion || selectedIdx === 0) return null
    const prev = history[selectedIdx - 1].spec
    return computeDiff(prev, selectedVersion.spec)
  }, [selectedIdx, history, selectedVersion])

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    setSelectedIdx(history.length - 1)
  }, [history.length])

  const handleCopy = useCallback(async (type: 'current' | 'all') => {
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
  }, [content])

  if (!mounted) return null

  const lineColor = {
    added:     { bg: 'rgba(34,197,94,0.10)',  text: '#15803d' },
    removed:   { bg: 'rgba(239,68,68,0.10)',   text: '#b91c1c' },
    modified:  { bg: 'rgba(234,179,8,0.12)',   text: '#92400e' },
    unchanged: { bg: 'transparent',            text: '#374151' },
  }

  return (
    <>
      {/* 悬浮球 */}
      <button
        onClick={() => setOpen(true)}
        style={{
          position: 'fixed', bottom: '24px', right: '24px', zIndex: 9998,
          width: '40px', height: '40px', borderRadius: '50%',
          background: '#D60078', color: '#fff', border: 'none', cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(214,0,120,0.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '15px', fontWeight: 700,
          fontFamily: '"SF Pro Display", "Helvetica Neue", Arial, sans-serif',
          letterSpacing: '-0.5px', transition: 'opacity 0.15s, box-shadow 0.15s',
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
            position: 'fixed', inset: 0, zIndex: 9998,
            background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(1px)',
          }}
        />
      )}

      {/* 抽屉 */}
      <div style={{
        position: 'fixed', top: 0, right: 0, zIndex: 9999,
        height: '100%', width: '500px', background: '#fff',
        boxShadow: '-4px 0 32px rgba(0,0,0,0.12)',
        display: 'flex', flexDirection: 'column',
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)',
      }}>

        {/* 头部 */}
        <div style={{
          padding: '14px 18px 12px', borderBottom: '1px solid #f0f0f0',
          flexShrink: 0, background: '#fafafa',
        }}>
          {/* 第一行：标题 + 复制 + 关闭 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <div>
              <div style={{ fontSize: '10px', color: '#aaa', letterSpacing: '0.05em', marginBottom: '2px' }}>LIVE SPEC</div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#1a1a1a' }}>{pageName}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CopyButton label="复制当前" state={copyCurrentState} onClick={() => handleCopy('current')} />
              <CopyButton label="复制全部" state={copyAllState} onClick={() => handleCopy('all')} />
              <button
                onClick={() => setOpen(false)}
                style={{
                  width: '28px', height: '28px', borderRadius: '6px',
                  border: 'none', background: 'transparent', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#999', fontSize: '18px', lineHeight: 1, marginLeft: '2px',
                }}
                onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.background = '#f0f0f0')}
                onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.background = 'transparent')}
              >×</button>
            </div>
          </div>

          {/* 第二行：版本下拉 + diff 图例 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <select
              value={selectedIdx}
              onChange={e => setSelectedIdx(Number(e.target.value))}
              style={{
                height: '28px', padding: '0 8px', borderRadius: '6px',
                border: '1px solid #e5e7eb', background: '#fff',
                fontSize: '12px', color: '#374151', cursor: 'pointer',
                flex: 1, maxWidth: '220px',
              }}
            >
              {history.map((v, i) => (
                <option key={i} value={i}>
                  {v.label}{v.note ? ` · ${v.note}` : ''}{i === history.length - 1 ? ' (当前版本)' : ''}
                </option>
              ))}
            </select>

            {selectedIdx > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px' }}>
                <LegendDot color="#15803d" label="新增" />
                <LegendDot color="#b91c1c" label="删除" />
                <LegendDot color="#92400e" label="修改" />
              </div>
            )}
          </div>
        </div>

        {/* 内容区 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 0' }}>
          {diffLines ? (
            <div style={{ fontFamily: '"JetBrains Mono","Fira Code","SF Mono",Menlo,monospace', fontSize: '12px', lineHeight: '1.8' }}>
              {diffLines.map((line, i) => {
                const c = lineColor[line.type]
                return (
                  <div key={i} style={{
                    background: c.bg, color: c.text,
                    padding: '0 18px', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  }}>
                    {line.text}
                  </div>
                )
              })}
            </div>
          ) : (
            <pre style={{
              fontFamily: '"JetBrains Mono","Fira Code","SF Mono",Menlo,monospace',
              fontSize: '12px', lineHeight: '1.8', color: '#374151',
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              margin: 0, padding: '0 18px',
            }}>
              {selectedVersion ? selectedVersion.spec : content}
            </pre>
          )}
        </div>

        {/* 底部 */}
        <div style={{
          padding: '8px 18px', borderTop: '1px solid #f0f0f0',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0, background: '#fafafa',
        }}>
          <span style={{ fontSize: '11px', color: '#ccc' }}>live-spec skill</span>
          <span style={{ fontSize: '11px', color: '#ccc' }}>
            {history.length > 0 ? `${history.length} 个历史版本` : '首版'}
          </span>
        </div>
      </div>
    </>
  )
}

function CopyButton({ label, state, onClick }: { label: string; state: CopyState; onClick: () => void }) {
  const copied = state === 'copied'
  return (
    <button
      onClick={onClick}
      style={{
        height: '28px', padding: '0 10px', borderRadius: '6px',
        border: `1px solid ${copied ? '#22c55e' : '#e5e7eb'}`,
        background: copied ? '#f0fdf4' : '#fff',
        color: copied ? '#16a34a' : '#555',
        fontSize: '12px', cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: '4px',
        transition: 'all 0.15s', whiteSpace: 'nowrap',
      }}
      onMouseEnter={e => { if (!copied) (e.currentTarget as HTMLButtonElement).style.borderColor = '#D60078' }}
      onMouseLeave={e => { if (!copied) (e.currentTarget as HTMLButtonElement).style.borderColor = '#e5e7eb' }}
    >
      <span>{copied ? '✓' : '⎘'}</span>
      <span>{copied ? '已复制' : label}</span>
    </button>
  )
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: '3px', color }}>
      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: color, display: 'inline-block' }} />
      {label}
    </span>
  )
}

// live-spec skill v2
