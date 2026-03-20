'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
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

export default function RegisterPage() {
  const router = useRouter()
  const [form, setForm] = useState({ email: '', displayName: '', password: '', confirm: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [focusedField, setFocusedField] = useState('')

  function set(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const { email, displayName, password, confirm } = form
    if (password.length < 8) return setError('密码至少8位')
    if (password !== confirm) return setError('两次密码不一致')

    setLoading(true)

    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), password, displayName: displayName.trim() || undefined }),
    })
    const json = await res.json()

    if (!res.ok || json.error) {
      setError(json.error?.message || '注册失败，请重试')
      setLoading(false)
      return
    }

    router.push('/cases')
    router.refresh()
  }

  const fields: { key: keyof typeof form; label: string; placeholder: string; type: string }[] = [
    { key: 'email', label: '邮箱', placeholder: '请输入邮箱地址', type: 'email' },
    { key: 'displayName', label: '昵称', placeholder: '显示名称（可选）', type: 'text' },
    { key: 'password', label: '密码', placeholder: '至少8位', type: 'password' },
    { key: 'confirm', label: '确认密码', placeholder: '再次输入密码', type: 'password' },
  ]

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9' }}>
      <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 4px 24px rgba(0,0,0,0.08)', padding: '40px 36px', width: '100%', maxWidth: 380 }}>

        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
            </svg>
          </div>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', margin: 0 }}>创建账号</h1>
          <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>填写信息完成注册</p>
        </div>

        <form onSubmit={handleRegister}>
          {fields.map(({ key, label, placeholder, type }) => (
            <div key={key} style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#475569', marginBottom: 5 }}>{label}</label>
              <input
                type={type}
                value={form[key]}
                onChange={(e) => set(key, e.target.value)}
                placeholder={placeholder}
                required={key !== 'displayName'}
                onFocus={() => setFocusedField(key)}
                onBlur={() => setFocusedField('')}
                style={{ ...inputStyle, borderColor: focusedField === key ? '#2563eb' : '#e2e8f0', boxShadow: focusedField === key ? '0 0 0 3px rgba(37,99,235,0.1)' : 'none' }}
              />
            </div>
          ))}

          {error && (
            <div style={{ fontSize: 12, color: '#ef4444', background: '#fef2f2', borderRadius: 8, padding: '8px 12px', marginBottom: 16 }}>{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{ width: '100%', padding: '10px 0', borderRadius: 8, background: loading ? '#93c5fd' : '#2563eb', color: '#fff', fontSize: 14, fontWeight: 600, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', transition: 'background 0.15s', marginTop: 4 }}
          >
            {loading ? '注册中...' : '注 册'}
          </button>
        </form>

        <p style={{ textAlign: 'center', fontSize: 12, color: '#94a3b8', marginTop: 20 }}>
          已有账号？{' '}
          <Link href="/login" style={{ color: '#2563eb', fontWeight: 500 }}>立即登录</Link>
        </p>
      </div>
    </div>
  )
}
