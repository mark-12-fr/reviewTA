'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import MasteryMeter from '@/components/MasteryMeter'
import StudySetHeader from '@/components/StudySetHeader'
import TutorChat from '@/components/TutorChat'
import type { Folder, StudySetDetail } from '@/types'

export default function StudySetPage() {
  const params = useParams()
  const id = String(params.id)

  const [studySet, setStudySet] = useState<StudySetDetail | null>(null)
  const [folders, setFolders] = useState<Folder[]>([])
  const [loading, setLoading] = useState(true)
  const [resetting, setResetting] = useState(false)

  useEffect(() => {
    fetch(`/api/study-sets/${id}`)
      .then((response) => (response.ok ? response.json() : null))
      .then(setStudySet)
      .catch(() => setStudySet(null))
      .finally(() => setLoading(false))

    fetch('/api/folders')
      .then((response) => (response.ok ? response.json() : []))
      .then(setFolders)
      .catch(() => {})
  }, [id])

  const moveToFolder = async (folderId: string) => {
    setStudySet((current) => (current ? { ...current, folderId: folderId || null } : current))
    await fetch(`/api/study-sets/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folderId: folderId || null }),
    })
  }

  const resetProgress = async () => {
    setResetting(true)
    try {
      const response = await fetch(`/api/progress?studySetId=${id}`, { method: 'DELETE' })
      if (response.ok) {
        const data = await response.json()
        setStudySet((current) => (current ? { ...current, progress: data.progress } : current))
      }
    } finally {
      setResetting(false)
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

  const { progress } = studySet
  const studied = progress.learning + progress.familiar + progress.mastered
  const verifiedCount = studySet.questions.filter((question) => question.verified).length
  const identificationCount = studySet.questions.filter((q) => q.kind === 'identification').length
  const multipleChoiceCount = studySet.questions.length - identificationCount

  return (
    <div className="min-h-screen">
      <StudySetHeader
        id={id}
        title={studySet.title}
        active=""
        subtitle={studySet.description ?? undefined}
      />

      <div className="mx-auto grid max-w-5xl gap-8 px-5 py-8 sm:px-8 lg:grid-cols-[1fr_340px]">
        <div className="space-y-8">
          <section>
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="eyebrow">Mastery</h2>
              {studied > 0 && (
                <button
                  onClick={resetProgress}
                  disabled={resetting}
                  className="cursor-pointer text-[12px] text-ink-3 underline-offset-2 hover:text-ink hover:underline disabled:opacity-50"
                >
                  {resetting ? 'Resetting' : 'Reset progress'}
                </button>
              )}
            </div>
            <MasteryMeter progress={progress} legend />
          </section>

          <section className="grid gap-3 sm:grid-cols-2">
            <Link
              href={`/study-set/${id}/quiz`}
              className="group rounded-lg border border-rule bg-surface p-5 transition-colors hover:border-rule-strong"
            >
              <p className="eyebrow">Quiz</p>
              <p className="mt-2.5 text-[15px] font-medium group-hover:text-accent">Test yourself</p>
              <p className="mt-1 font-mono text-[12px] tabular-nums text-ink-3">
                {identificationCount > 0
                  ? `${multipleChoiceCount} choice · ${identificationCount} identification`
                  : `${studySet.questions.length} questions`}
              </p>
            </Link>

            <Link
              href={`/study-set/${id}/flashcards`}
              className="group rounded-lg border border-rule bg-surface p-5 transition-colors hover:border-rule-strong"
            >
              <p className="eyebrow">Flashcards</p>
              <p className="mt-2.5 text-[15px] font-medium group-hover:text-accent">Run the deck</p>
              <p className="mt-1 font-mono text-[12px] tabular-nums text-ink-3">
                {studySet.flashcards.length} cards
              </p>
            </Link>
          </section>

          {verifiedCount > 0 && (
            <p className="flex gap-2.5 border-l-2 border-correct/40 pl-4 text-[13px] leading-relaxed text-ink-2">
              <span>
                <span className="font-mono tabular-nums text-ink">
                  {verifiedCount} of {studySet.questions.length}
                </span>{' '}
                questions were quoted back to your source and cleared by a second review pass. Open any
                answer to read the quote.
              </span>
            </p>
          )}

          {folders.length > 0 && (
            <section className="flex items-center gap-3 border-t border-rule pt-6">
              <label htmlFor="folder" className="eyebrow">
                Folder
              </label>
              <select
                id="folder"
                value={studySet.folderId ?? ''}
                onChange={(event) => moveToFolder(event.target.value)}
                className="h-8 cursor-pointer rounded-md border border-rule bg-surface px-2.5 text-[13px] text-ink transition-colors hover:border-rule-strong focus:border-accent focus:outline-none"
              >
                <option value="">None</option>
                {folders.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {folder.name}
                  </option>
                ))}
              </select>
            </section>
          )}

          {studySet.keyTerms.length > 0 && (
            <section className="border-t border-rule pt-6">
              <h2 className="eyebrow mb-4">Key terms</h2>
              <dl className="divide-y divide-rule border-t border-rule">
                {studySet.keyTerms.map((entry) => (
                  <div key={entry.term} className="grid gap-1 py-3.5 sm:grid-cols-[160px_1fr] sm:gap-4">
                    <dt className="font-serif text-[15px] font-semibold text-ink">{entry.term}</dt>
                    <dd className="text-[14px] leading-relaxed text-ink-2">{entry.definition}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
        </div>

        <div className="lg:sticky lg:top-32 lg:h-[min(34rem,calc(100vh-11rem))]">
          <TutorChat
            kind="study-set"
            id={id}
            suggestions={['Explain this simply', 'What should I focus on?', 'Quiz me on the hard parts']}
            emptyTitle="Ask about this material"
            emptyHint="Answers come from your own source, and the tutor says so when something is not in it."
          />
        </div>
      </div>
    </div>
  )
}
