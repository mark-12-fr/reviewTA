'use client'

import { useState } from 'react'
import Link from 'next/link'
import MasteryMeter from '@/components/MasteryMeter'
import type { StudySetSummary } from '@/types'

interface StudySetCardProps {
  studySet: StudySetSummary
  onDeleted?: (id: string) => void
}

const sourceLabel: Record<string, string> = {
  text: 'Pasted text',
  file: 'File',
  image: 'Photo',
  link: 'Web page',
}

export default function StudySetCard({ studySet, onDeleted }: StudySetCardProps) {
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const { progress, counts } = studySet

  const remove = async () => {
    setDeleting(true)
    try {
      const response = await fetch(`/api/study-sets/${studySet.id}`, { method: 'DELETE' })
      if (response.ok) onDeleted?.(studySet.id)
    } finally {
      setDeleting(false)
      setConfirming(false)
    }
  }

  return (
    <div className="group relative rounded-lg border border-rule bg-surface transition-colors hover:border-rule-strong">
      <Link href={`/study-set/${studySet.id}`} className="block p-4">
        <p className="eyebrow pr-8">{sourceLabel[studySet.sourceType] ?? studySet.sourceType}</p>

        <h3 className="mt-2.5 truncate text-[15px] font-semibold tracking-tight text-ink">
          {studySet.title}
        </h3>
        <p className="mt-1 font-mono text-[12px] tabular-nums text-ink-3">
          {counts.questions + counts.identifications} questions · {counts.flashcards} cards
        </p>

        <div className="mt-5">
          <MasteryMeter progress={progress} size="sm" />
          <p className="mt-2 font-mono text-[12px] tabular-nums text-ink-2">
            {progress.totalItems === 0
              ? 'Empty set'
              : `${progress.mastered} of ${progress.totalItems} mastered`}
          </p>
        </div>
      </Link>

      <div className="absolute right-2.5 top-2.5">
        {confirming ? (
          <div className="flex items-center gap-1 rounded-md border border-rule bg-surface p-0.5">
            <button
              onClick={remove}
              disabled={deleting}
              className="cursor-pointer rounded px-2 py-1 text-[12px] font-medium text-wrong hover:bg-wrong-tint disabled:opacity-50"
            >
              {deleting ? 'Deleting' : 'Delete'}
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="cursor-pointer rounded px-2 py-1 text-[12px] text-ink-2 hover:bg-sunken"
            >
              Keep
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            aria-label={`Delete ${studySet.title}`}
            className="cursor-pointer rounded-md p-1.5 text-ink-3 opacity-0 transition-all hover:bg-sunken hover:text-ink focus-visible:opacity-100 group-hover:opacity-100"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4.5 6.5h15M9 6.5V5a1 1 0 011-1h4a1 1 0 011 1v1.5M6.5 6.5l.7 12a1 1 0 001 .9h7.6a1 1 0 001-.9l.7-12"
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}
