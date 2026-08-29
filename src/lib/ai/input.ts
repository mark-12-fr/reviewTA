import type { Part } from './provider'

export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const
export const MAX_FILE_BYTES = 20 * 1024 * 1024

type ImageMediaType = (typeof IMAGE_TYPES)[number]

function isImageType(type: string): type is ImageMediaType {
  return (IMAGE_TYPES as readonly string[]).includes(type)
}

/** True for files we can read as UTF-8 rather than shipping to the model as bytes. */
function isTextLike(file: File): boolean {
  if (file.type.startsWith('text/')) return true
  if (['application/json', 'application/xml'].includes(file.type)) return true
  return /\.(txt|md|markdown|csv|json|rtf)$/i.test(file.name)
}

export class UnsupportedFileError extends Error {}

/**
 * Turns one uploaded file into model input.
 * Images and PDFs go to the model directly; text files are inlined.
 */
export async function fileToParts(file: File): Promise<Part[]> {
  if (file.size > MAX_FILE_BYTES) {
    throw new UnsupportedFileError(
      `"${file.name}" is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is 20 MB.`
    )
  }

  if (isImageType(file.type)) {
    const data = Buffer.from(await file.arrayBuffer()).toString('base64')
    return [{ kind: 'image', mediaType: file.type, data }]
  }

  if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
    const data = Buffer.from(await file.arrayBuffer()).toString('base64')
    return [{ kind: 'pdf', data, name: file.name }]
  }

  if (isTextLike(file)) {
    const text = await file.text()
    if (!text.trim()) throw new UnsupportedFileError(`"${file.name}" is empty.`)
    return [{ kind: 'text', text: `<file name="${file.name}">\n${text}\n</file>` }]
  }

  throw new UnsupportedFileError(
    `"${file.name}" is not supported. Use a photo (JPG, PNG, WebP), a PDF, or a text file. For Word or Slides, export to PDF first.`
  )
}

/** Blocks private and loopback hosts so a pasted link cannot probe the local network. */
function isPublicHttpUrl(raw: string): URL | null {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null

  const host = url.hostname.toLowerCase()
  if (host === 'localhost' || host.endsWith('.localhost') || host === '::1') return null
  if (/^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host)) return null
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return null
  if (/^169\.254\./.test(host) || /^0\./.test(host)) return null
  return url
}

const HTML_ENTITIES: Record<string, string> = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&rsquo;': '’',
  '&lsquo;': '‘',
  '&mdash;': '—',
  '&ndash;': '–',
}

/** Fetches a page and reduces it to readable text for grounding. */
export async function urlToText(raw: string): Promise<{ text: string; title: string }> {
  const url = isPublicHttpUrl(raw)
  if (!url) {
    throw new UnsupportedFileError('That is not a valid public web address.')
  }

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; ReviewTa/1.0; study material importer)',
      Accept: 'text/html,application/xhtml+xml,text/plain',
    },
    signal: AbortSignal.timeout(20000),
    redirect: 'follow',
  })

  if (!response.ok) {
    throw new UnsupportedFileError(`The page returned ${response.status}. Try pasting the text instead.`)
  }

  const contentType = response.headers.get('content-type') ?? ''
  const body = await response.text()

  if (contentType.includes('text/plain')) {
    return { text: body.trim(), title: url.hostname }
  }

  const titleMatch = body.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  const title = titleMatch ? titleMatch[1].trim() : url.hostname

  let text = body
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<(nav|header|footer|aside)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<\/(p|div|section|article|li|h[1-6]|tr|br)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<[^>]+>/g, ' ')

  for (const [entity, value] of Object.entries(HTML_ENTITIES)) {
    text = text.replaceAll(entity, value)
  }

  text = text
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .trim()

  if (text.length < 200) {
    throw new UnsupportedFileError(
      'That page had almost no readable text - it may need JavaScript to load. Copy the text and paste it instead.'
    )
  }

  return { text, title }
}
