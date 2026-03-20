'use client'

export const dynamic = 'force-dynamic'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

const inputStyle: React.CSSProperties = {
  width: '100%',
  border: '1px solid #e2e8f0',
  borderRadius: 8,
  padding: '9px 12px',
  fontSize: 13,
  color: '#0f172a',
  background: '#fff',
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.15s',
}

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect') || '/cases'
  const errorParam = searchParams.get('error')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [focusedField, setFocusedField] = useState('')
  const [error, setError] = useState(
    errorParam === 'banned' ? '账号已被封禁，请联系管理员' :
    errorParam ? '登录失败，请重试' : ''
  )

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), password }),
    })
    const json = await res.json()

    if (!res.ok || json.error) {
      setError(json.error?.message || '用户名或密码错误')
      setLoading(false)
      return
    }

    router.push(redirectTo)
    router.refresh()
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9' }}>
      <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 4px 24px rgba(0,0,0,0.08)', padding: '40px 36px', width: '100%', maxWidth: 380 }}>

        {/* 标题 */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', margin: 0 }}>电网E文件管理及数据分析工具</h1>
          <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>请登录您的账号</p>
        </div>

        {/* 表单 */}
        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#475569', marginBottom: 5 }}>邮箱</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="请输入邮箱地址"
              required
              onFocus={() => setFocusedField('email')}
              onBlur={() => setFocusedField('')}
              style={{ ...inputStyle, borderColor: focusedField === 'email' ? '#2563eb' : '#e2e8f0', boxShadow: focusedField === 'email' ? '0 0 0 3px rgba(37,99,235,0.1)' : 'none' }}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#475569', marginBottom: 5 }}>密码</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPwd ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入密码"
                required
                onFocus={() => setFocusedField('password')}
                onBlur={() => setFocusedField('')}
                style={{ ...inputStyle, paddingRight: 36, borderColor: focusedField === 'password' ? '#2563eb' : '#e2e8f0', boxShadow: focusedField === 'password' ? '0 0 0 3px rgba(37,99,235,0.1)' : 'none' }}
              />
              <button
                type="button"
                onClick={() => setShowPwd(!showPwd)}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 2, display: 'flex', alignItems: 'center' }}
              >
                {showPwd ? (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                ) : (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                )}
              </button>
            </div>
          </div>

          {error && (
            <div style={{ fontSize: 12, color: '#ef4444', background: '#fef2f2', borderRadius: 8, padding: '8px 12px', marginBottom: 16 }}>{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{ width: '100%', padding: '10px 0', borderRadius: 8, background: loading ? '#93c5fd' : '#2563eb', color: '#fff', fontSize: 14, fontWeight: 600, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', transition: 'background 0.15s', marginTop: 4 }}
          >
            {loading ? '登录中...' : '登 录'}
          </button>
        </form>

        <p style={{ textAlign: 'center', fontSize: 12, color: '#94a3b8', marginTop: 20 }}>
          没有账号？{' '}
          <Link href="/register" style={{ color: '#2563eb', fontWeight: 500 }}>立即注册</Link>
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9' }}>
        <span style={{ fontSize: 12, color: '#94a3b8' }}>加载中…</span>
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
