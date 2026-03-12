'use client'

import { useState, useEffect, useCallback } from 'react'
import { Copy, Check, Trash2, Crown, Edit2, Eye, UserPlus, RefreshCw } from 'lucide-react'
import { Modal, ConfirmModal } from './Modal'
import { useApp } from '@/context/AppContext'
import type { CaseMember, CaseRole } from '@/types'

interface Props { onClose: () => void }

const ROLE_LABELS: Record<CaseRole, string> = { owner: '所有者', editor: '编辑者', viewer: '查看者' }
const ROLE_ICONS = { owner: Crown, editor: Edit2, viewer: Eye }

export default function MembersModal({ onClose }: Props) {
  const { activeCaseId } = useApp()

  const [members, setMembers] = useState<CaseMember[]>([])
  const [loading, setLoading] = useState(true)
  const [inviteRole, setInviteRole] = useState<CaseRole>('editor')
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState<CaseMember | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const fetchMembers = useCallback(async () => {
    if (!activeCaseId) return
    setLoading(true)
    const res = await fetch(`/api/cases/${activeCaseId}/members`)
    const { data } = await res.json()
    if (data) setMembers(data)
    setLoading(false)
  }, [activeCaseId])

  useEffect(() => { fetchMembers() }, [fetchMembers])

  async function handleRoleChange(member: CaseMember, newRole: CaseRole) {
    if (member.role === 'owner') return
    setUpdatingId(member.id)
    await fetch(`/api/cases/${activeCaseId}/members/${member.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: newRole }),
    })
    setMembers((prev) => prev.map((m) => m.id === member.id ? { ...m, role: newRole } : m))
    setUpdatingId(null)
  }

  async function handleRemove(member: CaseMember) {
    await fetch(`/api/cases/${activeCaseId}/members/${member.id}`, { method: 'DELETE' })
    setMembers((prev) => prev.filter((m) => m.id !== member.id))
    setConfirmRemove(null)
  }

  async function handleGenerateInvite() {
    if (!activeCaseId) return
    setGenerating(true)
    setInviteUrl(null)
    const res = await fetch(`/api/cases/${activeCaseId}/invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: inviteRole }),
    })
    const { data, error } = await res.json()
    if (error) { alert(error.message); setGenerating(false); return }
    setInviteUrl(data.inviteUrl)
    setGenerating(false)
  }

  async function handleCopy() {
    if (!inviteUrl) return
    await navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Modal isOpen onClose={onClose} title="成员管理" width="560px" height="auto">
      <div className="flex flex-col bg-white">
        {/* 成员列表 */}
        <div className="p-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-semibold" style={{ color: 'var(--text)' }}>
              当前成员 ({members.length})
            </span>
            <button onClick={fetchMembers} className="p-1 rounded hover:bg-gray-100 transition-colors" style={{ color: 'var(--text3)' }}>
              <RefreshCw size={12} />
            </button>
          </div>

          {loading ? (
            <div className="py-6 text-center text-[10px]" style={{ color: 'var(--text3)' }}>加载中...</div>
          ) : (
            <div className="space-y-1 max-h-[280px] overflow-y-auto">
              {members.map((member) => {
                const RoleIcon = ROLE_ICONS[member.role]
                const isOwner = member.role === 'owner'
                return (
                  <div key={member.id}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg border"
                    style={{ borderColor: 'var(--border)', background: '#f8fafc' }}>
                    {/* 头像 */}
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                      style={{ background: isOwner ? 'var(--accent)' : '#94a3b8' }}>
                      {(member.profile.displayName || member.profile.username).charAt(0).toUpperCase()}
                    </div>

                    {/* 名称 */}
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-medium truncate" style={{ color: 'var(--text)' }}>
                        {member.profile.displayName || member.profile.username}
                      </div>
                      <div className="text-[9px]" style={{ color: 'var(--text3)' }}>
                        @{member.profile.username}
                      </div>
                    </div>

                    {/* 角色 */}
                    {isOwner ? (
                      <div className="flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-medium"
                        style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>
                        <RoleIcon size={9} />
                        <span>{ROLE_LABELS[member.role]}</span>
                      </div>
                    ) : (
                      <select
                        disabled={updatingId === member.id}
                        value={member.role}
                        onChange={(e) => handleRoleChange(member, e.target.value as CaseRole)}
                        className="text-[9px] border rounded px-1.5 py-0.5 outline-none disabled:opacity-60"
                        style={{ borderColor: 'var(--border)', color: 'var(--text2)' }}>
                        <option value="editor">编辑者</option>
                        <option value="viewer">查看者</option>
                      </select>
                    )}

                    {/* 移除按钮 */}
                    {!isOwner && (
                      <button onClick={() => setConfirmRemove(member)}
                        className="p-1 rounded hover:bg-red-50 transition-colors"
                        style={{ color: 'var(--text3)' }}>
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* 生成邀请链接 */}
        <div className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <UserPlus size={13} style={{ color: 'var(--accent)' }} />
            <span className="text-[11px] font-semibold" style={{ color: 'var(--text)' }}>生成邀请链接</span>
          </div>

          <div className="flex gap-2 mb-3">
            <div className="flex-1">
              <label className="text-[10px] font-medium block mb-1" style={{ color: 'var(--text2)' }}>邀请角色</label>
              <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as CaseRole)}
                className="w-full border rounded-lg px-2 py-1.5 text-xs outline-none"
                style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
                <option value="editor">编辑者 — 可导入、关联、修改数据</option>
                <option value="viewer">查看者 — 仅可查看数据</option>
              </select>
            </div>
            <div className="flex items-end">
              <button onClick={handleGenerateInvite} disabled={generating}
                className="px-4 py-1.5 text-xs font-medium text-white rounded-lg disabled:opacity-60 hover:opacity-90 transition-opacity whitespace-nowrap"
                style={{ background: 'var(--accent)' }}>
                {generating ? '生成中...' : '生成链接'}
              </button>
            </div>
          </div>

          {inviteUrl && (
            <div className="border rounded-lg p-3 flex items-center gap-2"
              style={{ borderColor: 'var(--accent)', background: 'var(--accent-light)' }}>
              <div className="flex-1 min-w-0">
                <p className="text-[9px] font-medium mb-0.5" style={{ color: 'var(--accent)' }}>
                  邀请链接（7 天有效）
                </p>
                <p className="text-[10px] truncate font-mono" style={{ color: 'var(--text2)' }}>
                  {inviteUrl}
                </p>
              </div>
              <button onClick={handleCopy}
                className="p-1.5 rounded-lg flex-shrink-0 transition-colors"
                style={{ background: copied ? '#dcfce7' : 'white', color: copied ? '#16a34a' : 'var(--text2)', border: '1px solid', borderColor: copied ? '#86efac' : 'var(--border)' }}>
                {copied ? <Check size={13} /> : <Copy size={13} />}
              </button>
            </div>
          )}

          <p className="text-[9px] mt-2" style={{ color: 'var(--text3)' }}>
            链接接收者登录后点击链接即可加入本案例，每个链接有效期 7 天，不限使用次数。
          </p>
        </div>

        {/* 底部按钮 */}
        <div className="px-4 pb-4 flex justify-end">
          <button onClick={onClose}
            className="px-5 py-1.5 text-xs font-medium border rounded-lg hover:bg-gray-50 transition-colors"
            style={{ borderColor: 'var(--border)', color: 'var(--text2)' }}>
            关闭
          </button>
        </div>
      </div>

      <ConfirmModal
        isOpen={!!confirmRemove}
        onClose={() => setConfirmRemove(null)}
        onConfirm={() => confirmRemove && handleRemove(confirmRemove)}
        title="移除成员"
        message={`确定要将 "${confirmRemove?.profile.displayName || confirmRemove?.profile.username}" 从本案例移除吗？`}
        confirmText="移除"
      />
    </Modal>
  )
}
