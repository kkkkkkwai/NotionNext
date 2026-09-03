import { NextResponse, type NextRequest } from 'next/server'

export function middleware(req: NextRequest) {
  const res = NextResponse.next()
  res.headers.set('x-pathname', req.nextUrl.pathname)
  // Also forward for server components via request headers
  const requestHeaders = new Headers(req.headers)
  requestHeaders.set('x-pathname', req.nextUrl.pathname)
  return NextResponse.next({ request: { headers: requestHeaders } })
}

export const config = { matcher: ['/((?!_next|api|favicon.ico|.*\\..*).*)'] }
