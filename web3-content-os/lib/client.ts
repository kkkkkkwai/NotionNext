'use client'

export class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string) {
    super(message)
  }
}

export async function api<T = unknown>(url: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json: body, headers, ...rest } = init
  const res = await fetch(url, { ...rest, headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(headers ?? {}) }, body: body !== undefined ? JSON.stringify(body) : rest.body })
  const text = await res.text()
  let data: unknown = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = { error: text }
  }
  if (!res.ok) {
    const err = (data as { error?: string; code?: string }) ?? {}
    if (res.status === 401 && typeof window !== 'undefined') window.location.href = '/login'
    throw new ApiError(err.error || `Request failed (${res.status})`, res.status, err.code)
  }
  return data as T
}

/** Reads a Server-Sent Events response, invoking onEvent for each event. */
export async function readSSE(res: Response, onEvent: (event: string, data: unknown) => void, signal?: AbortSignal) {
  if (!res.ok) {
    const t = await res.text()
    let msg = t
    try {
      msg = JSON.parse(t).error ?? t
    } catch {}
    throw new ApiError(msg || `Request failed (${res.status})`, res.status)
  }
  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    if (signal?.aborted) {
      await reader.cancel()
      break
    }
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let idx
    while ((idx = buffer.indexOf('\n\n')) !== -1) {
      const raw = buffer.slice(0, idx)
      buffer = buffer.slice(idx + 2)
      let event = 'message'
      let data = ''
      for (const line of raw.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim()
        else if (line.startsWith('data:')) data += line.slice(5).trim()
      }
      try {
        onEvent(event, data ? JSON.parse(data) : null)
      } catch {
        onEvent(event, data)
      }
    }
  }
}

export function errorMessage(e: unknown) {
  return e instanceof Error ? e.message : String(e)
}
