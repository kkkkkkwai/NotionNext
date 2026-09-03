/** Approximate USD per 1M tokens. Used for cost dashboards only. */
export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  // OpenAI
  'gpt-4o': { input: 2.5, output: 10 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4.1': { input: 2, output: 8 },
  'gpt-4.1-mini': { input: 0.4, output: 1.6 },
  'gpt-4.1-nano': { input: 0.1, output: 0.4 },
  'o3': { input: 2, output: 8 },
  'o4-mini': { input: 1.1, output: 4.4 },
  'gpt-5': { input: 1.25, output: 10 },
  'gpt-5-mini': { input: 0.25, output: 2 },
  'gpt-5-nano': { input: 0.05, output: 0.4 },
  'text-embedding-3-small': { input: 0.02, output: 0 },
  'text-embedding-3-large': { input: 0.13, output: 0 },
  // Anthropic
  'claude-opus-5': { input: 5, output: 25 },
  'claude-sonnet-5': { input: 2, output: 10 },
  'claude-opus-4-8': { input: 5, output: 25 },
  'claude-opus-4-7': { input: 5, output: 25 },
  'claude-opus-4-6': { input: 5, output: 25 },
  'claude-sonnet-4-6': { input: 3, output: 15 },
  'claude-haiku-4-5': { input: 1, output: 5 },
  // Google
  'gemini-2.5-pro': { input: 1.25, output: 10 },
  'gemini-2.5-flash': { input: 0.3, output: 2.5 },
  'gemini-2.5-flash-lite': { input: 0.1, output: 0.4 },
  'gemini-2.0-flash': { input: 0.1, output: 0.4 },
  'text-embedding-004': { input: 0, output: 0 },
  'gemini-embedding-001': { input: 0.15, output: 0 },
  // DeepSeek
  'deepseek-chat': { input: 0.27, output: 1.1 },
  'deepseek-reasoner': { input: 0.55, output: 2.19 }
}

/** Used when billing platform credits for a model without a known price list. */
export const FALLBACK_PRICING = { input: 1, output: 4 }

export function estimateCost(model: string, inputTokens: number, outputTokens: number, override?: { input: number; output: number }) {
  const key = Object.keys(MODEL_PRICING).find((k) => model === k || model.endsWith('/' + k) || model.startsWith(k))
  const p = override ?? (key ? MODEL_PRICING[key] : undefined)
  if (!p) return 0
  return (inputTokens * p.input + outputTokens * p.output) / 1_000_000
}

/** Suggested models per provider for each task tier. */
export const DEFAULT_MODELS: Record<string, { fast: string; strong: string; long: string; embedding?: string }> = {
  openai: { fast: 'gpt-4o-mini', strong: 'gpt-4o', long: 'gpt-4.1', embedding: 'text-embedding-3-small' },
  anthropic: { fast: 'claude-haiku-4-5', strong: 'claude-opus-5', long: 'claude-sonnet-5' },
  gemini: { fast: 'gemini-2.5-flash', strong: 'gemini-2.5-pro', long: 'gemini-2.5-pro', embedding: 'gemini-embedding-001' },
  openrouter: { fast: 'openai/gpt-4o-mini', strong: 'anthropic/claude-opus-5', long: 'google/gemini-2.5-pro', embedding: 'openai/text-embedding-3-small' },
  openai_compatible: { fast: 'deepseek-chat', strong: 'deepseek-chat', long: 'deepseek-chat' }
}

export const PROVIDER_META: Record<string, { label: string; baseUrl: string; docs: string; envKey?: string }> = {
  openai: { label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', docs: 'https://platform.openai.com/api-keys', envKey: 'OPENAI_API_KEY' },
  anthropic: { label: 'Anthropic Claude', baseUrl: 'https://api.anthropic.com', docs: 'https://console.anthropic.com/settings/keys', envKey: 'ANTHROPIC_API_KEY' },
  gemini: { label: 'Google Gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta', docs: 'https://aistudio.google.com/app/apikey', envKey: 'GOOGLE_API_KEY' },
  openrouter: { label: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', docs: 'https://openrouter.ai/keys', envKey: 'OPENROUTER_API_KEY' },
  openai_compatible: { label: 'OpenAI 兼容接口（DeepSeek、Grok、本地模型…）', baseUrl: 'https://api.deepseek.com/v1', docs: '' }
}
