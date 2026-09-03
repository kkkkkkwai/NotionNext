export type ProviderKind = 'openai' | 'anthropic' | 'gemini' | 'openrouter' | 'openai_compatible' | 'ollama' | 'lmstudio'

/** Local providers do not need an API key. */
export const LOCAL_PROVIDERS: ProviderKind[] = ['ollama', 'lmstudio']

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
  { id: 'extraction', label: '资料信息提取', description: '从上传资料中提取结构化事实', tier: 'fast' },
  { id: 'dna', label: '项目 DNA', description: '构建品牌的唯一事实来源', tier: 'strong' },
  { id: 'narrative', label: '叙事引擎', description: '核心/投资人/社区叙事与传播角度', tier: 'strong' },
  { id: 'content_fast', label: '短内容生成', description: '推文、Telegram、海报文案', tier: 'fast' },
  { id: 'content_quality', label: '高质量内容', description: 'PR、KOL、Pitch、Thread、视频脚本', tier: 'strong' },
  { id: 'long_form', label: '长文档', description: '白皮书、Litepaper、商业计划书、GitBook', tier: 'long' },
  { id: 'translation', label: '多语言翻译', description: '本地化改写而非逐字翻译', tier: 'fast' },
  { id: 'consistency', label: '一致性检查', description: '识别历史内容中的过时数据', tier: 'fast' },
  { id: 'risk', label: '风险检查', description: 'Web3 合规与风险表述检测', tier: 'fast' },
  { id: 'chat', label: '项目 AI 问答', description: '项目专属 AI 品牌经理对话', tier: 'strong' },
  { id: 'memory', label: '记忆提取', description: '把对话中的决策沉淀为长期记忆', tier: 'fast' },
  { id: 'embedding', label: '向量 Embedding', description: '知识库向量化', tier: 'embedding' }
]

export class AIError extends Error {
  constructor(message: string, public status = 500, public provider?: string) {
    super(message)
  }
}
