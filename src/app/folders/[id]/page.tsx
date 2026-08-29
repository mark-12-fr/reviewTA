'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import StudySetCard from '@/components/StudySetCard'
import type { StudySetSummary } from '@/types'

export default function FolderPage() {
  const params = useParams()
  const id = String(params.id)

  const [folder, setFolder] = useState<{ id: string; name: string; color: string } | null>(null)
  const [studySets, setStudySets] = useState<StudySetSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch(`/api/folders/${id}`).then((response) => (response.ok ? response.json() : null)),
      fetch(`/api/study-sets?folderId=${id}`).then((response) => (response.ok ? response.json() : [])),
    ])
      .then(([folderData, sets]) => {
        setFolder(folderData)
        setStudySets(sets)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="eyebrow">Loading</p>
      </div>
    )
  }

  if (!folder) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3">
        <p className="text-[14px] text-ink-2">That folder no longer exists.</p>
        <Link href="/folders" className="text-[14px] text-accent underline-offset-2 hover:underline">
          Back to folders
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8">
      <header className="mb-8 flex items-center gap-2.5 border-b border-rule pb-6">
        <Link
          href="/folders"
          aria-label="Back to folders"
          className="-ml-1.5 rounded-md p-1.5 text-ink-3 transition-colors hover:bg-sunken hover:text-ink"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.5 5.5L8 12l6.5 6.5" />
          </svg>
        </Link>
        <div>
          <div className="flex items-center gap-2.5">
            <span className={`h-1 w-6 rounded-full ${folder.color}`} />
            <h1 className="text-[22px] font-semibold tracking-tight">{folder.name}</h1>
          </div>
          <p className="mt-1 font-mono text-[12px] tabular-nums text-ink-3">
            {studySets.length} {studySets.length === 1 ? 'set' : 'sets'}
          </p>
        </div>
      </header>

      {studySets.length === 0 ? (
        <div className="rounded-lg border border-dashed border-rule-strong px-6 py-12 text-center">
          <p className="text-[14px] font-medium text-ink">Nothing filed here yet</p>
          <p className="mt-1 text-[13px] text-ink-2">
            Open a study set and pick this folder to move it here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {studySets.map((studySet) => (
            <StudySetCard
              key={studySet.id}
              studySet={studySet}
              onDeleted={(deletedId) => setStudySets((sets) => sets.filter((set) => set.id !== deletedId))}
            />
          ))}
        </div>
      )}
    </div>
  )
}
