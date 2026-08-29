'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import Markdown from '@/components/Markdown'
import StudySetHeader from '@/components/StudySetHeader'
import type { StudySetDetail } from '@/types'

export default function NotesPage() {
  const params = useParams()
  const id = String(params.id)

  const [studySet, setStudySet] = useState<StudySetDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetch(`/api/study-sets/${id}`)
      .then((response) => (response.ok ? response.json() : null))
      .then(setStudySet)
      .catch(() => setStudySet(null))
      .finally(() => setLoading(false))
  }, [id])

  const copy = async () => {
    if (!studySet?.notes) return
    try {
      await navigator.clipboard.writeText(studySet.notes)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard access can be blocked; nothing else to do.
    }
  }

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
      <StudySetHeader
        id={id}
        title={studySet.title}
        active="notes"
        actions={
          studySet.notes ? (
            <button
              onClick={copy}
              className="h-8 cursor-pointer rounded-md border border-rule bg-surface px-3 text-[13px] text-ink-2 transition-colors hover:border-rule-strong hover:text-ink"
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          ) : undefined
        }
      />

      <div className="mx-auto max-w-[68ch] px-5 py-10 sm:px-8">
        {studySet.notes ? (
          <>
            <Markdown>{studySet.notes}</Markdown>

            {studySet.keyTerms.length > 0 && (
              <section className="mt-12 border-t border-rule pt-8">
                <h2 className="eyebrow mb-5">Key terms</h2>
                <dl className="divide-y divide-rule border-t border-rule">
                  {studySet.keyTerms.map((entry) => (
                    <div key={entry.term} className="grid gap-1 py-4 sm:grid-cols-[180px_1fr] sm:gap-4">
                      <dt className="font-serif text-[16px] font-semibold text-ink">{entry.term}</dt>
                      <dd className="font-serif text-[15px] leading-relaxed text-ink-2">
                        {entry.definition}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}
          </>
        ) : (
          <div className="py-20 text-center">
            <p className="text-[14px] text-ink-2">This set has no notes.</p>
            <Link
              href={`/study-set/${id}/content`}
              className="mt-2 inline-block text-[14px] text-accent underline-offset-2 hover:underline"
            >
              Read the original material
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
