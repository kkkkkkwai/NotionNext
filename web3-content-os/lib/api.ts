import { NextResponse, type NextRequest } from 'next/server'
import { AuthError, getSession, type Session } from './auth'
import { getProject } from './services/projects'
import { AIError } from './ai/types'
import type { Project } from './db/schema'
import { describeError } from './utils'

type Params = { params: Record<string, string> }
export type Ctx = { session: Session; req: NextRequest; params: Record<string, string>; body: <T = Record<string, unknown>>() => Promise<T> }
export type ProjectCtx = Ctx & { project: Project; ctx: { orgId: string; projectId: string; userId: string } }

export function json(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, init)
}

export function errorResponse(err: unknown) {
  if (err instanceof AuthError) return json({ error: '未登录或登录已过期' }, { status: 401 })
  if (err instanceof AIError) return json({ error: err.message, provider: err.provider, code: err.status === 424 ? 'NO_PROVIDER' : 'AI_ERROR' }, { status: err.status >= 400 && err.status < 600 ? err.status : 500 })
  const message = describeError(err)
  console.error('[api]', err)
  const status = /not found/i.test(message) ? 404 : /unauthori/i.test(message) ? 401 : /permission|not allowed|cannot be/i.test(message) ? 403 : 400
  return json({ error: message }, { status })
}

async function parseBody<T>(req: NextRequest): Promise<T> {
  const ct = req.headers.get('content-type') ?? ''
  if (ct.includes('application/json')) {
    try {
      return (await req.json()) as T
    } catch {
      return {} as T
    }
  }
  return {} as T
}

export function withAuth(handler: (c: Ctx) => Promise<Response>) {
  return async (req: NextRequest, { params }: Params) => {
    try {
      const session = await getSession()
      if (!session) throw new AuthError('Unauthorized')
      return await handler({ session, req, params: params ?? {}, body: <T,>() => parseBody<T>(req) })
    } catch (err) {
      return errorResponse(err)
    }
  }
}

export function withProject(handler: (c: ProjectCtx) => Promise<Response>) {
  return withAuth(async (c) => {
    const id = c.params.id
    const project = await getProject(c.session.orgId, id)
    if (!project) return json({ error: '项目不存在' }, { status: 404 })
    return handler({ ...c, project, ctx: { orgId: c.session.orgId, projectId: project.id, userId: c.session.userId } })
  })
}

/** Server-Sent Events response from an async generator of {event,data}. */
export function sse(gen: AsyncGenerator<{ event: string; data: unknown }>) {
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const ev of gen) controller.enqueue(encoder.encode(`event: ${ev.event}\ndata: ${JSON.stringify(ev.data)}\n\n`))
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ message })}\n\n`))
      } finally {
        controller.close()
      }
    }
  })
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' } })
}
