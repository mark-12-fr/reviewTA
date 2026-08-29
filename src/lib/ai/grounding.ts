/**
 * Grounding check.
 *
 * Every generated item has to carry a verbatim quote from the source material.
 * Before anything is saved we confirm that the quote really is in the source -
 * a model that invents a fact usually has to invent the quote too, so this
 * catches ungrounded items without a second API call.
 */

function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^a-z0-9'"\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Returns 0-1 for how much of `quote` actually appears in `source`.
 * An exact match scores 1; otherwise it is the fraction of the quote's
 * three-word windows found in the source, which tolerates small
 * transcription differences without accepting a fabricated quote.
 */
export function evidenceScore(source: string, quote: string): number {
  const haystack = normalise(source)
  const needle = normalise(quote)

  if (!needle || !haystack) return 0
  if (haystack.includes(needle)) return 1

  const words = needle.split(' ')
  if (words.length < 3) return haystack.includes(needle) ? 1 : 0

  let hits = 0
  let total = 0
  for (let i = 0; i + 2 < words.length; i++) {
    total++
    if (haystack.includes(words.slice(i, i + 3).join(' '))) hits++
  }
  return total === 0 ? 0 : hits / total
}

/** Below this the quote is treated as fabricated and the item is dropped. */
export const GROUNDING_DROP_BELOW = 0.5
/** At or above this the item counts as solidly grounded. */
export const GROUNDING_TRUSTED = 0.8

export type GroundingVerdict = 'grounded' | 'weak' | 'ungrounded'

export function classifyGrounding(score: number): GroundingVerdict {
  if (score >= GROUNDING_TRUSTED) return 'grounded'
  if (score >= GROUNDING_DROP_BELOW) return 'weak'
  return 'ungrounded'
}

/** Rough word count, used to size how many items a source can support. */
export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
