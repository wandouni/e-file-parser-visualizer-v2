import { createAdminClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

// GET /api/auth/wechat/callback — 微信 OAuth 回调
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  // 验证 state 防 CSRF
  const cookieStore = await cookies()
  const savedState = cookieStore.get('wechat_oauth_state')?.value
  if (!state || state !== savedState) {
    return Response.redirect(`${appUrl}/login?error=invalid_state`)
  }

  if (!code) {
    return Response.redirect(`${appUrl}/login?error=wechat_denied`)
  }

  // 用 code 换取 access_token
  const tokenRes = await fetch(
    `https://api.weixin.qq.com/sns/oauth2/access_token?appid=${process.env.WECHAT_APP_ID}&secret=${process.env.WECHAT_APP_SECRET}&code=${code}&grant_type=authorization_code`
  )
  const tokenData = await tokenRes.json()

  if (tokenData.errcode) {
    return Response.redirect(`${appUrl}/login?error=wechat_token_failed`)
  }

  const { access_token, openid } = tokenData

  // 获取用户信息
  const userInfoRes = await fetch(
    `https://api.weixin.qq.com/sns/userinfo?access_token=${access_token}&openid=${openid}&lang=zh_CN`
  )
  const wechatUser = await userInfoRes.json()

  const supabase = await createAdminClient()

  // 查找是否已有绑定该 openid 的账号
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id, username')
    .eq('wechat_openid', openid)
    .single()

  let userId: string

  if (existingProfile) {
    userId = existingProfile.id
  } else {
    // 创建新用户
    const username = `wx_${openid.slice(-8)}`
    const displayName = wechatUser.nickname || username

    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email: `${openid}@wechat.internal`,
      password: crypto.randomUUID(),
      email_confirm: true,
      user_metadata: { username, display_name: displayName },
    })

    if (createError || !newUser.user) {
      return Response.redirect(`${appUrl}/login?error=create_user_failed`)
    }

    userId = newUser.user.id

    // 更新 profile 写入 wechat_openid 和头像
    await supabase
      .from('profiles')
      .update({
        wechat_openid: openid,
        avatar_url: wechatUser.headimgurl,
        display_name: displayName,
      })
      .eq('id', userId)
  }

  // 生成 Magic Link 让用户完成登录（获取 Session Cookie）
  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email: `${openid}@wechat.internal`,
  })

  if (linkError || !linkData.properties?.hashed_token) {
    return Response.redirect(`${appUrl}/login?error=session_failed`)
  }

  // 重定向到 Supabase 提供的确认链接，完成 Session 建立
  return Response.redirect(linkData.properties.action_link)
}
