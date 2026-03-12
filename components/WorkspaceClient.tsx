'use client'

import { useState } from 'react'
import { AppProvider } from '@/context/AppContext'
import Sidebar from '@/components/Sidebar'
import MainContent from '@/components/MainContent'
import ImportModal from '@/components/ImportModal'
import JoinModal from '@/components/JoinModal'
import VizModal from '@/components/VizModal'
import ColumnConfigModal from '@/components/ColumnConfigModal'
import MembersModal from '@/components/MembersModal'
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
  const { currentId, histories } = useApp()
  const [showImport, setShowImport] = useState(false)
  const [showJoin, setShowJoin] = useState(false)
  const [showViz, setShowViz] = useState(false)
  const [showColConfig, setShowColConfig] = useState(false)
  const [showMembers, setShowMembers] = useState(false)

  const currentRecord = histories.find((h) => h.id === currentId)

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

      {showImport && <ImportModal onClose={() => setShowImport(false)} />}
      {showJoin && <JoinModal onClose={() => setShowJoin(false)} />}
      {showViz && <VizModal onClose={() => setShowViz(false)} />}
      {showColConfig && currentRecord && (
        <ColumnConfigModal record={currentRecord} onClose={() => setShowColConfig(false)} />
      )}
      {showMembers && <MembersModal onClose={() => setShowMembers(false)} />}
    </div>
  )
}
