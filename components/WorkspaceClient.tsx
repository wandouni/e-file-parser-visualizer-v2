'use client'

import { useState } from 'react'
import { AppProvider } from '@/context/AppContext'
import Sidebar from '@/components/Sidebar'
import MainContent from '@/components/MainContent'
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
  const [showImport, setShowImport] = useState(false)
  const [showJoin, setShowJoin] = useState(false)
  const [showViz, setShowViz] = useState(false)
  const [showColConfig, setShowColConfig] = useState(false)
  const [showMembers, setShowMembers] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-main)' }}>
      <Sidebar
        onImport={() => setShowImport(true)}
        onJoin={() => setShowJoin(true)}
        onShowMembers={() => setShowMembers(true)}
      />
      <MainContent
        onViz={() => setShowViz(true)}
        onColConfig={() => setShowColConfig(true)}
      />
      {/* 懒加载各弹窗 */}
      {showImport && (
        <ImportModalLazy onClose={() => setShowImport(false)} />
      )}
      {showJoin && (
        <JoinModalLazy onClose={() => setShowJoin(false)} />
      )}
      {showViz && (
        <VizModalLazy onClose={() => setShowViz(false)} />
      )}
      {showColConfig && (
        <ColConfigModalLazy onClose={() => setShowColConfig(false)} />
      )}
      {showMembers && (
        <MembersModalLazy onClose={() => setShowMembers(false)} />
      )}
    </div>
  )
}

// 懒加载占位（真实组件后续实现）
function ImportModalLazy({ onClose }: { onClose: () => void }) {
  return <div>ImportModal placeholder <button onClick={onClose}>X</button></div>
}
function JoinModalLazy({ onClose }: { onClose: () => void }) {
  return <div>JoinModal placeholder <button onClick={onClose}>X</button></div>
}
function VizModalLazy({ onClose }: { onClose: () => void }) {
  return <div>VizModal placeholder <button onClick={onClose}>X</button></div>
}
function ColConfigModalLazy({ onClose }: { onClose: () => void }) {
  return <div>ColConfigModal placeholder <button onClick={onClose}>X</button></div>
}
function MembersModalLazy({ onClose }: { onClose: () => void }) {
  return <div>MembersModal placeholder <button onClick={onClose}>X</button></div>
}
