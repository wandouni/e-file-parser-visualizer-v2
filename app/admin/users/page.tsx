'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { Search, Shield, ShieldOff, Ban, CheckCircle } from 'lucide-react'

interface UserRow {
  id: string
  username: string
  display_name: string | null
  is_admin: boolean
  is_banned: boolean
  created_at: string
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page) })
    if (search) params.set('q', search)
    const res = await fetch(`/api/admin/users?${params}`)
    const { data, meta } = await res.json()
    if (data) { setUsers(data); setTotal(meta.total) }
    setLoading(false)
  }, [page, search])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  async function toggleField(userId: string, field: 'is_banned' | 'is_admin', value: boolean) {
    setUpdatingId(userId)
    await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, [field]: value }),
    })
    setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, [field]: value } : u))
    setUpdatingId(null)
  }

  const totalPages = Math.ceil(total / 20)

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-sm font-bold" style={{ color: 'var(--text)' }}>用户管理 ({total})</h1>
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text3)' }} />
          <input
            className="pl-7 pr-3 py-1.5 text-xs border rounded-lg outline-none w-48"
            style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
            placeholder="搜索用户名..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          />
        </div>
      </div>

      <div className="bg-white border rounded-xl overflow-hidden" style={{ borderColor: 'var(--border)' }}>
        <table className="w-full text-left">
          <thead className="border-b text-[10px] font-medium" style={{ background: '#f8fafc', borderColor: 'var(--border)', color: 'var(--text2)' }}>
            <tr>
              <th className="px-4 py-2.5">用户</th>
              <th className="px-4 py-2.5">注册时间</th>
              <th className="px-4 py-2.5 text-center">管理员</th>
              <th className="px-4 py-2.5 text-center">封禁</th>
              <th className="px-4 py-2.5 text-center">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y text-xs" style={{ color: 'var(--text)' }}>
            {loading ? (
              <tr><td colSpan={5} className="py-8 text-center text-[10px]" style={{ color: 'var(--text3)' }}>加载中...</td></tr>
            ) : users.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-4 py-2.5">
                  <div className="font-medium">{u.display_name || u.username}</div>
                  <div className="text-[9px]" style={{ color: 'var(--text3)' }}>@{u.username}</div>
                </td>
                <td className="px-4 py-2.5 text-[10px]" style={{ color: 'var(--text2)' }}>
                  {new Date(u.created_at).toLocaleDateString('zh-CN')}
                </td>
                <td className="px-4 py-2.5 text-center">
                  {u.is_admin ? (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium" style={{ background: '#dbeafe', color: '#1d4ed8' }}>
                      <Shield size={9} /> 是
                    </span>
                  ) : (
                    <span className="text-[9px]" style={{ color: 'var(--text3)' }}>否</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-center">
                  {u.is_banned ? (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium" style={{ background: '#fee2e2', color: '#dc2626' }}>
                      <Ban size={9} /> 封禁
                    </span>
                  ) : (
                    <span className="text-[9px]" style={{ color: '#16a34a' }}>正常</span>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center justify-center gap-2">
                    <button
                      disabled={updatingId === u.id}
                      onClick={() => toggleField(u.id, 'is_admin', !u.is_admin)}
                      className="p-1 rounded hover:bg-blue-50 transition-colors disabled:opacity-40"
                      title={u.is_admin ? '撤销管理员' : '设为管理员'}
                      style={{ color: u.is_admin ? '#1d4ed8' : 'var(--text3)' }}>
                      {u.is_admin ? <ShieldOff size={13} /> : <Shield size={13} />}
                    </button>
                    <button
                      disabled={updatingId === u.id}
                      onClick={() => toggleField(u.id, 'is_banned', !u.is_banned)}
                      className="p-1 rounded hover:bg-red-50 transition-colors disabled:opacity-40"
                      title={u.is_banned ? '解除封禁' : '封禁用户'}
                      style={{ color: u.is_banned ? '#16a34a' : '#dc2626' }}>
                      {u.is_banned ? <CheckCircle size={13} /> : <Ban size={13} />}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}
            className="px-3 py-1 text-xs border rounded disabled:opacity-40"
            style={{ borderColor: 'var(--border)', color: 'var(--text2)' }}>上一页</button>
          <span className="text-[10px]" style={{ color: 'var(--text3)' }}>{page} / {totalPages}</span>
          <button disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1 text-xs border rounded disabled:opacity-40"
            style={{ borderColor: 'var(--border)', color: 'var(--text2)' }}>下一页</button>
        </div>
      )}
    </div>
  )
}
