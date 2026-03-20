'use client'

import { useState } from 'react'
import { AppProvider } from '@/context/AppContext'
import Sidebar from '@/components/Sidebar'
import MainContent from '@/components/MainContent'
import ImportModal from '@/components/ImportModal'
import JoinModal from '@/components/JoinModal'
import VizModal from '@/components/VizModal'
import ColumnConfigModal from '@/components/ColumnConfigModal'
import { useApp } from '@/context/AppContext'
import type { Case, Profile } from '@/types'

export default function WorkspaceClient({
  caseData,
  profile,
}: {
  caseData: Case
  profile: Profile | null
}) {
  return (
    <AppProvider profile={profile} initialCase={caseData}>
      <WorkspaceInner />
    </AppProvider>
  )
}

function WorkspaceInner() {
  const { currentId, histories, loading } = useApp()
  const [showImport, setShowImport] = useState(false)
  const [showJoin, setShowJoin] = useState(false)
  const [showViz, setShowViz] = useState(false)
  const [showColConfig, setShowColConfig] = useState(false)

  const currentRecord = histories.find((h) => h.id === currentId)

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#f1f5f9', position: 'relative' }}>
      <Sidebar
        onImport={() => setShowImport(true)}
        onJoin={() => setShowJoin(true)}
      />
      <MainContent
        onViz={() => setShowViz(true)}
        onColConfig={() => setShowColConfig(true)}
      />

      {/* 数据加载中遮罩 */}
      {loading && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(241,245,249,0.75)', zIndex: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite', flexShrink: 0 }}>
            <line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/>
            <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/>
            <line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/>
            <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/>
          </svg>
          <span style={{ fontSize: 13, color: '#2563eb', fontWeight: 600 }}>数据加载中…</span>
          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {showImport && <ImportModal onClose={() => setShowImport(false)} />}
      {showJoin && <JoinModal onClose={() => setShowJoin(false)} />}
      {showViz && <VizModal onClose={() => setShowViz(false)} />}
      {showColConfig && currentRecord && (
        <ColumnConfigModal record={currentRecord} onClose={() => setShowColConfig(false)} />
      )}
    </div>
  )
}
