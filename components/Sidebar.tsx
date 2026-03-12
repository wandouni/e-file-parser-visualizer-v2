'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, Plus, Link as LinkIcon, X, ChevronLeft, Edit3, Search, Download, Upload, Users } from 'lucide-react'
import { useApp } from '@/context/AppContext'

interface SidebarProps {
  onImport: () => void
  onJoin: () => void
  onShowMembers: () => void
}

export default function Sidebar({ onImport, onJoin, onShowMembers }: SidebarProps) {
  const router = useRouter()
  const {
    histories, currentId, setCurrentId, removeHistory, clearHistories,
    activeCase, renameCase, exportData, importData, myRole,
  } = useApp()

  const [clearConfirmOpen, setClearConfirmOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [isEditingName, setIsEditingName] = useState(false)
  const [editName, setEditName] = useState('')
  const [fileSearchTerm, setFileSearchTerm] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const clearBtnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (activeCase) setEditName(activeCase.name)
  }, [activeCase])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (clearConfirmOpen && clearBtnRef.current && !clearBtnRef.current.contains(e.target as Node)) {
        setClearConfirmOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [clearConfirmOpen])

  const filteredHistories = histories.filter((h) =>
    (h.sectionTag || '').toLowerCase().includes(fileSearchTerm.toLowerCase())
  )

  function handleSaveName() {
    if (activeCase && editName.trim() && editName !== activeCase.name) {
      renameCase(activeCase.id, editName.trim())
    }
    setIsEditingName(false)
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    importData(text)
    e.target.value = ''
  }

  return (
    <div className="flex flex-col h-full shrink-0 z-10" style={{ width: 'var(--sidebar-w)', background: 'var(--bg-sidebar)' }}>
      {/* 顶部操作栏 */}
      <div className="h-10 flex items-center justify-between px-2 shrink-0 relative border-b border-white/10" style={{ background: '#020617' }}>
        <button
          onClick={() => router.push('/cases')}
          className="flex items-center gap-1 text-[10px] font-bold text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 px-2 py-1 transition-all border border-white/10"
        >
          <ChevronLeft size={12} />返回
        </button>

        {myRole === 'owner' && (
          <button
            ref={clearBtnRef}
            onClick={() => setClearConfirmOpen(!clearConfirmOpen)}
            className="text-[10px] text-gray-500 hover:text-red-400 bg-white/5 hover:bg-red-500/10 px-2 py-1 transition-all border border-white/5"
          >
            清空
          </button>
        )}

        {clearConfirmOpen && (
          <div className="absolute top-full right-2 mt-1 bg-white text-gray-800 p-2 shadow-xl z-50 border border-gray-200 w-40 rounded">
            <p className="text-[10px] mb-2">确认清空所有历史记录？</p>
            <div className="flex justify-end gap-1">
              <button onClick={() => setClearConfirmOpen(false)} className="text-[10px] px-2 py-0.5 bg-gray-100 hover:bg-gray-200 rounded">取消</button>
              <button
                onClick={() => { activeCase && clearHistories(activeCase.id); setClearConfirmOpen(false) }}
                className="text-[10px] px-2 py-0.5 text-white rounded"
                style={{ background: 'var(--danger)' }}
              >清空</button>
            </div>
          </div>
        )}
      </div>

      {/* 案例名称 */}
      <div className="px-2 py-2 border-b border-white/10 bg-white/5">
        <div className="text-[9px] text-gray-500 uppercase mb-1 font-bold tracking-widest">当前案例</div>
        {isEditingName ? (
          <input
            autoFocus
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleSaveName}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSaveName() }}
            className="w-full text-xs font-bold text-white px-2 py-1 border border-blue-500 outline-none rounded"
            style={{ background: '#1e293b' }}
          />
        ) : (
          <div
            onClick={() => myRole === 'owner' && setIsEditingName(true)}
            className={`group flex items-center justify-between p-1 transition-all rounded ${myRole === 'owner' ? 'cursor-pointer hover:bg-white/5' : ''}`}
          >
            <span className="text-xs font-bold text-white truncate pr-2">{activeCase?.name || '未命名案例'}</span>
            {myRole === 'owner' && <Edit3 size={10} className="text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />}
          </div>
        )}
      </div>

      {/* 导入按钮 + 搜索 */}
      <div className="p-2 shrink-0 space-y-2">
        {(myRole === 'owner' || myRole === 'editor') && (
          <button
            onClick={onImport}
            className="w-full bg-blue-700 hover:bg-blue-800 text-white py-1.5 flex items-center justify-center gap-1 font-bold text-xs transition-all rounded active:scale-95"
          >
            <Plus size={14} />导入新数据
          </button>
        )}

        <div className="relative group">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="搜索文件..."
            value={fileSearchTerm}
            onChange={(e) => setFileSearchTerm(e.target.value)}
            className="w-full bg-white/5 border border-white/10 py-1 pl-7 pr-6 text-[10px] text-white placeholder-gray-500 outline-none focus:border-blue-500/50 rounded"
          />
          {fileSearchTerm && (
            <button onClick={() => setFileSearchTerm('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* 历史记录列表 */}
      <div className="flex-1 overflow-y-auto px-2 space-y-1 pb-2">
        {filteredHistories.length === 0 ? (
          <div className="text-gray-500 text-center mt-8 text-[10px] italic">
            {fileSearchTerm ? '未找到匹配文件' : '暂无历史记录'}
          </div>
        ) : (
          filteredHistories.map((h) => (
            <div
              key={h.id}
              className={`relative group p-2 cursor-pointer transition-all rounded border-l-2 ${
                currentId === h.id ? 'bg-blue-700/20 border-blue-600' : 'hover:bg-white/5 border-transparent'
              }`}
              onClick={() => setCurrentId(h.id)}
            >
              <div className={`text-[11px] font-bold truncate ${currentId === h.id ? 'text-blue-400' : 'text-white'}`}>
                {h.sectionTag || '未命名'}
              </div>
              <div className="text-[9px] text-gray-500 mt-0.5 flex justify-between items-center">
                <span>{h.meta.Time ? h.meta.Time.substring(0, 16) : '无时间'}</span>
                <span className="text-blue-500/60">{h.rows.length}条</span>
              </div>

              {/* 删除按钮 */}
              {(myRole === 'owner' || myRole === 'editor') && (
                <button
                  onClick={(e) => { e.stopPropagation(); setDeleteId(h.id) }}
                  className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 p-0.5"
                >
                  <X size={12} />
                </button>
              )}

              {/* 删除确认覆盖层 */}
              {deleteId === h.id && (
                <div
                  className="absolute inset-0 bg-red-900/95 z-10 flex items-center justify-between px-2 border-l-2 border-red-500 rounded"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="text-[9px] font-bold text-white">确认删除?</span>
                  <div className="flex gap-1">
                    <button onClick={() => setDeleteId(null)} className="text-[9px] px-1.5 py-0.5 bg-white/10 hover:bg-white/20 text-white rounded">否</button>
                    <button
                      onClick={() => { removeHistory(h.id); setDeleteId(null) }}
                      className="text-[9px] px-1.5 py-0.5 bg-red-600 text-white hover:bg-red-700 rounded"
                    >是</button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* 底部工具栏 */}
      <div className="p-2 border-t border-white/10 shrink-0 space-y-1" style={{ background: '#020617' }}>
        {(myRole === 'owner' || myRole === 'editor') && (
          <button
            onClick={onJoin}
            className="w-full border border-white/10 text-gray-400 hover:bg-white/5 hover:text-white py-1 px-2 flex items-center justify-center gap-1 text-[10px] font-bold transition-all rounded"
          >
            <LinkIcon size={12} />多表关联
          </button>
        )}

        {myRole === 'owner' && (
          <button
            onClick={onShowMembers}
            className="w-full border border-white/10 text-gray-400 hover:bg-white/5 hover:text-blue-400 py-1 px-2 flex items-center justify-center gap-1 text-[10px] font-bold transition-all rounded"
          >
            <Users size={12} />成员管理
          </button>
        )}

        <div className="grid grid-cols-2 gap-1">
          <button
            onClick={exportData}
            className="border border-white/10 text-gray-400 hover:bg-white/10 hover:text-blue-400 py-1.5 px-1 flex items-center justify-center gap-1 text-[9px] font-bold transition-all bg-white/5 rounded"
          >
            <Download size={10} />导出备份
          </button>
          <label className="border border-white/10 text-gray-400 hover:bg-white/10 hover:text-green-400 py-1.5 px-1 flex items-center justify-center gap-1 text-[9px] font-bold transition-all bg-white/5 cursor-pointer rounded">
            <Upload size={10} />恢复备份
            <input type="file" accept=".json" className="hidden" onChange={handleImportFile} />
          </label>
        </div>
      </div>
    </div>
  )
}
