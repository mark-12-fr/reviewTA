import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import type { Part, Provider, StructuredRequest, Turn } from '../provider'

/** Overridable so a smaller, cheaper model can be used to stretch trial credit. */
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-5'

const globalForAnthropic = globalThis as unknown as { __anthropic?: Anthropic }

function client(): Anthropic {
  globalForAnthropic.__anthropic ??= new Anthropic({ maxRetries: 3 })
  return globalForAnthropic.__anthropic
}

function toBlocks(parts: Part[]): Anthropic.ContentBlockParam[] {
  return parts.map((part) => {
    if (part.kind === 'text') {
      return { type: 'text', text: part.text }
    }
    if (part.kind === 'image') {
      return {
        type: 'image',
        source: {
          type: 'base64',
          media_type: part.mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
          data: part.data,
        },
      }
    }
    return {
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: part.data },
      title: part.name ?? 'document.pdf',
    }
  })
}

export const anthropicProvider: Provider = {
  id: 'anthropic',
  label: 'Claude',
  model: MODEL,
  free: false,

  async structured<T>(request: StructuredRequest<T>): Promise<T> {
    const stream = client().messages.stream({
      model: MODEL,
      max_tokens: request.maxTokens ?? 32000,
      system: request.system,
      messages: [{ role: 'user', content: toBlocks(request.parts) }],
      output_config: {
        format: zodOutputFormat(request.schema),
        effort: request.effort === 'deep' ? 'xhigh' : 'high',
      },
    })

    const message = await stream.finalMessage()

    if (message.stop_reason === 'refusal') {
      throw new Error(`The model declined to process this ${request.label}.`)
    }
    if (message.stop_reason === 'max_tokens') {
      throw new Error(`The ${request.label} was too long to finish in one response. Try shorter material.`)
    }
    if (!message.parsed_output) {
      throw new Error(`The model did not return usable ${request.label} data. Please try again.`)
    }
    return message.parsed_output as T
  },

  async *streamText(request: { system: string; turns: Turn[]; maxTokens?: number }) {
    const stream = client().messages.stream({
      model: MODEL,
      max_tokens: request.maxTokens ?? 8000,
      system: [
        { type: 'text', text: request.system, cache_control: { type: 'ephemeral' } },
      ],
      messages: request.turns.map((turn) => ({ role: turn.role, content: turn.content })),
      output_config: { effort: 'medium' },
    })

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield event.delta.text
      }
    }
  },
}

/** Turns SDK errors into something worth showing a student. */
export function describeAnthropicError(error: unknown): string | null {
  if (error instanceof Anthropic.AuthenticationError) {
    return 'The Anthropic API key was rejected. Check ANTHROPIC_API_KEY in .env.'
  }
  if (error instanceof Anthropic.RateLimitError) {
    return 'Claude is rate limiting this key. Wait a few seconds and try again.'
  }
  if (error instanceof Anthropic.BadRequestError) {
    return `Claude rejected the request: ${error.message}`
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return 'Could not reach the Anthropic API. Check your internet connection.'
  }
  if (error instanceof Anthropic.APIError) {
    if (error.status === 400 && /credit balance/i.test(error.message)) {
      return 'This Anthropic key has no credit left. Add credit, or switch to the free Gemini option by putting GEMINI_API_KEY in .env.'
    }
    return `Claude API error ${error.status}: ${error.message}`
  }
  return null
}
