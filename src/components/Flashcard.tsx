'use client'

import { useEffect, useState } from 'react'
import type { Flashcard as FlashcardType, MasteryStatus } from '@/types'

interface FlashcardProps {
  card: FlashcardType
  onRate: (knewIt: boolean) => void
}

const statusLabel: Record<MasteryStatus, string> = {
  unfamiliar: 'Not started',
  learning: 'Learning',
  familiar: 'Familiar',
  mastered: 'Mastered',
}

const statusSwatch: Record<MasteryStatus, string> = {
  unfamiliar: 'bg-m0',
  learning: 'bg-m1',
  familiar: 'bg-m2',
  mastered: 'bg-m3',
}

export default function Flashcard({ card, onRate }: FlashcardProps) {
  const [flipped, setFlipped] = useState(false)

  // Space flips, left and right rate: the deck runs without the mouse.
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName)) return

      if (event.key === ' ') {
        event.preventDefault()
        setFlipped((value) => !value)
      }
      if (flipped && event.key === 'ArrowLeft') onRate(false)
      if (flipped && event.key === 'ArrowRight') onRate(true)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [flipped, onRate])

  return (
    <div>
      <button
        onClick={() => setFlipped((value) => !value)}
        aria-label={flipped ? 'Show the prompt' : 'Show the answer'}
        className="perspective-1000 relative block aspect-[8/5] w-full cursor-pointer"
      >
        <div
          className={`transform-style-3d absolute inset-0 h-full w-full transition-transform duration-500 ${
            flipped ? 'rotate-y-180' : ''
          }`}
        >
          <div className="backface-hidden absolute inset-0 flex h-full w-full flex-col rounded-lg border border-rule bg-surface p-8">
            <span className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${statusSwatch[card.status]}`} />
              <span className="eyebrow">{statusLabel[card.status]}</span>
            </span>
            <span className="flex flex-1 items-center justify-center">
              <span className="text-center font-serif text-[21px] leading-snug tracking-tight text-ink">
                {card.front}
              </span>
            </span>
          </div>

          <div className="backface-hidden rotate-y-180 absolute inset-0 flex h-full w-full flex-col overflow-y-auto rounded-lg border border-rule bg-surface p-8">
            <span className="eyebrow">Answer</span>
            <span className="flex flex-1 items-center justify-center">
              <span className="text-center font-serif text-[17px] leading-relaxed text-ink">
                {card.back}
              </span>
            </span>
            {card.evidence && (
              <span className="mt-4 block border-t border-rule pt-3 text-center font-serif text-[12px] leading-relaxed text-ink-3">
                &ldquo;{card.evidence}&rdquo;
              </span>
            )}
          </div>
        </div>
      </button>

      {!flipped ? (
        <p className="eyebrow mt-5 text-center">Click the card or press space</p>
      ) : (
        <div className="animate-reveal mt-5 flex justify-center gap-2.5">
          <button
            onClick={() => onRate(false)}
            className="h-9 cursor-pointer rounded-md border border-rule bg-surface px-4 text-[14px] text-ink-2 transition-colors hover:border-wrong/40 hover:bg-wrong-tint hover:text-wrong"
          >
            Still learning
          </button>
          <button
            onClick={() => onRate(true)}
            className="h-9 cursor-pointer rounded-md border border-rule bg-surface px-4 text-[14px] text-ink-2 transition-colors hover:border-correct/40 hover:bg-correct-tint hover:text-correct"
          >
            Got it
          </button>
        </div>
      )}
    </div>
  )
}
