import { NextResponse, type NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'dev-secret-change-in-production'
)

const PUBLIC_PATHS = [
  '/login',
  '/register',
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/logout',
  '/invite/',
]

async function getSessionUser(req: NextRequest) {
  const token = req.cookies.get('session')?.value
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return payload as { id: string; email: string; username: string; isAdmin: boolean }
  } catch {
    return null
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  const user = await getSessionUser(request)

  // Not logged in → protect app routes
  if (!user) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ data: null, error: { message: '未登录' } }, { status: 401 })
    }
    if (pathname.startsWith('/cases') || pathname.startsWith('/admin') || pathname.startsWith('/invite')) {
      const loginUrl = request.nextUrl.clone()
      loginUrl.pathname = '/login'
      loginUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(loginUrl)
    }
    return NextResponse.next()
  }

  // Logged-in users visiting login/register → redirect to app
  if (pathname === '/login' || pathname === '/register') {
    return NextResponse.redirect(new URL('/cases', request.url))
  }

  // Admin route guard
  if (pathname.startsWith('/admin') && !user.isAdmin) {
    return NextResponse.redirect(new URL('/cases', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
