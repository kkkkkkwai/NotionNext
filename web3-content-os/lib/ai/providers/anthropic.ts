import Anthropic from '@anthropic-ai/sdk'
import { AIError, type ChatParams, type ProviderAdapter, type ProviderCredentials, type StreamEvent } from '../types'

function client(creds: ProviderCredentials) {
  return new Anthropic({ apiKey: creds.apiKey, baseURL: creds.baseUrl || undefined, maxRetries: 2 })
}

function split(params: ChatParams) {
  const system = params.messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n')
  const messages: Anthropic.MessageParam[] = params.messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))
  if (messages.length === 0 || messages[0].role !== 'user') messages.unshift({ role: 'user', content: 'Begin.' })
  if (params.json) messages.push({ role: 'user', content: 'Respond with valid JSON only. No prose, no markdown fences.' })
  return { system: system || undefined, messages }
}

function wrap(err: unknown): never {
  if (err instanceof Anthropic.APIError) throw new AIError(`Anthropic error ${err.status}: ${err.message}`, err.status ?? 500, 'anthropic')
  throw err
}

export const anthropicAdapter: ProviderAdapter = {
  kind: 'anthropic',
  async chat(creds, params) {
    const { system, messages } = split(params)
    try {
      // Thinking is intentionally omitted so any Claude model (Haiku 4.5 through Opus 5) accepts the request.
      // Temperature is omitted: it is rejected on the current-generation models.
      const res = await client(creds).messages.create({ model: params.model, max_tokens: params.maxTokens ?? 8192, system, messages }, { signal: params.signal })
      if (res.stop_reason === 'refusal') throw new AIError('模型拒绝了本次请求（安全策略）。', 400, 'anthropic')
      const text = res.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map((b) => b.text).join('')
      return { text, usage: { inputTokens: res.usage.input_tokens, outputTokens: res.usage.output_tokens }, model: res.model, stopReason: res.stop_reason ?? undefined }
    } catch (err) {
      wrap(err)
    }
  },
  async *stream(creds, params): AsyncGenerator<StreamEvent> {
    const { system, messages } = split(params)
    try {
      const stream = client(creds).messages.stream({ model: params.model, max_tokens: params.maxTokens ?? 8192, system, messages }, { signal: params.signal })
      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') yield { type: 'text', text: event.delta.text }
      }
      const final = await stream.finalMessage()
      yield { type: 'done', usage: { inputTokens: final.usage.input_tokens, outputTokens: final.usage.output_tokens }, stopReason: final.stop_reason ?? undefined }
    } catch (err) {
      wrap(err)
    }
  },
  async listModels(creds) {
    try {
      const out: string[] = []
      for await (const m of client(creds).models.list()) out.push(m.id)
      return out
    } catch (err) {
      wrap(err)
    }
  }
}
