'use client'

export const dynamic = 'force-dynamic'

import { useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Suspense } from 'react'

function WechatCallbackInner() {
  const params = useSearchParams()
  const router = useRouter()

  useEffect(() => {
    const code = params.get('code')
    const state = params.get('state')
    if (!code || !state) {
      router.replace('/login?error=wechat_failed')
      return
    }
    // The actual OAuth exchange happens server-side at /api/auth/wechat/callback
    // This page is only reached if the redirect URL points here instead.
    // Normally the API route handles the full redirect chain.
    router.replace(`/api/auth/wechat/callback?code=${code}&state=${state}`)
  }, [params, router])

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-main)' }}>
      <div className="text-center">
        <div className="w-10 h-10 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-4" style={{ borderColor: 'var(--accent)' }} />
        <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>正在完成微信登录...</p>
      </div>
    </div>
  )
}

export default function WechatCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--accent)' }} />
      </div>
    }>
      <WechatCallbackInner />
    </Suspense>
  )
}
