'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'

interface UserRow {
  id: string
  username: string
  display_name: string | null
  is_admin: boolean
  is_banned: boolean
  created_at: string
}

const th: React.CSSProperties = {
  padding: '9px 16px', fontSize: 11, fontWeight: 600, color: '#64748b',
  textAlign: 'left', background: '#f8fafc', borderBottom: '1px solid #e2e8f0',
}
const td: React.CSSProperties = {
  padding: '10px 16px', fontSize: 12, color: '#0f172a', borderBottom: '1px solid #f1f5f9',
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
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>用户管理 ({total})</h1>
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: 12 }}>🔍</span>
          <input
            style={{
              paddingLeft: 30, paddingRight: 12, paddingTop: 7, paddingBottom: 7,
              fontSize: 12, border: '1px solid #e2e8f0', borderRadius: 8, outline: 'none',
              width: 192, color: '#0f172a', background: '#fff',
            }}
            placeholder="搜索用户名..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          />
        </div>
      </div>

      {/* Table */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>用户</th>
              <th style={th}>注册时间</th>
              <th style={{ ...th, textAlign: 'center' }}>管理员</th>
              <th style={{ ...th, textAlign: 'center' }}>状态</th>
              <th style={{ ...th, textAlign: 'center' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} style={{ ...td, textAlign: 'center', color: '#94a3b8', padding: '32px 0' }}>
                  加载中...
                </td>
              </tr>
            ) : users.map((u) => (
              <tr key={u.id} style={{ background: '#fff' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}>
                <td style={td}>
                  <div style={{ fontWeight: 600 }}>{u.display_name || u.username}</div>
                  <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>@{u.username}</div>
                </td>
                <td style={{ ...td, color: '#475569', fontSize: 11 }}>
                  {new Date(u.created_at).toLocaleDateString('zh-CN')}
                </td>
                <td style={{ ...td, textAlign: 'center' }}>
                  {u.is_admin ? (
                    <span style={{
                      display: 'inline-block', padding: '2px 8px', borderRadius: 4,
                      fontSize: 10, fontWeight: 600, background: '#dbeafe', color: '#1d4ed8',
                    }}>管理员</span>
                  ) : (
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>—</span>
                  )}
                </td>
                <td style={{ ...td, textAlign: 'center' }}>
                  {u.is_banned ? (
                    <span style={{
                      display: 'inline-block', padding: '2px 8px', borderRadius: 4,
                      fontSize: 10, fontWeight: 600, background: '#fee2e2', color: '#dc2626',
                    }}>已封禁</span>
                  ) : (
                    <span style={{
                      display: 'inline-block', padding: '2px 8px', borderRadius: 4,
                      fontSize: 10, fontWeight: 600, background: '#dcfce7', color: '#16a34a',
                    }}>正常</span>
                  )}
                </td>
                <td style={{ ...td, textAlign: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <button
                      disabled={updatingId === u.id}
                      onClick={() => toggleField(u.id, 'is_admin', !u.is_admin)}
                      title={u.is_admin ? '撤销管理员' : '设为管理员'}
                      style={{
                        padding: '4px 10px', border: '1px solid #e2e8f0', borderRadius: 6,
                        fontSize: 11, cursor: 'pointer', background: '#fff',
                        color: u.is_admin ? '#1d4ed8' : '#64748b',
                        opacity: updatingId === u.id ? 0.4 : 1,
                      }}>
                      {u.is_admin ? '撤销管理员' : '设为管理员'}
                    </button>
                    <button
                      disabled={updatingId === u.id}
                      onClick={() => toggleField(u.id, 'is_banned', !u.is_banned)}
                      title={u.is_banned ? '解除封禁' : '封禁用户'}
                      style={{
                        padding: '4px 10px', border: '1px solid #e2e8f0', borderRadius: 6,
                        fontSize: 11, cursor: 'pointer', background: '#fff',
                        color: u.is_banned ? '#16a34a' : '#dc2626',
                        opacity: updatingId === u.id ? 0.4 : 1,
                      }}>
                      {u.is_banned ? '解除封禁' : '封禁'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16 }}>
          <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}
            style={{
              padding: '5px 14px', fontSize: 12, border: '1px solid #e2e8f0', borderRadius: 6,
              cursor: page === 1 ? 'not-allowed' : 'pointer', background: '#fff',
              color: '#475569', opacity: page === 1 ? 0.4 : 1,
            }}>上一页</button>
          <span style={{ fontSize: 11, color: '#94a3b8' }}>{page} / {totalPages}</span>
          <button disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}
            style={{
              padding: '5px 14px', fontSize: 12, border: '1px solid #e2e8f0', borderRadius: 6,
              cursor: page === totalPages ? 'not-allowed' : 'pointer', background: '#fff',
              color: '#475569', opacity: page === totalPages ? 0.4 : 1,
            }}>下一页</button>
        </div>
      )}
    </div>
  )
}
