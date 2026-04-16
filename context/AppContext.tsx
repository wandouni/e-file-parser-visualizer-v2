'use client'

import { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react'
import type { Case, HistoryRecord, Profile, CaseRole, VizConfig } from '@/types'
import ToastContainer, { type ToastItem } from '@/components/Toast'

interface AppContextValue {
  // 数据
  cases: Case[]
  histories: HistoryRecord[]
  currentId: string | null
  activeCase: Case | null
  profile: Profile | null
  loading: boolean

  // 案例操作
  loadCases: () => Promise<void>
  createCase: (name?: string) => Promise<Case | null>
  deleteCase: (id: string) => Promise<void>
  renameCase: (id: string, name: string) => Promise<void>
  setActiveCaseId: (id: string | null) => void
  activeCaseId: string | null

  // 历史记录操作
  loadHistories: (caseId: string) => Promise<void>
  loadHistoryRows: (caseId: string, historyId: string) => Promise<HistoryRecord | null>
  addHistory: (record: HistoryRecord) => void
  removeHistory: (id: string) => Promise<void>
  removeHistories: (ids: string[]) => Promise<void>
  clearHistories: (caseId: string) => Promise<void>
  updateHistory: (record: HistoryRecord) => Promise<void>
  setCurrentId: (id: string | null) => void

  // 权限
  myRole: CaseRole | null

  // 导出/导入
  exportData: (caseId: string) => Promise<void>
  importData: (json: string) => Promise<void>

  // Toast
  showToast: (message: string, type?: ToastItem['type']) => void
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children, profile, initialCase }: { children: React.ReactNode; profile: Profile | null; initialCase?: Case }) {
  const [cases, setCases] = useState<Case[]>(initialCase ? [initialCase] : [])
  const [activeCaseId, setActiveCaseId] = useState<string | null>(initialCase?.id || null)
  const [histories, setHistories] = useState<HistoryRecord[]>([])
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const showToast = useCallback((message: string, type: ToastItem['type'] = 'success') => {
    const id = Date.now().toString()
    setToasts((prev) => [...prev, { id, message, type }])
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const activeCase = useMemo(() => cases.find((c) => c.id === activeCaseId) || null, [cases, activeCaseId])
  const myRole = useMemo(() => (activeCase?.myRole as CaseRole) || null, [activeCase])

  // 加载案例列表
  const loadCases = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/cases')
      const { data } = await res.json()
      setCases(data || [])
    } finally {
      setLoading(false)
    }
  }, [])

  // 创建案例
  const createCase = useCallback(async (name?: string) => {
    const res = await fetch('/api/cases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    const { data } = await res.json()
    if (data) setCases((prev) => [data, ...prev])
    return data
  }, [])

  // 删除案例
  const deleteCase = useCallback(async (id: string) => {
    await fetch(`/api/cases/${id}`, { method: 'DELETE' })
    setCases((prev) => prev.filter((c) => c.id !== id))
    if (activeCaseId === id) {
      setActiveCaseId(null)
      setHistories([])
      setCurrentId(null)
    }
    showToast('案例已删除')
  }, [activeCaseId, showToast])

  // 重命名案例
  const renameCase = useCallback(async (id: string, name: string) => {
    await fetch(`/api/cases/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    setCases((prev) => prev.map((c) => c.id === id ? { ...c, name } : c))
    showToast('重命名成功')
  }, [showToast])

  // 加载历史记录列表（不含 rows）
  const loadHistories = useCallback(async (caseId: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/cases/${caseId}/histories`)
      const { data } = await res.json()
      const records = (data || []).map(normalizeHistory)
      setHistories(records)
      if (records.length > 0) setCurrentId(records[0].id)
    } finally {
      setLoading(false)
    }
  }, [])

  // 按需加载完整 rows
  const loadHistoryRows = useCallback(async (caseId: string, historyId: string): Promise<HistoryRecord | null> => {
    const res = await fetch(`/api/cases/${caseId}/histories/${historyId}`)
    const { data } = await res.json()
    if (!data) return null
    const record = normalizeHistory(data)
    setHistories((prev) => prev.map((h) => h.id === historyId ? record : h))
    return record
  }, [])

  // 本地追加
  const addHistory = useCallback((record: HistoryRecord) => {
    setHistories((prev) => prev.some((h) => h.id === record.id) ? prev : [record, ...prev])
    setCurrentId(record.id)
    setCases((prev) => prev.map((c) =>
      c.id === record.caseId ? { ...c, historyCount: (c.historyCount || 0) + 1 } : c
    ))
  }, [])

  // 删除历史记录
  const removeHistory = useCallback(async (id: string) => {
    if (!activeCaseId) return
    await fetch(`/api/cases/${activeCaseId}/histories/${id}`, { method: 'DELETE' })
    setHistories((prev) => {
      const next = prev.filter((h) => h.id !== id)
      if (currentId === id) setCurrentId(next[0]?.id || null)
      return next
    })
    showToast('记录已删除')
  }, [activeCaseId, currentId, showToast])

  const removeHistories = useCallback(async (ids: string[]) => {
    if (!activeCaseId || ids.length === 0) return
    const idSet = new Set(ids)
    await Promise.all(ids.map((id) => fetch(`/api/cases/${activeCaseId}/histories/${id}`, { method: 'DELETE' })))
    setHistories((prev) => {
      const next = prev.filter((h) => !idSet.has(h.id))
      if (currentId && idSet.has(currentId)) setCurrentId(next[0]?.id || null)
      return next
    })
    showToast(`已删除 ${ids.length} 条记录`)
  }, [activeCaseId, currentId, showToast])

  // 清空
  const clearHistories = useCallback(async (caseId: string) => {
    await fetch(`/api/cases/${caseId}/histories`, { method: 'DELETE' })
    setHistories([])
    setCurrentId(null)
    showToast('已清空所有记录')
  }, [showToast])

  // 更新历史记录配置
  const updateHistory = useCallback(async (record: HistoryRecord) => {
    if (!activeCaseId) return
    const body: Record<string, any> = {
      col_config: record.colConfig,
      page_size: record.pageSize,
      viz_configs: record.vizConfigs.map(({ _collapsed: _, ...rest }) => rest),
      multi_subject_config: record.multiSubjectConfig ?? null,
      section_tag: record.sectionTag,
    }
    await fetch(`/api/cases/${activeCaseId}/histories/${record.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setHistories((prev) => prev.map((h) => h.id === record.id ? record : h))
  }, [activeCaseId])

  // 导出备份
  const exportData = useCallback(async (caseId: string) => {
    const res = await fetch(`/api/export?caseId=${caseId}`)
    if (!res.ok) { showToast('导出失败', 'error'); return }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const caseName = cases.find((c) => c.id === caseId)?.name ?? caseId
    const a = document.createElement('a')
    a.href = url
    a.download = `backup_${caseName}_${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [cases, showToast])

  // 导入备份
  const importData = useCallback(async (json: string) => {
    let payload: any
    try { payload = JSON.parse(json) } catch { showToast('文件格式错误', 'error'); return }

    const historiesArr: any[] = payload.histories ?? []
    const caseName: string = payload.case?.name ?? `恢复备份_${new Date().toLocaleDateString('zh-CN')}`

    setLoading(true)
    const caseRes = await fetch('/api/cases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: caseName }),
    })
    const { data: newCase, error: caseErr } = await caseRes.json()
    if (caseErr || !newCase) { showToast('创建案例失败：' + (caseErr?.message ?? ''), 'error'); setLoading(false); return }

    const importRes = await fetch('/api/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caseId: newCase.id, histories: historiesArr }),
    })
    const { error: importErr } = await importRes.json()
    if (importErr) { showToast('导入数据失败：' + importErr.message, 'error'); setLoading(false); return }

    await loadCases()
    setLoading(false)
  }, [loadCases, showToast])

  // 切换案例时加载历史
  useEffect(() => {
    if (activeCaseId) {
      setHistories([])
      setCurrentId(null)
      loadHistories(activeCaseId)
    }
  }, [activeCaseId, loadHistories])

  return (
    <AppContext.Provider value={{
      cases, histories, currentId, activeCase, profile, loading,
      loadCases, createCase, deleteCase, renameCase, setActiveCaseId, activeCaseId,
      loadHistories, loadHistoryRows, addHistory, removeHistory, removeHistories, clearHistories, updateHistory,
      setCurrentId, myRole, exportData, importData, showToast,
    }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}

// DB 字段（snake_case）转前端 camelCase
function normalizeHistory(raw: any): HistoryRecord {
  return {
    id: raw.id,
    caseId: raw.case_id,
    importTime: raw.import_time,
    importedBy: raw.imported_by,
    sectionTag: raw.section_tag,
    meta: raw.meta || {},
    fields: raw.fields || [],
    labels: raw.labels || raw.fields || [],
    rows: raw.rows || [],
    colConfig: raw.col_config || {},
    pageSize: raw.page_size || 22,
    vizConfigs: (raw.viz_configs || []) as VizConfig[],
    multiSubjectConfig: raw.multi_subject_config ?? null,
    sortOrder: raw.sort_order || 0,
  }
}
