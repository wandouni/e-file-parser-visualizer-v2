import { createBrowserClient } from '@supabase/ssr'

// 浏览器端单例 Supabase Client
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
