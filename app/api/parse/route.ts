import { getUser } from '@/lib/auth/session'
import { parseText } from '@/lib/parser'
import { ok, err } from '@/lib/utils'

export async function POST(request: Request) {
  const user = await getUser()
  if (!user) return err('未登录', 401)

  const body = await request.json()
  const { text, fileName } = body as { text: string; fileName?: string }

  if (!text || typeof text !== 'string') {
    return err('text 字段不能为空')
  }

  const result = parseText(text, fileName)
  if (!result.ok) {
    return err(result.msg || '解析失败')
  }

  return ok(result.record)
}
