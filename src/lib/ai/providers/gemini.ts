import { z } from 'zod'
import { extractJson, type Part, type Provider, type StructuredRequest, type Turn } from '../provider'

/**
 * Google's Gemini REST API. This is the no-cost path: the free tier needs a
 * Google account and an API key, but no billing details.
 *
 * Structured output here is `responseMimeType: application/json` plus the JSON
 * Schema spelled out in the prompt, then validated with the same Zod schema the
 * Claude path uses - so an off-shape response is caught rather than stored.
 */
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash'
/** Overridable so the pipeline can be exercised against a local stub. */
const BASE = process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/models'

function apiKey(): string {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || ''
}

interface GeminiPart {
  text?: string
  thought?: boolean
  inlineData?: { mimeType: string; data: string }
}

function toParts(parts: Part[]): GeminiPart[] {
  return parts.map((part) => {
    if (part.kind === 'text') return { text: part.text }
    if (part.kind === 'image') return { inlineData: { mimeType: part.mediaType, data: part.data } }
    return { inlineData: { mimeType: 'application/pdf', data: part.data } }
  })
}

function readText(candidateParts: GeminiPart[] | undefined): string {
  if (!candidateParts) return ''
  return candidateParts
    .filter((part) => !part.thought && typeof part.text === 'string')
    .map((part) => part.text as string)
    .join('')
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: GeminiPart[] }
    finishReason?: string
  }>
  promptFeedback?: { blockReason?: string }
  error?: { message?: string; status?: string; code?: number }
}

async function call(body: unknown): Promise<GeminiResponse> {
  const response = await fetch(`${BASE}/${MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey() },
    body: JSON.stringify(body),
  })

  const data = (await response.json().catch(() => ({}))) as GeminiResponse

  if (!response.ok) {
    throw new Error(geminiErrorMessage(response.status, data.error?.message))
  }
  return data
}

function geminiErrorMessage(status: number, message?: string): string {
  if (status === 400 && message && /API key not valid/i.test(message)) {
    return 'The Gemini API key was rejected. Check GEMINI_API_KEY in .env.'
  }
  if (status === 403) {
    return 'Gemini refused this key. Make sure the key is from aistudio.google.com and the Generative Language API is enabled.'
  }
  if (status === 404) {
    return `Gemini has no model called "${MODEL}". Set GEMINI_MODEL in .env to a model your key can use, for example gemini-2.5-flash.`
  }
  if (status === 429) {
    return 'The Gemini free tier is rate limited right now. Wait a minute and try again.'
  }
  if (status >= 500) {
    return 'Gemini had a server error. Try again in a moment.'
  }
  return message ? `Gemini error ${status}: ${message}` : `Gemini error ${status}.`
}

function checkFinish(data: GeminiResponse, label: string): string {
  const candidate = data.candidates?.[0]
  const blocked = data.promptFeedback?.blockReason
  if (blocked) {
    throw new Error(`Gemini blocked this ${label} (${blocked}). Try different material.`)
  }
  if (candidate?.finishReason === 'MAX_TOKENS') {
    throw new Error(`The ${label} was too long to finish in one response. Try shorter material.`)
  }
  if (candidate?.finishReason && !['STOP', 'MAX_TOKENS'].includes(candidate.finishReason)) {
    throw new Error(`Gemini stopped early on this ${label} (${candidate.finishReason}).`)
  }
  const text = readText(candidate?.content?.parts)
  if (!text.trim()) {
    throw new Error(`Gemini returned nothing for this ${label}. Please try again.`)
  }
  return text
}

export const geminiProvider: Provider = {
  id: 'gemini',
  label: 'Gemini',
  model: MODEL,
  free: true,

  async structured<T>(request: StructuredRequest<T>): Promise<T> {
    const jsonSchema = z.toJSONSchema(request.schema as z.ZodType, { io: 'output' })
    const system = `${request.system}

Reply with a single JSON object and nothing else - no markdown fence, no commentary. It must match this JSON Schema exactly, including every required field:

${JSON.stringify(jsonSchema)}`

    const contents = [{ role: 'user', parts: toParts(request.parts) }]
    const generationConfig = {
      responseMimeType: 'application/json',
      temperature: 0,
      maxOutputTokens: request.maxTokens ?? 32000,
    }

    const first = checkFinish(
      await call({ systemInstruction: { parts: [{ text: system }] }, contents, generationConfig }),
      request.label
    )

    const parsed = tryParse(request.schema, first)
    if (parsed.ok) return parsed.value

    // One repair attempt: show it what it produced and what was wrong with it.
    const repaired = checkFinish(
      await call({
        systemInstruction: { parts: [{ text: system }] },
        contents: [
          ...contents,
          { role: 'model', parts: [{ text: first.slice(0, 20000) }] },
          {
            role: 'user',
            parts: [
              {
                text: `That response did not match the schema:\n${parsed.error}\n\nReturn the corrected JSON object only.`,
              },
            ],
          },
        ],
        generationConfig,
      }),
      request.label
    )

    const second = tryParse(request.schema, repaired)
    if (second.ok) return second.value

    throw new Error(
      `Gemini did not return usable ${request.label} data (${second.error}). Please try again.`
    )
  },

  async *streamText(request: { system: string; turns: Turn[]; maxTokens?: number }) {
    const response = await fetch(`${BASE}/${MODEL}:streamGenerateContent?alt=sse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey() },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: request.system }] },
        contents: request.turns.map((turn) => ({
          role: turn.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: turn.content }],
        })),
        generationConfig: { maxOutputTokens: request.maxTokens ?? 8000 },
      }),
    })

    if (!response.ok || !response.body) {
      const data = (await response.json().catch(() => ({}))) as GeminiResponse
      throw new Error(geminiErrorMessage(response.status, data.error?.message))
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      const chunks = buffer.split('\n\n')
      buffer = chunks.pop() ?? ''

      for (const chunk of chunks) {
        const line = chunk.split('\n').find((entry) => entry.startsWith('data: '))
        if (!line) continue
        try {
          const data = JSON.parse(line.slice(6)) as GeminiResponse
          const text = readText(data.candidates?.[0]?.content?.parts)
          if (text) yield text
        } catch {
          // A partial frame - the next read completes it.
        }
      }
    }
  },
}

function tryParse<T>(
  schema: z.ZodType<T>,
  raw: string
): { ok: true; value: T } | { ok: false; error: string } {
  let candidate: unknown
  try {
    candidate = JSON.parse(extractJson(raw))
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'invalid JSON' }
  }

  const result = schema.safeParse(candidate)
  if (result.success) return { ok: true, value: result.data }

  const issues = result.error.issues
    .slice(0, 6)
    .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('; ')
  return { ok: false, error: issues }
}
