import { AIError, type ChatParams, type ProviderAdapter, type ProviderCredentials, type StreamEvent } from '../types'
import { PROVIDER_META } from '../pricing'

function base(creds: ProviderCredentials) {
  return (creds.baseUrl || PROVIDER_META.gemini.baseUrl).replace(/\/+$/, '')
}

function body(params: ChatParams) {
  const system = params.messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n')
  const contents = params.messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }))
  if (contents.length === 0) contents.push({ role: 'user', parts: [{ text: 'Begin.' }] })
  const generationConfig: Record<string, unknown> = {}
  if (params.temperature !== undefined) generationConfig.temperature = params.temperature
  if (params.maxTokens) generationConfig.maxOutputTokens = params.maxTokens
  if (params.json) generationConfig.responseMimeType = 'application/json'
  return { contents, systemInstruction: system ? { parts: [{ text: system }] } : undefined, generationConfig }
}

async function readError(res: Response) {
  const text = await res.text().catch(() => '')
  let msg = text
  try {
    msg = JSON.parse(text).error?.message || text
  } catch {}
  throw new AIError(`Gemini error ${res.status}: ${msg.slice(0, 500)}`, res.status, 'gemini')
}

function extractText(data: any): string {
  return (data.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? '').join('')
}

export const geminiAdapter: ProviderAdapter = {
  kind: 'gemini',
  async chat(creds, params) {
    const res = await fetch(`${base(creds)}/models/${params.model}:generateContent?key=${creds.apiKey}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body(params)), signal: params.signal
    })
    if (!res.ok) await readError(res)
    const data = await res.json()
    return {
      text: extractText(data),
      usage: { inputTokens: data.usageMetadata?.promptTokenCount ?? 0, outputTokens: data.usageMetadata?.candidatesTokenCount ?? 0 },
      model: params.model,
      stopReason: data.candidates?.[0]?.finishReason
    }
  },
  async *stream(creds, params): AsyncGenerator<StreamEvent> {
    const res = await fetch(`${base(creds)}/models/${params.model}:streamGenerateContent?alt=sse&key=${creds.apiKey}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body(params)), signal: params.signal
    })
    if (!res.ok) await readError(res)
    if (!res.body) throw new AIError('No response body', 500, 'gemini')
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let usage = { inputTokens: 0, outputTokens: 0 }
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        const t = line.trim()
        if (!t.startsWith('data:')) continue
        try {
          const j = JSON.parse(t.slice(5).trim())
          const text = extractText(j)
          if (text) yield { type: 'text', text }
          if (j.usageMetadata) usage = { inputTokens: j.usageMetadata.promptTokenCount ?? 0, outputTokens: j.usageMetadata.candidatesTokenCount ?? 0 }
        } catch {}
      }
    }
    yield { type: 'done', usage }
  },
  async embed(creds, model, texts) {
    const res = await fetch(`${base(creds)}/models/${model}:batchEmbedContents?key=${creds.apiKey}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests: texts.map((t) => ({ model: `models/${model}`, content: { parts: [{ text: t }] } })) })
    })
    if (!res.ok) await readError(res)
    const data = await res.json()
    return { vectors: (data.embeddings ?? []).map((e: { values: number[] }) => e.values), usage: { inputTokens: 0, outputTokens: 0 } }
  },
  async listModels(creds) {
    const res = await fetch(`${base(creds)}/models?key=${creds.apiKey}&pageSize=200`)
    if (!res.ok) await readError(res)
    const data = await res.json()
    return ((data.models ?? []) as { name: string }[]).map((m) => m.name.replace(/^models\//, '')).sort()
  }
}
