/**
 * Answer matching for identification items.
 *
 * The bar here is deliberately uneven: a typo or a bit of extra wording should
 * still count, but a different term must never be waved through. Marking a wrong
 * answer correct teaches the student the wrong thing, which is worse than making
 * them retype a word.
 */

export type MatchKind = 'exact' | 'accepted' | 'contains' | 'typo' | 'none'

export interface IdentificationResult {
  correct: boolean
  match: MatchKind
}

const ARTICLES = new Set(['a', 'an', 'the', 'ang', 'mga', 'sang', 'si'])

export function normaliseAnswer(text: string): string {
  const words = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)

  // Leading articles only - "the data" and "data" are the same answer, but a
  // word like "ang" in the middle of a Hiligaynon phrase is left alone.
  while (words.length > 1 && ARTICLES.has(words[0])) words.shift()

  return words.join(' ')
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length

  let previous = Array.from({ length: b.length + 1 }, (_, i) => i)

  for (let i = 1; i <= a.length; i++) {
    const current = [i]
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + cost)
    }
    previous = current
  }
  return previous[b.length]
}

/** How many edits to forgive. Short answers get no slack at all. */
function allowance(length: number): number {
  if (length <= 5) return 0
  if (length <= 12) return 1
  return 2
}

/**
 * Prefixes that flip a term's meaning. "dependent" and "independent" are two
 * edits apart, so distance alone would accept one for the other.
 */
function isNegationOf(a: string, b: string): boolean {
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a]
  return ['in', 'un', 'im', 'il', 'ir', 'non', 'dis', 'anti'].some(
    (prefix) => longer === prefix + shorter || longer === `${prefix} ${shorter}`
  )
}

/** True when `needle` appears in `haystack` as whole words. */
function containsPhrase(haystack: string, needle: string): boolean {
  if (!needle) return false
  const words = haystack.split(' ')
  const target = needle.split(' ')
  for (let i = 0; i + target.length <= words.length; i++) {
    if (target.every((word, offset) => words[i + offset] === word)) return true
  }
  return false
}

export function checkIdentification(
  typed: string,
  expected: string,
  accepted: string[] = []
): IdentificationResult {
  const given = normaliseAnswer(typed)
  if (!given) return { correct: false, match: 'none' }

  const candidates = [expected, ...accepted].map(normaliseAnswer).filter(Boolean)
  if (candidates.length === 0) return { correct: false, match: 'none' }

  if (given === candidates[0]) return { correct: true, match: 'exact' }
  if (candidates.slice(1).includes(given)) return { correct: true, match: 'accepted' }

  // The student wrote more than asked but included the right term.
  for (const candidate of candidates) {
    if (containsPhrase(given, candidate)) return { correct: true, match: 'contains' }
  }

  for (const candidate of candidates) {
    if (isNegationOf(given, candidate)) continue
    if (given[0] !== candidate[0]) continue
    if (levenshtein(given, candidate) <= allowance(candidate.length)) {
      return { correct: true, match: 'typo' }
    }
  }

  return { correct: false, match: 'none' }
}
