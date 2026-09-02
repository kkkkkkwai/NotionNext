import type { ProviderAdapter, ProviderKind } from '../types'
import { openAICompatible } from './openai-compatible'
import { anthropicAdapter } from './anthropic'
import { geminiAdapter } from './gemini'

export function getAdapter(kind: ProviderKind): ProviderAdapter {
  switch (kind) {
    case 'anthropic':
      return anthropicAdapter
    case 'gemini':
      return geminiAdapter
    default:
      return openAICompatible
  }
}
