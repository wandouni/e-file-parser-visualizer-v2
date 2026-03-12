'use client'

import { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Case, HistoryRecord, Profile, CaseRole, VizConfig } from '@/types'

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
  clearHistories: (caseId: string) => Promise<void>
  updateHistory: (record: HistoryRecord) => Promise<void>
  setCurrentId: (id: string | null) => void

  // 权限
  myRole: CaseRole | null

  // 导出/导入
  exportData: () => Promise<void>
  importData: (json: string) => Promise<void>
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children, profile, initialCase }: { children: React.ReactNode; profile: Profile | null; initialCase?: Case }) {
  const supabase = createClient()

  const [cases, setCases] = useState<Case[]>(initialCase ? [initialCase] : [])
  const [activeCaseId, setActiveCaseId] = useState<string | null>(initialCase?.id || null)
  const [histories, setHistories] = useState<HistoryRecord[]>([])
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const activeCase = useMemo(() => cases.find((c) => c.id === activeCaseId) || null, [cases, activeCaseId])
  const myRole = useMemo(() => (activeCase?.myRole as CaseRole) || null, [activeCase])

  // Realtime 订阅 ref
  const realtimeChannelRef = useRef<any>(null)

  // 加载案例列表
  const loadCases = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/cases')
    const { data } = await res.json()
    setCases(data || [])
    setLoading(false)
  }, [])

  // 创建案例
  const createCase = useCallback(async (name?: string) => {
    const res = await fetch('/api/cases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    const { data } = await res.json()
    if (data) {
      setCases((prev) => [data, ...prev])
    }
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
  }, [activeCaseId])

  // 重命名案例
  const renameCase = useCallback(async (id: string, name: string) => {
    await fetch(`/api/cases/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    setCases((prev) => prev.map((c) => c.id === id ? { ...c, name } : c))
  }, [])

  // 加载历史记录列表（不含 rows）
  const loadHistories = useCallback(async (caseId: string) => {
    setLoading(true)
    const res = await fetch(`/api/cases/${caseId}/histories`)
    const { data } = await res.json()
    const records = (data || []).map(normalizeHistory)
    setHistories(records)
    if (records.length > 0) setCurrentId(records[0].id)
    setLoading(false)
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

  // 本地追加（Realtime 或导入后调用）
  const addHistory = useCallback((record: HistoryRecord) => {
    setHistories((prev) => [record, ...prev])
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
  }, [activeCaseId, currentId])

  // 清空
  const clearHistories = useCallback(async (caseId: string) => {
    await fetch(`/api/cases/${caseId}/histories`, { method: 'DELETE' })
    setHistories([])
    setCurrentId(null)
  }, [])

  // 更新历史记录配置（列配置、图表配置、分页大小）
  const updateHistory = useCallback(async (record: HistoryRecord) => {
    if (!activeCaseId) return
    const body: Record<string, any> = {
      col_config: record.colConfig,
      page_size: record.pageSize,
      viz_configs: record.vizConfigs.map(({ _collapsed: _, ...rest }) => rest),
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
  const exportData = useCallback(async () => {
    const payload = { cases, histories }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `grid_analysis_backup_${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [cases, histories])

  // 导入备份
  const importData = useCallback(async (json: string) => {
    // 简化版：解析并通过 API 导入
    const payload = JSON.parse(json)
    setLoading(true)
    const res = await fetch('/api/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (res.ok) await loadCases()
    setLoading(false)
  }, [loadCases])

  // Realtime 订阅
  useEffect(() => {
    if (!activeCaseId) {
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current)
        realtimeChannelRef.current = null
      }
      return
    }

    const channel = supabase
      .channel(`case:${activeCaseId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'histories', filter: `case_id=eq.${activeCaseId}` },
        (payload) => {
          const record = normalizeHistory(payload.new)
          // 避免重复（自己操作的记录已通过 addHistory 更新）
          setHistories((prev) => {
            if (prev.some((h) => h.id === record.id)) return prev
            return [record, ...prev]
          })
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'histories', filter: `case_id=eq.${activeCaseId}` },
        (payload) => {
          const record = normalizeHistory(payload.new)
          setHistories((prev) => prev.map((h) => h.id === record.id ? { ...h, ...record } : h))
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'histories', filter: `case_id=eq.${activeCaseId}` },
        (payload) => {
          const id = payload.old.id
          setHistories((prev) => {
            const next = prev.filter((h) => h.id !== id)
            if (currentId === id) setCurrentId(next[0]?.id || null)
            return next
          })
        }
      )
      .subscribe()

    realtimeChannelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      realtimeChannelRef.current = null
    }
  }, [activeCaseId, currentId, supabase])

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
      loadHistories, loadHistoryRows, addHistory, removeHistory, clearHistories, updateHistory,
      setCurrentId, myRole, exportData, importData,
    }}>
      {children}
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
    pageSize: raw.page_size || 20,
    vizConfigs: (raw.viz_configs || []) as VizConfig[],
    sortOrder: raw.sort_order || 0,
  }
}
