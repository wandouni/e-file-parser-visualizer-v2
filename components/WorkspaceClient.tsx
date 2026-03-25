'use client'

import { useState, useEffect } from 'react'
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
  // Mobile sidebar overlay state — on desktop the CSS doesn't apply so it's always visible
  const [sidebarOpen, setSidebarOpen] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 768 : true
  )

  const currentRecord = histories.find((h) => h.id === currentId)

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg-main)', position: 'relative' }}>

      {/* Mobile backdrop — CSS hides this on desktop via .sidebar-backdrop { display:none } */}
      {sidebarOpen && (
        <div
          className="sidebar-backdrop"
          aria-hidden="true"
          onClick={() => setSidebarOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 99, cursor: 'pointer' }}
        />
      )}

      {/* Sidebar wrapper — CSS applies mobile overlay behaviour via .sidebar-panel */}
      <div className={`sidebar-panel${sidebarOpen ? ' is-open' : ''}`} style={{ flexShrink: 0, height: '100%' }}>
        <Sidebar
          onImport={() => setShowImport(true)}
          onJoin={() => setShowJoin(true)}
          onRequestClose={() => setSidebarOpen(false)}
        />
      </div>

      <main style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <MainContent
          onViz={() => setShowViz(true)}
          onColConfig={() => setShowColConfig(true)}
          onToggleSidebar={() => setSidebarOpen((s) => !s)}
        />
      </main>

      {/* 数据加载中遮罩 — @keyframes spin is defined in globals.css */}
      {loading && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(241,245,249,0.75)', zIndex: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite', flexShrink: 0 }}>
            <line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/>
            <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/>
            <line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/>
            <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/>
          </svg>
          <span style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 600 }}>数据加载中…</span>
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
