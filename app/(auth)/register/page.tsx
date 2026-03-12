'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { UserPlus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function RegisterPage() {
  const router = useRouter()
  const [form, setForm] = useState({ username: '', displayName: '', password: '', confirm: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const supabase = createClient()

  function set(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const { username, displayName, password, confirm } = form
    if (!/^[a-zA-Z0-9_]{4,20}$/.test(username)) {
      return setError('用户名仅限字母、数字、下划线，4-20位')
    }
    if (password.length < 8) {
      return setError('密码至少8位')
    }
    if (password !== confirm) {
      return setError('两次密码不一致')
    }

    setLoading(true)

    const email = `${username}@eparser.internal`
    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username, display_name: displayName || username },
        emailRedirectTo: undefined,
      },
    })

    if (authError) {
      setError(authError.message.includes('already') ? '用户名已被占用' : authError.message)
      setLoading(false)
      return
    }

    // 注册成功后直接登录
    await supabase.auth.signInWithPassword({ email, password })
    router.push('/cases')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-main)' }}>
      <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-lg font-bold" style={{ color: 'var(--text)' }}>创建账号</h1>
          <p className="text-xs mt-1" style={{ color: 'var(--text3)' }}>填写信息完成注册</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          {[
            { key: 'username', label: '用户名', placeholder: '4-20位字母/数字/下划线', type: 'text' },
            { key: 'displayName', label: '显示名称', placeholder: '您希望显示的名字（可选）', type: 'text' },
            { key: 'password', label: '密码', placeholder: '至少8位', type: 'password' },
            { key: 'confirm', label: '确认密码', placeholder: '再次输入密码', type: 'password' },
          ].map(({ key, label, placeholder, type }) => (
            <div key={key}>
              <label className="block text-xs mb-1 font-medium" style={{ color: 'var(--text2)' }}>{label}</label>
              <input
                type={type}
                value={form[key as keyof typeof form]}
                onChange={(e) => set(key, e.target.value)}
                placeholder={placeholder}
                className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2"
                style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
              />
            </div>
          ))}

          {error && (
            <div className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium text-white transition-opacity disabled:opacity-60"
            style={{ background: 'var(--accent)' }}
          >
            <UserPlus size={14} />
            {loading ? '注册中...' : '注册'}
          </button>
        </form>

        <p className="text-center text-xs mt-5" style={{ color: 'var(--text3)' }}>
          已有账号？{' '}
          <Link href="/login" className="font-medium" style={{ color: 'var(--accent)' }}>
            立即登录
          </Link>
        </p>
      </div>
    </div>
  )
}
