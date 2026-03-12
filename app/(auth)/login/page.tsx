'use client'

export const dynamic = 'force-dynamic'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff, LogIn } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect') || '/cases'
  const errorParam = searchParams.get('error')

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(
    errorParam === 'banned' ? '账号已被封禁，请联系管理员' :
    errorParam ? '登录失败，请重试' : ''
  )

  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const email = `${username.trim()}@eparser.internal`
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      setError('用户名或密码错误')
      setLoading(false)
      return
    }

    router.push(redirectTo)
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-main)' }}>
      <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-sm">
        {/* 标题 */}
        <div className="text-center mb-8">
          <h1 className="text-lg font-bold" style={{ color: 'var(--text)' }}>电网E文件管理工具</h1>
          <p className="text-xs mt-1" style={{ color: 'var(--text3)' }}>请登录您的账号</p>
        </div>

        {/* 表单 */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs mb-1 font-medium" style={{ color: 'var(--text2)' }}>用户名</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="请输入用户名"
              required
              className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2"
              style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
            />
          </div>

          <div>
            <label className="block text-xs mb-1 font-medium" style={{ color: 'var(--text2)' }}>密码</label>
            <div className="relative">
              <input
                type={showPwd ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入密码"
                required
                className="w-full border rounded-lg px-3 py-2 pr-9 text-sm outline-none focus:ring-2"
                style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
              />
              <button
                type="button"
                onClick={() => setShowPwd(!showPwd)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1"
                style={{ color: 'var(--text3)' }}
              >
                {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium text-white transition-opacity disabled:opacity-60"
            style={{ background: 'var(--accent)' }}
          >
            <LogIn size={14} />
            {loading ? '登录中...' : '登录'}
          </button>
        </form>

        {/* 分隔线 */}
        <div className="relative my-5">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t" style={{ borderColor: 'var(--border)' }} />
          </div>
          <div className="relative flex justify-center text-xs" style={{ color: 'var(--text3)' }}>
            <span className="bg-white px-2">或</span>
          </div>
        </div>

        {/* 微信登录 */}
        <a
          href="/api/auth/wechat/login"
          className="w-full flex items-center justify-center gap-2 border rounded-lg py-2.5 text-sm font-medium transition-colors hover:bg-green-50"
          style={{ borderColor: '#07c160', color: '#07c160' }}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="#07c160">
            <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 4.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178 1.17 1.17 0 0 1-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 0 1 .598.082l1.584.926a.272.272 0 0 0 .14.047c.134 0 .24-.111.24-.247 0-.06-.023-.12-.038-.177l-.327-1.233a.582.582 0 0 1-.023-.156.49.49 0 0 1 .201-.398C23.024 18.48 24 16.82 24 14.98c0-3.21-2.931-5.837-7.062-6.122zm-3.74 2.71c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.97-.982zm4.844 0c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.969-.982z"/>
          </svg>
          微信扫码登录
        </a>

        <p className="text-center text-xs mt-5" style={{ color: 'var(--text3)' }}>
          没有账号？{' '}
          <Link href="/register" className="font-medium" style={{ color: 'var(--accent)' }}>
            立即注册
          </Link>
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-main)' }}><span className="text-xs" style={{ color: 'var(--text3)' }}>加载中…</span></div>}>
      <LoginForm />
    </Suspense>
  )
}
