'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Plus, Pencil, Trash2, LogOut } from 'lucide-react'
import { AppProvider, useApp } from '@/context/AppContext'
import { ConfirmModal } from './Modal'
import { formatDate } from '@/lib/utils'
import type { Case, Profile } from '@/types'

function CaseManagementInner() {
  const router = useRouter()
  const { cases, loadCases, deleteCase, renameCase, loading, profile } = useApp()
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [navigatingId, setNavigatingId] = useState<string | null>(null)
  const userMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => { loadCases() }, [loadCases])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false)
      }
    }
    if (showUserMenu) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showUserMenu])

  const PAGE_SIZE = 15
  const [page, setPage] = useState(1)

  const filtered = cases.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // Reset to page 1 when search changes
  useEffect(() => { setPage(1) }, [search])

  async function handleCreate() {
    if (creating) return
    setCreating(true)
    setCreateError('')
    try {
      const res = await fetch('/api/cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const json = await res.json()
      if (json.data) {
        router.push(`/cases/${json.data.id}`)
      } else {
        setCreateError(json.error?.message || `HTTP ${res.status}`)
      }
    } catch (e: any) {
      setCreateError(e?.message || '网络错误')
    } finally {
      setCreating(false)
    }
  }

  async function handleRename(id: string) {
    if (editName.trim()) await renameCase(id, editName.trim())
    setEditingId(null)
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  const displayName = profile?.displayName || profile?.username || '用户'

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9', display: 'flex', flexDirection: 'column' }}>
      <ConfirmModal
        isOpen={!!deletingId}
        onClose={() => setDeletingId(null)}
        onConfirm={async () => { if (deletingId) { await deleteCase(deletingId); setDeletingId(null) } }}
        title="删除案例"
        message="确认删除该案例？删除后数据将无法恢复。"
        confirmText="删除"
        cancelText="取消"
      />

      {/* 顶部导航栏 */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '0 24px', height: 54, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            </svg>
          </div>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>电网E文件管理及数据分析工具</span>
        </div>

        {/* 用户菜单 */}
        <div ref={userMenuRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', borderRadius: 7, border: 'none', background: 'none', cursor: 'pointer' }}
          >
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#2563eb', flexShrink: 0 }}>
              {displayName[0]?.toUpperCase()}
            </div>
            <span style={{ fontSize: 12, color: '#475569', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</span>
          </button>
          {showUserMenu && (
            <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 9, boxShadow: '0 4px 16px rgba(0,0,0,0.08)', minWidth: 140, zIndex: 50, overflow: 'hidden' }}>
              {profile?.isAdmin && (
                <button
                  onClick={() => { setShowUserMenu(false); router.push('/admin') }}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', fontSize: 12, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', borderBottom: '1px solid #f1f5f9' }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                  管理后台
                </button>
              )}
              <button
                onClick={handleLogout}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', fontSize: 12, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <LogOut size={13} /> 退出登录
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 内容区 */}
      <div style={{ flex: 1, padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* 操作工具栏 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          {/* 左侧：搜索框 */}
          <div style={{ position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="搜索案例名称…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ border: '1px solid #e2e8f0', borderRadius: 8, paddingLeft: 32, paddingRight: 12, paddingTop: 8, paddingBottom: 8, fontSize: 13, outline: 'none', width: 220, background: '#fff', color: '#0f172a', boxSizing: 'border-box' }}
            />
          </div>

          {/* 右侧：操作按钮组 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {createError && (
              <span style={{ fontSize: 12, color: '#ef4444' }}>{createError}</span>
            )}
            <button
              onClick={handleCreate}
              disabled={creating}
              style={{ display: 'flex', alignItems: 'center', gap: 6, borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, color: '#fff', background: creating ? '#93c5fd' : '#2563eb', border: 'none', cursor: creating ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', transition: 'background 0.15s' }}
            >
              {creating ? (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }}>
                    <line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/>
                    <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/>
                    <line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/>
                    <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/>
                  </svg>
                  创建中…
                </>
              ) : (
                <><Plus size={13} /> 新建案例</>
              )}
            </button>
          </div>
        </div>

        {/* 案例表格 */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                {[
                  { label: '#', width: 48 },
                  { label: '案例名称' },
                  { label: '创建时间', width: 160 },
                  { label: '文件数', width: 72 },
                  { label: '操作', width: 110 },
                ].map(({ label, width }) => (
                  <th key={label} style={{ padding: '11px 16px', fontSize: 11, fontWeight: 600, color: '#64748b', textAlign: 'left', width }}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '48px 0', fontSize: 13, color: '#94a3b8' }}>加载中…</td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '48px 0', fontSize: 13, color: '#94a3b8' }}>
                    {cases.length === 0 ? '暂无案例，点击「新建案例」开始' : '无匹配结果'}
                  </td>
                </tr>
              )}
              {paged.map((c, i) => (
                <CaseRow
                  key={c.id}
                  c={c}
                  index={(page - 1) * PAGE_SIZE + i + 1}
                  isEditing={editingId === c.id}
                  editName={editName}
                  isNavigating={navigatingId === c.id}
                  onRowClick={() => { setNavigatingId(c.id); router.push(`/cases/${c.id}`) }}
                  onEditStart={() => { setEditingId(c.id); setEditName(c.name) }}
                  onEditChange={setEditName}
                  onEditSave={() => handleRename(c.id)}
                  onEditCancel={() => setEditingId(null)}
                  onDeleteStart={() => setDeletingId(c.id)}
                />
              ))}
            </tbody>
          </table>

          {/* 分页栏 */}
          {!loading && totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderTop: '1px solid #f1f5f9' }}>
              <span style={{ fontSize: 12, color: '#94a3b8' }}>
                共 {filtered.length} 条，第 {page} / {totalPages} 页
              </span>
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  onClick={() => setPage(1)}
                  disabled={page === 1}
                  style={{ padding: '4px 8px', fontSize: 12, borderRadius: 6, border: '1px solid #e2e8f0', background: page === 1 ? '#f8fafc' : '#fff', color: page === 1 ? '#cbd5e1' : '#475569', cursor: page === 1 ? 'not-allowed' : 'pointer' }}
                >«</button>
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  style={{ padding: '4px 8px', fontSize: 12, borderRadius: 6, border: '1px solid #e2e8f0', background: page === 1 ? '#f8fafc' : '#fff', color: page === 1 ? '#cbd5e1' : '#475569', cursor: page === 1 ? 'not-allowed' : 'pointer' }}
                >‹</button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                  .reduce<(number | '...')[]>((acc, p, idx, arr) => {
                    if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('...')
                    acc.push(p)
                    return acc
                  }, [])
                  .map((p, idx) =>
                    p === '...' ? (
                      <span key={`ellipsis-${idx}`} style={{ padding: '4px 6px', fontSize: 12, color: '#94a3b8' }}>…</span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => setPage(p as number)}
                        style={{ padding: '4px 8px', fontSize: 12, borderRadius: 6, border: '1px solid #e2e8f0', background: page === p ? '#2563eb' : '#fff', color: page === p ? '#fff' : '#475569', cursor: 'pointer', fontWeight: page === p ? 600 : 400 }}
                      >{p}</button>
                    )
                  )}
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  style={{ padding: '4px 8px', fontSize: 12, borderRadius: 6, border: '1px solid #e2e8f0', background: page === totalPages ? '#f8fafc' : '#fff', color: page === totalPages ? '#cbd5e1' : '#475569', cursor: page === totalPages ? 'not-allowed' : 'pointer' }}
                >›</button>
                <button
                  onClick={() => setPage(totalPages)}
                  disabled={page === totalPages}
                  style={{ padding: '4px 8px', fontSize: 12, borderRadius: 6, border: '1px solid #e2e8f0', background: page === totalPages ? '#f8fafc' : '#fff', color: page === totalPages ? '#cbd5e1' : '#475569', cursor: page === totalPages ? 'not-allowed' : 'pointer' }}
                >»</button>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

function CaseRow({
  c, index, isEditing, editName, isNavigating,
  onRowClick, onEditStart, onEditChange, onEditSave, onEditCancel,
  onDeleteStart,
}: {
  c: Case; index: number
  isEditing: boolean; editName: string; isNavigating: boolean
  onRowClick: () => void; onEditStart: () => void
  onEditChange: (v: string) => void; onEditSave: () => void; onEditCancel: () => void
  onDeleteStart: () => void
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <tr
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onRowClick}
      style={{ borderBottom: '1px solid #f1f5f9', background: isNavigating ? '#eff6ff' : hovered ? '#f8fafc' : '#fff', cursor: isNavigating ? 'wait' : 'pointer', transition: 'background 0.1s' }}
    >
      <td style={{ padding: '13px 16px', fontSize: 12, color: '#94a3b8', width: 48 }}>
        {isNavigating ? (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite', display: 'block' }}>
            <line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/>
            <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/>
            <line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/>
            <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/>
          </svg>
        ) : index}
      </td>
      <td style={{ padding: '13px 16px' }} onClick={(e) => isEditing && e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isEditing ? (
            <input
              autoFocus
              value={editName}
              onChange={(e) => onEditChange(e.target.value)}
              onBlur={onEditSave}
              onKeyDown={(e) => { if (e.key === 'Enter') onEditSave(); if (e.key === 'Escape') onEditCancel() }}
              onClick={(e) => e.stopPropagation()}
              style={{ border: '1px solid #2563eb', borderRadius: 5, padding: '3px 8px', fontSize: 13, outline: 'none', color: '#0f172a', background: '#fff' }}
            />
          ) : (
            <span style={{ fontSize: 13, fontWeight: 500, color: '#0f172a' }}>{c.name}</span>
          )}
        </div>
      </td>
      <td style={{ padding: '13px 16px', fontSize: 12, color: '#64748b' }}>{formatDate(c.createdAt)}</td>
      <td style={{ padding: '13px 16px', fontSize: 12, color: '#64748b' }}>{c.historyCount ?? 0}</td>
      <td style={{ padding: '13px 16px' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {c.myRole === 'owner' && (
            <button onClick={onEditStart} title="重命名" style={{ padding: 5, borderRadius: 5, border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center' }}>
              <Pencil size={13} />
            </button>
          )}
          {c.myRole === 'owner' && (
            <button onClick={onDeleteStart} title="删除" style={{ padding: 5, borderRadius: 5, border: 'none', background: 'none', cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center' }}>
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </td>
    </tr>
  )
}

export default function CaseManagementClient({ profile }: { profile: Profile | null }) {
  return (
    <AppProvider profile={profile}>
      <CaseManagementInner />
    </AppProvider>
  )
}
