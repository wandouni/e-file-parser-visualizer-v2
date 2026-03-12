'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { Search, Trash2, ExternalLink } from 'lucide-react'
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
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-sm font-bold" style={{ color: 'var(--text)' }}>案例管理 ({total})</h1>
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text3)' }} />
          <input
            className="pl-7 pr-3 py-1.5 text-xs border rounded-lg outline-none w-48"
            style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
            placeholder="搜索案例名..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          />
        </div>
      </div>

      <div className="bg-white border rounded-xl overflow-hidden" style={{ borderColor: 'var(--border)' }}>
        <table className="w-full text-left">
          <thead className="border-b text-[10px] font-medium" style={{ background: '#f8fafc', borderColor: 'var(--border)', color: 'var(--text2)' }}>
            <tr>
              <th className="px-4 py-2.5">案例名称</th>
              <th className="px-4 py-2.5">创建者</th>
              <th className="px-4 py-2.5 text-center">成员</th>
              <th className="px-4 py-2.5 text-center">数据集</th>
              <th className="px-4 py-2.5">更新时间</th>
              <th className="px-4 py-2.5 text-center">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y text-xs" style={{ color: 'var(--text)' }}>
            {loading ? (
              <tr><td colSpan={6} className="py-8 text-center text-[10px]" style={{ color: 'var(--text3)' }}>加载中...</td></tr>
            ) : cases.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-2.5 font-medium">{c.name}</td>
                <td className="px-4 py-2.5 text-[10px]" style={{ color: 'var(--text2)' }}>
                  {c.owner_username ?? c.owner_id.slice(0, 8)}
                </td>
                <td className="px-4 py-2.5 text-center text-[10px]">{c.member_count ?? '—'}</td>
                <td className="px-4 py-2.5 text-center text-[10px]">{c.history_count ?? '—'}</td>
                <td className="px-4 py-2.5 text-[10px]" style={{ color: 'var(--text2)' }}>
                  {new Date(c.updated_at).toLocaleDateString('zh-CN')}
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center justify-center gap-2">
                    <Link href={`/cases/${c.id}`} target="_blank"
                      className="p-1 rounded hover:bg-blue-50 transition-colors"
                      style={{ color: 'var(--text3)' }}>
                      <ExternalLink size={13} />
                    </Link>
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
