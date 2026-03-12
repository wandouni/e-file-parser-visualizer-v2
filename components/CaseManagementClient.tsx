'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Plus, Download, Upload, Pencil, Trash2, LogOut } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { AppProvider, useApp } from '@/context/AppContext'
import { formatDate } from '@/lib/utils'
import type { Case, Profile } from '@/types'
import { createClient } from '@/lib/supabase/client'

function CaseManagementInner() {
  const router = useRouter()
  const { cases, loadCases, createCase, deleteCase, renameCase, loading, exportData, importData, profile } = useApp()
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  useEffect(() => { loadCases() }, [loadCases])

  const filtered = cases.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))

  async function handleCreate() {
    const c = await createCase()
    if (c) router.push(`/cases/${c.id}`)
  }

  async function handleRename(id: string) {
    if (editName.trim()) await renameCase(id, editName.trim())
    setEditingId(null)
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    await importData(text)
    e.target.value = ''
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-main)' }}>
      {/* 顶部导航栏 */}
      <div className="bg-white border-b px-6 py-3 flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
        <h1 className="text-sm font-bold" style={{ color: 'var(--text)' }}>电网E文件解析与可视化管理工具</h1>
        <div className="flex items-center gap-2">
          {/* 搜索 */}
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text3)' }} />
            <input
              type="text"
              placeholder="搜索案例名称…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border rounded-lg pl-7 pr-3 py-1.5 text-xs outline-none"
              style={{ borderColor: 'var(--border)', width: 180 }}
            />
          </div>

          {/* 恢复 */}
          <label className="flex items-center gap-1.5 border rounded-lg px-3 py-1.5 text-xs cursor-pointer transition-colors hover:bg-gray-50"
            style={{ borderColor: 'var(--border)', color: 'var(--text2)' }}>
            <Upload size={12} /> 恢复备份
            <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
          </label>

          {/* 新建 */}
          <button
            onClick={handleCreate}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white"
            style={{ background: 'var(--accent)' }}
          >
            <Plus size={12} /> 新建案例
          </button>

          {/* 用户菜单 */}
          <div className="relative group ml-2">
            <button className="flex items-center gap-1.5 text-xs px-2 py-1.5 rounded-lg hover:bg-gray-100" style={{ color: 'var(--text2)' }}>
              <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold" style={{ color: 'var(--accent)' }}>
                {profile?.displayName?.[0] || profile?.username?.[0] || 'U'}
              </div>
              {profile?.displayName || profile?.username}
            </button>
            <div className="absolute right-0 top-full mt-1 bg-white border rounded-lg shadow-lg py-1 w-36 hidden group-hover:block z-10"
              style={{ borderColor: 'var(--border)' }}>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-gray-50"
                style={{ color: 'var(--danger)' }}
              >
                <LogOut size={12} /> 退出登录
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 案例列表 */}
      <div className="flex-1 p-6">
        <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
          <table className="w-full">
            <thead>
              <tr className="border-b text-left" style={{ borderColor: 'var(--border)', background: '#f8fafc' }}>
                {['#', '案例名称', '创建时间', '文件数', '操作'].map((h, i) => (
                  <th key={h} className="px-4 py-3 text-xs font-medium" style={{ color: 'var(--text2)', width: i === 0 ? 48 : i === 4 ? 100 : 'auto' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-xs" style={{ color: 'var(--text3)' }}>加载中…</td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-xs" style={{ color: 'var(--text3)' }}>
                    {cases.length === 0 ? '暂无案例，点击「新建案例」开始' : '无匹配结果'}
                  </td>
                </tr>
              )}
              {filtered.map((c, i) => (
                <CaseRow
                  key={c.id}
                  c={c}
                  index={i + 1}
                  isEditing={editingId === c.id}
                  editName={editName}
                  isDeleting={deletingId === c.id}
                  onRowClick={() => router.push(`/cases/${c.id}`)}
                  onEditStart={() => { setEditingId(c.id); setEditName(c.name) }}
                  onEditChange={setEditName}
                  onEditSave={() => handleRename(c.id)}
                  onEditCancel={() => setEditingId(null)}
                  onDeleteStart={() => setDeletingId(c.id)}
                  onDeleteCancel={() => setDeletingId(null)}
                  onDeleteConfirm={async () => { await deleteCase(c.id); setDeletingId(null) }}
                  onExport={() => exportData(c.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function CaseRow({
  c, index, isEditing, editName, isDeleting,
  onRowClick, onEditStart, onEditChange, onEditSave, onEditCancel,
  onDeleteStart, onDeleteCancel, onDeleteConfirm, onExport,
}: {
  c: Case; index: number
  isEditing: boolean; editName: string
  isDeleting: boolean
  onRowClick: () => void
  onEditStart: () => void
  onEditChange: (v: string) => void
  onEditSave: () => void
  onEditCancel: () => void
  onDeleteStart: () => void
  onDeleteCancel: () => void
  onDeleteConfirm: () => Promise<void>
  onExport: () => void
}) {
  const ROLE_LABEL: Record<string, string> = { owner: '所有者', editor: '编辑者', viewer: '只读' }

  return (
    <tr
      className="border-b hover:bg-blue-50 cursor-pointer group transition-colors"
      style={{ borderColor: 'var(--border)' }}
      onClick={onRowClick}
    >
      <td className="px-4 py-3 text-xs" style={{ color: 'var(--text3)' }}>{index}</td>
      <td className="px-4 py-3" onClick={(e) => isEditing && e.stopPropagation()}>
        <div className="flex items-center gap-2">
          {isEditing ? (
            <input
              autoFocus
              value={editName}
              onChange={(e) => onEditChange(e.target.value)}
              onBlur={onEditSave}
              onKeyDown={(e) => { if (e.key === 'Enter') onEditSave(); if (e.key === 'Escape') onEditCancel() }}
              className="border rounded px-2 py-0.5 text-xs outline-none"
              style={{ borderColor: 'var(--accent)' }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="text-xs font-medium" style={{ color: 'var(--text)' }}>{c.name}</span>
          )}
          {c.myRole && (
            <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>
              {ROLE_LABEL[c.myRole]}
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-xs" style={{ color: 'var(--text2)' }}>{formatDate(c.createdAt)}</td>
      <td className="px-4 py-3 text-xs" style={{ color: 'var(--text2)' }}>{c.historyCount ?? 0}</td>
      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
        <AnimatePresence>
          {isDeleting ? (
            <motion.div
              initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
              className="flex items-center gap-1.5"
            >
              <span className="text-xs" style={{ color: 'var(--text2)' }}>确认删除？</span>
              <button onClick={onDeleteCancel} className="text-xs px-2 py-0.5 border rounded" style={{ borderColor: 'var(--border)', color: 'var(--text2)' }}>取消</button>
              <button onClick={onDeleteConfirm} className="text-xs px-2 py-0.5 rounded text-white" style={{ background: 'var(--danger)' }}>删除</button>
            </motion.div>
          ) : (
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={onExport} className="p-1 rounded hover:bg-gray-100" title="导出备份">
                <Download size={12} style={{ color: 'var(--text3)' }} />
              </button>
              {c.myRole === 'owner' && (
                <button onClick={onEditStart} className="p-1 rounded hover:bg-gray-100" title="重命名">
                  <Pencil size={12} style={{ color: 'var(--text3)' }} />
                </button>
              )}
              {c.myRole === 'owner' && (
                <button onClick={onDeleteStart} className="p-1 rounded hover:bg-red-50" title="删除">
                  <Trash2 size={12} style={{ color: 'var(--danger)' }} />
                </button>
              )}
            </div>
          )}
        </AnimatePresence>
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
