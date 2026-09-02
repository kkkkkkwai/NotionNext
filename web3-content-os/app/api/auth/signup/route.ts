import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createSessionCookie, signUp } from '@/lib/auth'
import { errorResponse, json } from '@/lib/api'

const Body = z.object({ email: z.string().email(), password: z.string().min(8, 'Password must be at least 8 characters'), name: z.string().optional() })

export async function POST(req: NextRequest) {
  try {
    const parsed = Body.safeParse(await req.json())
    if (!parsed.success) return json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 })
    const session = await signUp(parsed.data.email, parsed.data.password, parsed.data.name)
    await createSessionCookie(session)
    return json({ ok: true, user: { email: session.email, name: session.name } })
  } catch (err) {
    return errorResponse(err)
  }
}
