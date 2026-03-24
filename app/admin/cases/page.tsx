'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

interface CaseRow {
  id: string
  name: string
  owner_id: string
  created_at: string
  updated_at: string
  member_count?: number
  history_count?: number
  owner_username?: string
}

const th: React.CSSProperties = {
  padding: '9px 16px', fontSize: 11, fontWeight: 600, color: '#64748b',
  textAlign: 'left', background: '#f8fafc', borderBottom: '1px solid #e2e8f0',
}
const td: React.CSSProperties = {
  padding: '10px 16px', fontSize: 12, color: '#0f172a', borderBottom: '1px solid #f1f5f9',
}

export default function AdminCasesPage() {
  const [cases, setCases] = useState<CaseRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)

  const fetchCases = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page) })
    if (search) params.set('q', search)
    const res = await fetch(`/api/admin/cases?${params}`)
    const { data, meta } = await res.json()
    if (data) { setCases(data); setTotal(meta?.total ?? 0) }
    setLoading(false)
  }, [page, search])

  useEffect(() => { fetchCases() }, [fetchCases])

  const totalPages = Math.ceil(total / 20)

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>案例管理 ({total})</h1>
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: 12 }}>🔍</span>
          <input
            style={{
              paddingLeft: 30, paddingRight: 12, paddingTop: 7, paddingBottom: 7,
              fontSize: 12, border: '1px solid #e2e8f0', borderRadius: 8, outline: 'none',
              width: 192, color: '#0f172a', background: '#fff',
            }}
            placeholder="搜索案例名..."
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
              <th style={th}>案例名称</th>
              <th style={th}>创建者</th>
              <th style={{ ...th, textAlign: 'center' }}>数据集数</th>
              <th style={th}>更新时间</th>
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
            ) : cases.map((c) => (
              <tr key={c.id} style={{ background: '#fff' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}>
                <td style={{ ...td, fontWeight: 600 }}>{c.name}</td>
                <td style={{ ...td, color: '#475569', fontSize: 11 }}>
                  {c.owner_username ?? c.owner_id.slice(0, 8)}
                </td>
                <td style={{ ...td, textAlign: 'center', color: '#475569' }}>
                  {c.history_count ?? '—'}
                </td>
                <td style={{ ...td, color: '#475569', fontSize: 11 }}>
                  {new Date(c.updated_at).toLocaleDateString('zh-CN')}
                </td>
                <td style={{ ...td, textAlign: 'center' }}>
                  <Link href={`/cases/${c.id}`} target="_blank" style={{
                    display: 'inline-block', padding: '4px 10px', border: '1px solid #e2e8f0',
                    borderRadius: 6, fontSize: 11, color: '#475569', textDecoration: 'none',
                    background: '#fff',
                  }}>
                    打开 ↗
                  </Link>
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
