import { err } from '@/lib/utils'
import { generateToken } from '@/lib/utils'

// GET /api/auth/wechat/login — 发起微信 OAuth
export async function GET(request: Request) {
  const appId = process.env.WECHAT_APP_ID
  const callbackUrl = process.env.WECHAT_CALLBACK_URL

  if (!appId || !callbackUrl) {
    return err('微信登录未配置', 500)
  }

  // 生成 state 防 CSRF
  const state = generateToken()

  // 将 state 存入 Cookie（10分钟有效）
  const params = new URLSearchParams({
    appid: appId,
    redirect_uri: callbackUrl,
    response_type: 'code',
    scope: 'snsapi_login',
    state,
  })

  const wechatUrl = `https://open.weixin.qq.com/connect/qrconnect?${params.toString()}#wechat_redirect`

  const response = new Response(null, {
    status: 302,
    headers: { Location: wechatUrl },
  })

  response.headers.append(
    'Set-Cookie',
    `wechat_oauth_state=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600`
  )

  return response
}
