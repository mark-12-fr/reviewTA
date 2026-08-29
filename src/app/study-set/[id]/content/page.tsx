'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Markdown from '@/components/Markdown'
import StudySetHeader from '@/components/StudySetHeader'
import type { StudySetDetail } from '@/types'

const sourceLabel: Record<string, string> = {
  text: 'Pasted text',
  file: 'Uploaded file',
  image: 'Photo',
  link: 'Web page',
}

function normalise(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export default function ContentPage() {
  return (
    <Suspense fallback={null}>
      <SourcePage />
    </Suspense>
  )
}

function SourcePage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const id = String(params.id)
  const quote = searchParams.get('q') ?? ''

  const [studySet, setStudySet] = useState<StudySetDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const bodyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch(`/api/study-sets/${id}`)
      .then((response) => (response.ok ? response.json() : null))
      .then(setStudySet)
      .catch(() => setStudySet(null))
      .finally(() => setLoading(false))
  }, [id])

  // Find the passage a quiz citation points at and mark it in place.
  useEffect(() => {
    if (!quote || !studySet || !bodyRef.current) return

    const needle = normalise(quote)
    if (!needle) return
    const opening = needle.split(' ').slice(0, 8).join(' ')

    const nodes = Array.from(
      bodyRef.current.querySelectorAll<HTMLElement>('p, li, h1, h2, h3, h4, td, blockquote')
    )
    const hit =
      nodes.find((node) => normalise(node.textContent ?? '').includes(needle)) ??
      nodes.find((node) => opening && normalise(node.textContent ?? '').includes(opening))

    if (!hit) return
    hit.classList.add('source-hit')
    hit.scrollIntoView({ block: 'center', behavior: 'smooth' })

    return () => hit.classList.remove('source-hit')
  }, [quote, studySet])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="eyebrow">Loading</p>
      </div>
    )
  }

  if (!studySet) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3">
        <p className="text-[14px] text-ink-2">That study set no longer exists.</p>
        <Link href="/" className="text-[14px] text-accent underline-offset-2 hover:underline">
          Back to study sets
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <StudySetHeader id={id} title={studySet.title} active="content" />

      <div className="mx-auto max-w-[68ch] px-5 py-10 sm:px-8">
        {quote ? (
          <div className="mb-8 rounded-lg border border-rule bg-surface p-4">
            <div className="mb-1.5 flex items-baseline justify-between gap-3">
              <span className="eyebrow">Quoted in your quiz</span>
              <Link
                href={`/study-set/${id}/content`}
                className="text-[12px] text-ink-2 underline-offset-2 hover:text-accent hover:underline"
              >
                Clear
              </Link>
            </div>
            <p className="font-serif text-[15px] leading-relaxed text-ink-2">&ldquo;{quote}&rdquo;</p>
          </div>
        ) : (
          <div className="mb-8 border-b border-rule pb-6">
            <p className="eyebrow">
              {sourceLabel[studySet.sourceType] ?? studySet.sourceType}
              {studySet.sourceName ? ` · ${studySet.sourceName}` : ''}
            </p>
            <p className="mt-2.5 text-[14px] leading-relaxed text-ink-2">
              This is the material everything in the set was built from. Every question and card had to
              quote it to be kept.
            </p>
          </div>
        )}

        <div ref={bodyRef}>
          {studySet.sourceContent ? (
            <Markdown>{studySet.sourceContent}</Markdown>
          ) : (
            <p className="py-20 text-center text-[14px] text-ink-2">
              No source material was stored for this set.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
