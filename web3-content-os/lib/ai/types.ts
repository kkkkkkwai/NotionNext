export type ProviderKind = 'openai' | 'anthropic' | 'gemini' | 'openrouter' | 'openai_compatible'

export type ChatRole = 'system' | 'user' | 'assistant'
export interface ChatMessage { role: ChatRole; content: string }

export interface ChatParams {
  model: string
  messages: ChatMessage[]
  temperature?: number
  maxTokens?: number
  json?: boolean
  signal?: AbortSignal
}

export interface ChatUsage { inputTokens: number; outputTokens: number }

export interface ChatResult { text: string; usage: ChatUsage; model: string; stopReason?: string }

export type StreamEvent =
  | { type: 'text'; text: string }
  | { type: 'done'; usage: ChatUsage; stopReason?: string }
  | { type: 'error'; error: string }

export interface ProviderCredentials {
  kind: ProviderKind
  apiKey: string
  baseUrl?: string
}

export interface ProviderAdapter {
  kind: ProviderKind
  chat(creds: ProviderCredentials, params: ChatParams): Promise<ChatResult>
  stream(creds: ProviderCredentials, params: ChatParams): AsyncGenerator<StreamEvent>
  embed?(creds: ProviderCredentials, model: string, texts: string[]): Promise<{ vectors: number[][]; usage: ChatUsage }>
  listModels?(creds: ProviderCredentials): Promise<string[]>
}

export type TaskType =
  | 'extraction'
  | 'dna'
  | 'narrative'
  | 'content_fast'
  | 'content_quality'
  | 'long_form'
  | 'translation'
  | 'consistency'
  | 'risk'
  | 'chat'
  | 'memory'
  | 'embedding'

export const TASK_TYPES: { id: TaskType; label: string; description: string; tier: 'fast' | 'strong' | 'long' | 'embedding' }[] = [
  { id: 'extraction', label: 'Information Extraction', description: 'Parse uploaded documents into structured facts', tier: 'fast' },
  { id: 'dna', label: 'Project DNA', description: 'Build the single source of truth for the brand', tier: 'strong' },
  { id: 'narrative', label: 'Narrative Engine', description: 'Core / investor / community narratives & angles', tier: 'strong' },
  { id: 'content_fast', label: 'Short Content', description: 'Tweets, Telegram posts, poster copy', tier: 'fast' },
  { id: 'content_quality', label: 'Quality Content', description: 'PR, KOL, pitch, threads, video scripts', tier: 'strong' },
  { id: 'long_form', label: 'Long Form', description: 'Whitepaper, litepaper, business plan, GitBook', tier: 'long' },
  { id: 'translation', label: 'Translation', description: 'Native multi-language localisation', tier: 'fast' },
  { id: 'consistency', label: 'Consistency Check', description: 'Detect outdated facts in historical content', tier: 'fast' },
  { id: 'risk', label: 'Risk Check', description: 'Web3 compliance / risky-claim detection', tier: 'fast' },
  { id: 'chat', label: 'Ask Project AI', description: 'Conversational project brand manager', tier: 'strong' },
  { id: 'memory', label: 'Memory Extraction', description: 'Turn decisions in chat into long-term memory', tier: 'fast' },
  { id: 'embedding', label: 'Embeddings', description: 'Knowledge base vectors', tier: 'embedding' }
]

export class AIError extends Error {
  constructor(message: string, public status = 500, public provider?: string) {
    super(message)
  }
}
