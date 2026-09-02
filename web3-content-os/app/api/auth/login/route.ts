import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createSessionCookie, signIn } from '@/lib/auth'
import { errorResponse, json } from '@/lib/api'

const Body = z.object({ email: z.string().email(), password: z.string().min(1) })

export async function POST(req: NextRequest) {
  try {
    const parsed = Body.safeParse(await req.json())
    if (!parsed.success) return json({ error: 'Invalid email or password' }, { status: 400 })
    const session = await signIn(parsed.data.email, parsed.data.password)
    await createSessionCookie(session)
    return json({ ok: true, user: { email: session.email, name: session.name } })
  } catch (err) {
    return errorResponse(err)
  }
}
