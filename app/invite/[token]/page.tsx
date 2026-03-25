'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import LiveSpec from '@/components/LiveSpec'
import { spec, pageName } from './live-spec'
import { history } from './live-spec.history'

export default function InvitePage() {
  const { token } = useParams<{ token: string }>()
  const router = useRouter()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    async function accept() {
      const res = await fetch(`/api/invite/${token}`)
      const { data, error } = await res.json()
      if (error) {
        setStatus('error')
        setMessage(error.message ?? '链接无效或已过期')
      } else {
        setStatus('success')
        setMessage('已成功加入案例，正在跳转...')
        setTimeout(() => router.push(`/cases/${data.caseId}`), 1500)
      }
    }
    accept()
  }, [token, router])

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-main)' }}>
      <LiveSpec content={spec} pageName={pageName} history={history} />
      <div className="bg-white border rounded-xl shadow-lg p-8 text-center max-w-sm w-full" style={{ borderColor: 'var(--border)' }}>
        {status === 'loading' && (
          <>
            <div className="w-10 h-10 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-4" style={{ borderColor: 'var(--accent)' }} />
            <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>正在处理邀请链接...</p>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-4 text-white text-xl" style={{ background: '#22c55e' }}>✓</div>
            <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{message}</p>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-4 text-white text-xl" style={{ background: 'var(--danger)' }}>✕</div>
            <p className="text-sm font-medium mb-1" style={{ color: 'var(--text)' }}>加入失败</p>
            <p className="text-xs" style={{ color: 'var(--text3)' }}>{message}</p>
            <button onClick={() => router.push('/cases')}
              className="mt-4 px-4 py-1.5 text-xs font-medium text-white rounded-lg"
              style={{ background: 'var(--accent)' }}>
              返回案例列表
            </button>
          </>
        )}
      </div>
    </div>
  )
}
