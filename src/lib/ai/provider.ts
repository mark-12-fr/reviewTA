import type { z } from 'zod'

/**
 * One shape for model input, whichever provider is behind it.
 */
export type Part =
  | { kind: 'text'; text: string }
  | { kind: 'image'; mediaType: string; data: string }
  | { kind: 'pdf'; data: string; name?: string }

export interface Turn {
  role: 'user' | 'assistant'
  content: string
}

export interface StructuredRequest<T> {
  system: string
  parts: Part[]
  schema: z.ZodType<T>
  /** What is being asked for, used in error messages. */
  label: string
  /** "deep" buys more reasoning where correctness matters most. */
  effort?: 'standard' | 'deep'
  maxTokens?: number
}

export interface Provider {
  id: 'anthropic' | 'gemini'
  label: string
  model: string
  /** True when the provider has a no-cost tier. */
  free: boolean
  structured<T>(request: StructuredRequest<T>): Promise<T>
  streamText(request: { system: string; turns: Turn[]; maxTokens?: number }): AsyncIterable<string>
}

export class AINotConfiguredError extends Error {
  constructor() {
    super(
      'No AI key found. Add ANTHROPIC_API_KEY (Claude, paid) or GEMINI_API_KEY (Google, has a free tier) to the .env file in the project root, then restart the dev server.'
    )
    this.name = 'AINotConfiguredError'
  }
}

function anthropicKey() {
  return process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN || ''
}

function geminiKey() {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || ''
}

export type ProviderId = 'anthropic' | 'gemini'

/**
 * Claude wins when its key is present because it is the more accurate of the
 * two; Gemini is the free fallback. AI_PROVIDER overrides the choice.
 */
export function chooseProviderId(): ProviderId | null {
  const forced = (process.env.AI_PROVIDER ?? '').toLowerCase()
  if (forced === 'anthropic') return anthropicKey() ? 'anthropic' : null
  if (forced === 'gemini' || forced === 'google') return geminiKey() ? 'gemini' : null

  if (anthropicKey()) return 'anthropic'
  if (geminiKey()) return 'gemini'
  return null
}

export function isAIConfigured(): boolean {
  return chooseProviderId() !== null
}

/** Strips markdown fences and stray prose so JSON.parse has a chance. */
export function extractJson(raw: string): string {
  let text = raw.trim()

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced) text = fenced[1].trim()

  const firstBrace = text.indexOf('{')
  const lastBrace = text.lastIndexOf('}')
  if (firstBrace > 0 || (lastBrace !== -1 && lastBrace < text.length - 1)) {
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      text = text.slice(firstBrace, lastBrace + 1)
    }
  }
  return text
}
