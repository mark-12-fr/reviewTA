'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import SetupNotice from '@/components/SetupNotice'
import StudySetCard from '@/components/StudySetCard'
import { fieldClass } from '@/components/ui/Input'
import type { Folder, StudySetSummary } from '@/types'

export default function HomePage() {
  const [studySets, setStudySets] = useState<StudySetSummary[]>([])
  const [folders, setFolders] = useState<Folder[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/study-sets').then((response) => (response.ok ? response.json() : [])),
      fetch('/api/folders').then((response) => (response.ok ? response.json() : [])),
    ])
      .then(([sets, folderList]) => {
        setStudySets(sets)
        setFolders(folderList)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return studySets
    return studySets.filter(
      (set) =>
        set.title.toLowerCase().includes(needle) ||
        (set.description ?? '').toLowerCase().includes(needle)
    )
  }, [query, studySets])

  const totals = useMemo(
    () =>
      studySets.reduce(
        (accumulator, set) => ({
          items: accumulator.items + set.progress.totalItems,
          mastered: accumulator.mastered + set.progress.mastered,
        }),
        { items: 0, mastered: 0 }
      ),
    [studySets]
  )

  return (
    <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-rule pb-6">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight">Study sets</h1>
          <p className="mt-1.5 font-mono text-[12px] tabular-nums text-ink-3">
            {loading
              ? 'Loading'
              : studySets.length === 0
                ? 'Nothing yet'
                : `${studySets.length} ${studySets.length === 1 ? 'set' : 'sets'} · ${totals.items} items · ${totals.mastered} mastered`}
          </p>
        </div>
        <Link
          href="/study-set/create"
          className="hidden h-9 items-center rounded-md bg-accent px-3.5 text-[14px] font-medium text-white transition-colors hover:bg-accent-hover sm:inline-flex"
        >
          New study set
        </Link>
      </header>

      <SetupNotice className="mb-8" />

      {studySets.length > 3 && (
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search study sets"
          aria-label="Search study sets"
          className={`${fieldClass} mb-6 max-w-sm`}
        />
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((index) => (
            <div key={index} className="h-40 animate-pulse rounded-lg border border-rule bg-sunken/60" />
          ))}
        </div>
      ) : filtered.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((studySet) => (
            <StudySetCard
              key={studySet.id}
              studySet={studySet}
              onDeleted={(id) => setStudySets((sets) => sets.filter((set) => set.id !== id))}
            />
          ))}
        </div>
      ) : studySets.length > 0 ? (
        <p className="py-16 text-center text-[14px] text-ink-2">
          Nothing matches <span className="font-medium text-ink">{query}</span>.
        </p>
      ) : (
        <EmptyState />
      )}

      <Link
        href="/study-set/create"
        aria-label="New study set"
        className="fixed bottom-20 right-5 z-40 flex h-13 w-13 items-center justify-center rounded-full bg-accent text-white shadow-[0_8px_24px_-8px_rgba(22,23,26,0.45)] transition-colors hover:bg-accent-hover lg:bottom-8 lg:right-8"
      >
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" d="M12 5v14M5 12h14" />
        </svg>
      </Link>

      {folders.length > 0 && (
        <section className="mt-12 border-t border-rule pt-6">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="eyebrow">Folders</h2>
            <Link href="/folders" className="text-[13px] text-ink-2 hover:text-accent">
              All folders
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {folders.slice(0, 4).map((folder) => (
              <Link
                key={folder.id}
                href={`/folders/${folder.id}`}
                className="rounded-lg border border-rule bg-surface p-3.5 transition-colors hover:border-rule-strong"
              >
                <span className={`mb-3 block h-1 w-6 rounded-full ${folder.color}`} />
                <p className="truncate text-[14px] font-medium">{folder.name}</p>
                <p className="mt-0.5 font-mono text-[12px] tabular-nums text-ink-3">
                  {folder.studySetCount} sets
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

const routes = [
  {
    href: '/study-set/create?mode=text',
    title: 'Paste a lesson',
    body: 'Your notes, a handout, a chapter you typed up.',
  },
  {
    href: '/study-set/create?mode=file',
    title: 'Upload a PDF or photo',
    body: 'Module PDFs, lecture slides, a picture of a page.',
  },
  {
    href: '/solve',
    title: 'Solve a problem',
    body: 'Photograph a question and work through the steps.',
  },
]

function EmptyState() {
  return (
    <div className="rounded-lg border border-rule bg-surface">
      <div className="border-b border-rule px-6 py-8 sm:px-8">
        <h2 className="max-w-xl font-serif text-[22px] leading-snug tracking-tight text-ink">
          Every question here has to quote your own material, or it does not ship.
        </h2>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-ink-2">
          Give ReviewTa a lesson and it writes the notes, flashcards, and quiz. Anything it cannot trace
          back to a line in your material is thrown out before you ever see it.
        </p>
      </div>
      <div className="grid divide-y divide-rule sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {routes.map((route) => (
          <Link
            key={route.href}
            href={route.href}
            className="group px-6 py-5 transition-colors hover:bg-sunken/50 sm:px-6"
          >
            <p className="text-[14px] font-medium text-ink group-hover:text-accent">{route.title}</p>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-2">{route.body}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
