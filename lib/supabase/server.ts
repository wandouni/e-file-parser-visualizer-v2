import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

// 服务端 Supabase Client（每次请求新建，携带用户 Cookie）
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component 中无法设置 Cookie，忽略此错误
          }
        },
      },
    }
  )
}

// Service Role Client（真正绕过 RLS）
//
// 设计要点：
//   - DB 操作（from/rpc/storage）使用 service_role key 作为 Bearer → PostgREST 以
//     service_role 角色执行 → 完全绕过 RLS
//   - auth.getUser() 通过独立的 cookie 用户客户端（anon key + cookies）读取，
//     保证身份验证正确
//   - 用 Proxy 拦截 auth 属性，其余属性透传给原始 adminDb，避免影响 fetch 拦截器
export async function createAdminClient() {
  const cookieStore = await cookies()

  // 用户 cookie 客户端：仅用于 auth.getUser()，读取用户 JWT
  const userAuthClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll() {},
      },
    }
  )

  // 真正的 admin 客户端：service role key，DB fetch 拦截器使用 service_role JWT
  const adminDb = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Proxy：auth 属性 → userAuthClient.auth（读 cookie），其余 → adminDb（service_role）
  return new Proxy(adminDb, {
    get(target, prop, receiver) {
      if (prop === 'auth') return userAuthClient.auth
      const value = Reflect.get(target, prop, receiver)
      return typeof value === 'function' ? value.bind(target) : value
    },
  }) as typeof adminDb
}
