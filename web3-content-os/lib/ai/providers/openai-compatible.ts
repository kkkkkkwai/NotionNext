import { AIError, type ChatParams, type ProviderAdapter, type ProviderCredentials, type StreamEvent } from '../types'
import { PROVIDER_META } from '../pricing'

function base(creds: ProviderCredentials) {
  return (creds.baseUrl || PROVIDER_META[creds.kind]?.baseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '')
}

function headers(creds: ProviderCredentials) {
  const h: Record<string, string> = { 'Content-Type': 'application/json', Authorization: `Bearer ${creds.apiKey}` }
  if (creds.kind === 'openrouter') {
    h['HTTP-Referer'] = 'https://web3-content-os.local'
    h['X-Title'] = 'Web3 Brand & Content OS'
  }
  return h
}

function body(params: ChatParams, stream: boolean) {
  const b: Record<string, unknown> = {
    model: params.model,
    messages: params.messages.map((m) => ({ role: m.role, content: m.content })),
    stream
  }
  if (params.temperature !== undefined && !/^o\d|^gpt-5/.test(params.model)) b.temperature = params.temperature
  if (params.maxTokens) {
    if (/^o\d|^gpt-5|^gpt-4\.1/.test(params.model)) b.max_completion_tokens = params.maxTokens
    else b.max_tokens = params.maxTokens
  }
  if (params.json) b.response_format = { type: 'json_object' }
  if (stream) b.stream_options = { include_usage: true }
  return b
}

async function readError(res: Response, kind: string) {
  const text = await res.text().catch(() => '')
  let msg = text
  try {
    const j = JSON.parse(text)
    msg = j.error?.message || j.message || text
  } catch {}
  throw new AIError(`${kind} error ${res.status}: ${msg.slice(0, 500)}`, res.status, kind)
}

export const openAICompatible: ProviderAdapter = {
  kind: 'openai',
  async chat(creds, params) {
    const res = await fetch(`${base(creds)}/chat/completions`, { method: 'POST', headers: headers(creds), body: JSON.stringify(body(params, false)), signal: params.signal })
    if (!res.ok) await readError(res, creds.kind)
    const data = await res.json()
    const choice = data.choices?.[0]
    return {
      text: choice?.message?.content ?? '',
      usage: { inputTokens: data.usage?.prompt_tokens ?? 0, outputTokens: data.usage?.completion_tokens ?? 0 },
      model: data.model ?? params.model,
      stopReason: choice?.finish_reason
    }
  },
  async *stream(creds, params): AsyncGenerator<StreamEvent> {
    const res = await fetch(`${base(creds)}/chat/completions`, { method: 'POST', headers: headers(creds), body: JSON.stringify(body(params, true)), signal: params.signal })
    if (!res.ok) await readError(res, creds.kind)
    if (!res.body) throw new AIError('No response body', 500, creds.kind)
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let usage = { inputTokens: 0, outputTokens: 0 }
    let stopReason: string | undefined
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) continue
        const payload = trimmed.slice(5).trim()
        if (payload === '[DONE]') continue
        try {
          const j = JSON.parse(payload)
          const delta = j.choices?.[0]?.delta?.content
          if (delta) yield { type: 'text', text: delta }
          if (j.choices?.[0]?.finish_reason) stopReason = j.choices[0].finish_reason
          if (j.usage) usage = { inputTokens: j.usage.prompt_tokens ?? 0, outputTokens: j.usage.completion_tokens ?? 0 }
        } catch {}
      }
    }
    yield { type: 'done', usage, stopReason }
  },
  async embed(creds, model, texts) {
    const res = await fetch(`${base(creds)}/embeddings`, { method: 'POST', headers: headers(creds), body: JSON.stringify({ model, input: texts }) })
    if (!res.ok) await readError(res, creds.kind)
    const data = await res.json()
    const vectors = (data.data as { index: number; embedding: number[] }[]).sort((a, b) => a.index - b.index).map((d) => d.embedding)
    return { vectors, usage: { inputTokens: data.usage?.prompt_tokens ?? 0, outputTokens: 0 } }
  },
  async listModels(creds) {
    const res = await fetch(`${base(creds)}/models`, { headers: headers(creds) })
    if (!res.ok) await readError(res, creds.kind)
    const data = await res.json()
    return ((data.data ?? []) as { id: string }[]).map((m) => m.id).sort()
  }
}
