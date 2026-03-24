'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Link as LinkIcon, X, ChevronLeft, Edit3, Search, Folder, ChevronRight } from 'lucide-react'
import { useApp } from '@/context/AppContext'
import { ConfirmModal } from './Modal'
import type { HistoryRecord } from '@/types'

interface SidebarProps {
  onImport: () => void
  onJoin: () => void
}

type FolderNode = {
  name: string
  path: string
  items: HistoryRecord[]
  children: FolderNode[]
}

function buildFolderTree(records: HistoryRecord[]): { ungrouped: HistoryRecord[]; roots: FolderNode[] } {
  const ungrouped: HistoryRecord[] = []
  const nodeMap = new Map<string, FolderNode>()

  for (const r of records) {
    const folder = r.meta?.__folder__ as string | undefined
    if (!folder) { ungrouped.push(r); continue }

    const parts = folder.split('/')
    for (let i = 0; i < parts.length; i++) {
      const path = parts.slice(0, i + 1).join('/')
      if (!nodeMap.has(path)) {
        nodeMap.set(path, { name: parts[i], path, items: [], children: [] })
      }
    }
    nodeMap.get(folder)!.items.push(r)
  }

  // attach children to parent nodes
  for (const [path, node] of nodeMap) {
    const lastSlash = path.lastIndexOf('/')
    if (lastSlash > 0) {
      const parentPath = path.slice(0, lastSlash)
      const parent = nodeMap.get(parentPath)
      if (parent && !parent.children.find((c) => c.path === path)) {
        parent.children.push(node)
      }
    }
  }

  // collect root nodes
  const roots: FolderNode[] = []
  for (const [path, node] of nodeMap) {
    if (!path.includes('/')) roots.push(node)
  }

  return { ungrouped, roots }
}

function countItems(node: FolderNode): number {
  return node.items.length + node.children.reduce((s, c) => s + countItems(c), 0)
}

function collectIds(node: FolderNode): string[] {
  return [
    ...node.items.map((h) => h.id),
    ...node.children.flatMap((c) => collectIds(c)),
  ]
}

