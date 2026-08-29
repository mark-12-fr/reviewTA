'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import FlashcardView from '@/components/Flashcard'
import StudySetHeader from '@/components/StudySetHeader'
import type { Flashcard, StudySetDetail } from '@/types'

function shuffle<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

const pad = (value: number) => String(value).padStart(2, '0')

export default function FlashcardsPage() {
  const params = useParams()
  const id = String(params.id)

  const [studySet, setStudySet] = useState<StudySetDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [deck, setDeck] = useState<Flashcard[]>([])
  const [index, setIndex] = useState(0)
  const [started, setStarted] = useState(false)
  const [stillLearning, setStillLearning] = useState<Flashcard[]>([])

  useEffect(() => {
    fetch(`/api/study-sets/${id}`)
      .then((response) => (response.ok ? response.json() : null))
      .then(setStudySet)
      .catch(() => setStudySet(null))
      .finally(() => setLoading(false))
  }, [id])

  const begin = useCallback((cards: Flashcard[]) => {
    setDeck(shuffle(cards))
    setIndex(0)
    setStillLearning([])
    setStarted(true)
  }, [])

  const rate = useCallback(
    async (card: Flashcard, knewIt: boolean) => {
      if (!knewIt) setStillLearning((current) => [...current, card])
      setIndex((value) => value + 1)
      try {
        await fetch('/api/progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ studySetId: id, flashcardId: card.id, correct: knewIt }),
        })
      } catch {
        // Ratings are best-effort; keep the session going either way.
      }
    },
    [id]
  )

  const unmastered = useMemo(
    () => (studySet?.flashcards ?? []).filter((card) => card.status !== 'mastered'),
    [studySet]
  )

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

  const finished = started && index >= deck.length
  const currentCard = started && !finished ? deck[index] : null

  return (
    <div className="min-h-screen">
      <StudySetHeader id={id} title={studySet.title} active="flashcards" />

      <div className="mx-auto max-w-2xl px-5 py-10 sm:px-8">
        {studySet.flashcards.length === 0 ? (
          <p className="py-20 text-center text-[14px] text-ink-2">This set has no flashcards.</p>
        ) : !started ? (
          <div className="rounded-lg border border-rule bg-surface">
            <div className="border-b border-rule px-6 py-6">
              <p className="eyebrow">Flashcards</p>
              <h2 className="mt-2.5 font-serif text-[20px] tracking-tight">
                {studySet.flashcards.length} cards in this deck
              </h2>
              <p className="mt-1.5 text-[14px] leading-relaxed text-ink-2">
                Flip each card, then say whether you knew it. Anything you miss comes round again.
              </p>
            </div>
            <div className="divide-y divide-rule">
              <button
                onClick={() => begin(studySet.flashcards)}
                className="flex w-full cursor-pointer items-center justify-between px-6 py-4 text-left transition-colors hover:bg-sunken/50"
              >
                <span className="text-[14px] font-medium">Run the whole deck</span>
                <span className="font-mono text-[12px] tabular-nums text-ink-3">
                  {studySet.flashcards.length} cards
                </span>
              </button>
              {unmastered.length > 0 && unmastered.length < studySet.flashcards.length && (
                <button
                  onClick={() => begin(unmastered)}
                  className="flex w-full cursor-pointer items-center justify-between px-6 py-4 text-left transition-colors hover:bg-sunken/50"
                >
                  <span className="text-[14px] font-medium">Only what I have not mastered</span>
                  <span className="font-mono text-[12px] tabular-nums text-ink-3">
                    {unmastered.length} cards
                  </span>
                </button>
              )}
            </div>
          </div>
        ) : finished ? (
          <div className="animate-reveal rounded-lg border border-rule bg-surface">
            <div className="border-b border-rule px-6 py-6">
              <p className="eyebrow">Deck finished</p>
              <p className="mt-2 font-mono text-[28px] leading-none tabular-nums tracking-tight">
                {deck.length - stillLearning.length}
                <span className="text-[16px] text-ink-3"> / {deck.length}</span>
              </p>
              <p className="mt-2 text-[14px] text-ink-2">known on sight</p>
            </div>
            <div className="divide-y divide-rule">
              {stillLearning.length > 0 && (
                <button
                  onClick={() => begin(stillLearning)}
                  className="flex w-full cursor-pointer items-center justify-between px-6 py-4 text-left transition-colors hover:bg-sunken/50"
                >
                  <span className="text-[14px] font-medium">Go again with what I missed</span>
                  <span className="font-mono text-[12px] tabular-nums text-ink-3">
                    {stillLearning.length} cards
                  </span>
                </button>
              )}
              <button
                onClick={() => begin(studySet.flashcards)}
                className="w-full cursor-pointer px-6 py-4 text-left text-[14px] text-ink-2 transition-colors hover:bg-sunken/50"
              >
                Shuffle and restart
              </button>
              <Link
                href={`/study-set/${id}/quiz`}
                className="block w-full px-6 py-4 text-left text-[14px] text-ink-2 transition-colors hover:bg-sunken/50"
              >
                Take the quiz instead
              </Link>
            </div>
          </div>
        ) : (
          currentCard && (
            <>
              <div className="mb-8">
                <div className="mb-2 flex items-baseline justify-between font-mono text-[12px] tabular-nums text-ink-3">
                  <span>
                    Card {pad(index + 1)} <span className="text-rule-strong">/</span> {pad(deck.length)}
                  </span>
                  <span>{stillLearning.length} to revisit</span>
                </div>
                <div className="h-px w-full bg-rule">
                  <div
                    className="h-px bg-accent transition-[width] duration-300"
                    style={{ width: `${(index / deck.length) * 100}%` }}
                  />
                </div>
              </div>

              <FlashcardView
                key={currentCard.id}
                card={currentCard}
                onRate={(knewIt) => rate(currentCard, knewIt)}
              />
            </>
          )
        )}
      </div>
    </div>
  )
}