export default function Sidebar({ onImport, onJoin }: SidebarProps) {
  const router = useRouter()
  const {
    histories, currentId, setCurrentId, removeHistory, removeHistories, clearHistories,
    activeCase, renameCase, myRole,
  } = useApp()

  const [clearConfirmOpen, setClearConfirmOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleteFolderPath, setDeleteFolderPath] = useState<string | null>(null)
  const [isEditingName, setIsEditingName] = useState(false)
  const [editName, setEditName] = useState('')
  const [fileSearchTerm, setFileSearchTerm] = useState('')
  const [hoveredItem, setHoveredItem] = useState<string | null>(null)
  const [hoveredFolder, setHoveredFolder] = useState<string | null>(null)
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (activeCase) setEditName(activeCase.name)
  }, [activeCase])

  function handleSaveName() {
    if (activeCase && editName.trim() && editName !== activeCase.name) {
      renameCase(activeCase.id, editName.trim())
    }
    setIsEditingName(false)
  }

  function toggleFolder(path: string) {
    setCollapsedFolders((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  function renderHistoryItem(h: HistoryRecord, indentPx = 0) {
    const isActive = currentId === h.id
    const isHovered = hoveredItem === h.id
    return (
      <div
        key={h.id}
        onMouseEnter={() => setHoveredItem(h.id)}
        onMouseLeave={() => setHoveredItem(null)}
        onClick={() => setCurrentId(h.id)}
        style={{
          position: 'relative',
          padding: '8px 8px',
          paddingLeft: 8 + indentPx,
          cursor: 'pointer',
          borderRadius: 6,
          borderLeft: `2px solid ${isActive ? '#3b82f6' : 'transparent'}`,
          background: isActive ? 'rgba(59,130,246,0.12)' : isHovered ? 'rgba(255,255,255,0.04)' : 'transparent',
          marginBottom: 2,
          transition: 'background 0.1s',
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 700, color: isActive ? '#60a5fa' : '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 16, display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.sectionTag || '未命名'}</span>
          {(h.vizConfigs.length > 0 || h.multiSubjectConfig?.keyField) && (
            <span style={{ flexShrink: 0, width: 6, height: 6, borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
          )}
        </div>
        <div style={{ fontSize: 10, color: '#475569', marginTop: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{h.meta.Time ? h.meta.Time.substring(0, 16) : '无时间'}</span>
          <span style={{ color: 'rgba(96,165,250,0.6)' }}>{h.rows.length}条</span>
        </div>
        {(myRole === 'owner' || myRole === 'editor') && (
          <button
            onClick={(e) => { e.stopPropagation(); setDeleteId(h.id) }}
            style={{ position: 'absolute', top: 6, right: 6, background: 'none', border: 'none', cursor: 'pointer', color: '#475569', display: 'flex', alignItems: 'center', opacity: isHovered ? 1 : 0, transition: 'opacity 0.15s', padding: 2 }}
          >
            <X size={11} />
          </button>
        )}
      </div>
    )
  }

  function renderFolderNode(node: FolderNode, depth: number): React.ReactNode {
    const isCollapsed = collapsedFolders.has(node.path)
    const total = countItems(node)
    const isHovered = hoveredFolder === node.path
    const canEdit = myRole === 'owner' || myRole === 'editor'
    return (
      <div key={node.path}>
        <div
          onClick={() => toggleFolder(node.path)}
          onMouseEnter={() => setHoveredFolder(node.path)}
          onMouseLeave={() => setHoveredFolder(null)}
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 8px', paddingLeft: 8 + depth * 12, cursor: 'pointer', borderRadius: 5, marginBottom: 1, userSelect: 'none', background: isHovered ? 'rgba(255,255,255,0.04)' : 'transparent', transition: 'background 0.1s' }}
        >
          <ChevronRight
            size={11}
            style={{ color: '#475569', flexShrink: 0, transition: 'transform 0.15s', transform: isCollapsed ? 'rotate(0deg)' : 'rotate(90deg)' }}
          />
          <Folder size={12} style={{ color: '#f59e0b', flexShrink: 0 }} />
          <span style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{node.name}</span>
          <span style={{ fontSize: 10, color: '#475569', flexShrink: 0, marginRight: canEdit ? 2 : 0 }}>{total}</span>
          {canEdit && (
            <button
              onClick={(e) => { e.stopPropagation(); setDeleteFolderPath(node.path) }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', display: 'flex', alignItems: 'center', padding: 2, borderRadius: 3, opacity: isHovered ? 1 : 0, transition: 'opacity 0.15s', flexShrink: 0 }}
            >
              <X size={11} />
            </button>
          )}
        </div>
        {!isCollapsed && (
          <div>
            {node.children.map((child) => renderFolderNode(child, depth + 1))}
            {node.items.map((h) => renderHistoryItem(h, (depth + 1) * 12))}
          </div>
        )}
      </div>
    )
  }

  const isSearching = fileSearchTerm.trim().length > 0
  const filteredHistories = histories.filter((h) =>
    (h.sectionTag || '').toLowerCase().includes(fileSearchTerm.toLowerCase())
  )
  const { ungrouped, roots } = buildFolderTree(histories)

  return (
    <div style={{ width: 240, background: '#0f172a', display: 'flex', flexDirection: 'column', height: '100%', flexShrink: 0, zIndex: 10 }}>

      <ConfirmModal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => { if (deleteId) { removeHistory(deleteId); setDeleteId(null) } }}
        title="删除记录"
        message="确认删除该数据记录？删除后无法恢复。"
        confirmText="删除"
        cancelText="取消"
      />

      {/* 删除文件夹确认弹窗 */}
      {(() => {
        const flattenNodes = (nodes: FolderNode[]): FolderNode[] =>
          nodes.flatMap((n) => [n, ...flattenNodes(n.children)])
        const folderNode = deleteFolderPath
          ? flattenNodes(roots).find((n) => n.path === deleteFolderPath) ?? null
          : null
        const folderCount = folderNode ? countItems(folderNode) : 0
        const folderName = folderNode ? folderNode.name : ''
        return (
          <ConfirmModal
            isOpen={!!deleteFolderPath}
            onClose={() => setDeleteFolderPath(null)}
            onConfirm={() => {
              if (folderNode) removeHistories(collectIds(folderNode))
              setDeleteFolderPath(null)
            }}
            title="删除文件夹"
            message={`确认删除文件夹「${folderName}」及其下 ${folderCount} 条记录？此操作不可撤销。`}
            confirmText="删除"
            cancelText="取消"
          />
        )
      })()}

      <ConfirmModal
        isOpen={clearConfirmOpen}
        onClose={() => setClearConfirmOpen(false)}
        onConfirm={() => { if (activeCase) clearHistories(activeCase.id); setClearConfirmOpen(false) }}
        title="清空所有记录"
        message="确认清空该案例下的所有历史记录？此操作不可撤销。"
        confirmText="清空"
        cancelText="取消"
      />

      {/* 顶部操作栏 */}
      <div style={{ height: 42, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 8px', background: '#020617', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
        <button
          onClick={() => router.push('/cases')}
          style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: '#94a3b8', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 5, padding: '4px 8px', cursor: 'pointer' }}
        >
          <ChevronLeft size={12} /> 返回
        </button>

        {myRole === 'owner' && (
          <button
            onClick={() => setClearConfirmOpen(true)}
            style={{ fontSize: 11, color: '#64748b', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 5, padding: '4px 8px', cursor: 'pointer' }}
          >
            清空
          </button>
        )}
      </div>

      {/* 案例名称 */}
      <div style={{ padding: '10px 10px 8px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.03)' }}>
        <div style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 5 }}>当前案例</div>
        {isEditingName ? (
          <input
            autoFocus
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleSaveName}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSaveName() }}
            style={{ width: '100%', fontSize: 12, fontWeight: 700, color: '#fff', padding: '5px 8px', border: '1px solid #3b82f6', outline: 'none', borderRadius: 5, background: '#1e293b', boxSizing: 'border-box' }}
          />
        ) : (
          <div
            onClick={() => myRole === 'owner' && setIsEditingName(true)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '3px 4px', borderRadius: 5, cursor: myRole === 'owner' ? 'pointer' : 'default' }}
          >
            <span style={{ fontSize: 12, fontWeight: 700, color: '#f1f5f9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 4 }}>
              {activeCase?.name || '未命名案例'}
            </span>
            {myRole === 'owner' && <Edit3 size={11} style={{ color: '#475569', flexShrink: 0 }} />}
          </div>
        )}
      </div>

      {/* 导入按钮 + 搜索 */}
      <div style={{ padding: '8px 8px 6px', flexShrink: 0 }}>
        {(myRole === 'owner' || myRole === 'editor') && (
          <button
            onClick={onImport}
            style={{ width: '100%', background: '#2563eb', border: 'none', borderRadius: 6, color: '#fff', padding: '8px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer', marginBottom: 6, boxSizing: 'border-box' }}
          >
            <Plus size={13} /> 导入新数据
          </button>
        )}
        <div style={{ position: 'relative' }}>
          <Search size={11} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
          <input
            type="text"
            placeholder="搜索文件..."
            value={fileSearchTerm}
            onChange={(e) => setFileSearchTerm(e.target.value)}
            style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 5, padding: '6px 26px 6px 26px', fontSize: 11, color: '#e2e8f0', outline: 'none', boxSizing: 'border-box' }}
          />
          {fileSearchTerm && (
            <button onClick={() => setFileSearchTerm('')} style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#475569', display: 'flex', alignItems: 'center' }}>
              <X size={11} />
            </button>
          )}
        </div>
      </div>

      {/* 历史记录列表 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 8px' }}>
        {isSearching ? (
          filteredHistories.length === 0 ? (
            <div style={{ fontSize: 11, color: '#475569', textAlign: 'center', marginTop: 32, fontStyle: 'italic' }}>未找到匹配文件</div>
          ) : (
            filteredHistories.map((h) => renderHistoryItem(h, 0))
          )
        ) : histories.length === 0 ? (
          <div style={{ fontSize: 11, color: '#475569', textAlign: 'center', marginTop: 32, fontStyle: 'italic' }}>暂无历史记录</div>
        ) : (
          <>
            {/* Ungrouped items (no __folder__) */}
            {ungrouped.map((h) => renderHistoryItem(h, 0))}

            {/* Folder tree */}
            {roots.length > 0 && ungrouped.length > 0 && (
              <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '6px 0' }} />
            )}
            {roots.map((node) => renderFolderNode(node, 0))}
          </>
        )}
      </div>

      {/* 底部工具栏 */}
      <div style={{ padding: 8, borderTop: '1px solid rgba(255,255,255,0.06)', background: '#020617', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
        {(myRole === 'owner' || myRole === 'editor') && (
          <button
            onClick={onJoin}
            style={{ width: '100%', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 5, color: '#94a3b8', background: 'rgba(255,255,255,0.03)', padding: '6px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, fontSize: 11, fontWeight: 700, cursor: 'pointer', boxSizing: 'border-box' }}
          >
            <LinkIcon size={11} /> 多表关联
          </button>
        )}
      </div>
    </div>
  )
}
