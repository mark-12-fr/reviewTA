'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { checkIdentification, type MatchKind } from '@/lib/identification'
import type { Question } from '@/types'

interface IdentificationQuestionProps {
  question: Question
  setId: string
  onAnswered: (isCorrect: boolean) => void
  onNext: () => void
  isLast: boolean
  onAskTutor?: (prompt: string) => void
}

interface Result {
  correct: boolean
  match: MatchKind
  typed: string
}

export default function IdentificationQuestion({
  question,
  setId,
  onAnswered,
  onNext,
  isLast,
  onAskTutor,
}: IdentificationQuestionProps) {
  const [typed, setTyped] = useState('')
  const [result, setResult] = useState<Result | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const expected = question.answer ?? ''

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const submit = () => {
    if (result || !typed.trim()) return
    const outcome = checkIdentification(typed, expected, question.accepted)
    setResult({ ...outcome, typed: typed.trim() })
    onAnswered(outcome.correct)
  }

  const skip = () => {
    if (result) return
    setResult({ correct: false, match: 'none', typed: '' })
    onAnswered(false)
  }

  // Enter answers, then Enter moves on.
  useEffect(() => {
    if (!result) return
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Enter') {
        event.preventDefault()
        onNext()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [result, onNext])

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="eyebrow">Identification</span>
        {question.verified && (
          <span className="flex items-center gap-1.5 text-[12px] text-ink-3">
            <svg
              className="h-3 w-3 text-correct"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Checked against your source
          </span>
        )}
      </div>

      <h2 className="mb-7 font-serif text-[21px] leading-[1.45] tracking-tight text-ink">
        {question.question}
      </h2>

      <div className="flex flex-wrap items-end gap-3">
        <input
          ref={inputRef}
          value={result ? result.typed : typed}
          onChange={(event) => setTyped(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              submit()
            }
          }}
          disabled={Boolean(result)}
          placeholder="Type your answer"
          aria-label="Your answer"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          className={`min-w-0 flex-1 border-b-2 bg-transparent pb-2 font-serif text-[19px] text-ink placeholder:font-sans placeholder:text-[15px] placeholder:text-ink-3 focus:outline-none disabled:cursor-default ${
            result ? (result.correct ? 'border-correct' : 'border-wrong') : 'border-rule-strong focus:border-accent'
          }`}
        />
        {!result && (
          <div className="flex gap-2">
            <button
              onClick={skip}
              className="h-9 cursor-pointer rounded-md px-3 text-[13px] text-ink-3 transition-colors hover:bg-sunken hover:text-ink"
            >
              Skip
            </button>
            <button
              onClick={submit}
              disabled={!typed.trim()}
              className="h-9 cursor-pointer rounded-md bg-accent px-4 text-[14px] font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-sunken disabled:text-ink-3"
            >
              Check
            </button>
          </div>
        )}
      </div>

      {!result && <p className="eyebrow mt-4">Press enter to check</p>}

      {result && (
        <div className="animate-reveal mt-7 space-y-5">
          <div>
            <p className={`text-[14px] font-semibold ${result.correct ? 'text-correct' : 'text-wrong'}`}>
              {result.correct ? 'Correct' : result.typed ? 'Not quite' : 'Skipped'}
            </p>
            <p className="mt-1.5 text-[14px] leading-relaxed text-ink-2">
              The source calls it{' '}
              <span className="font-serif text-[15px] font-semibold text-ink">{expected}</span>
              {question.accepted.length > 0 && (
                <>
                  {' '}
                  <span className="text-ink-3">
                    (also accepted: {question.accepted.join(', ')})
                  </span>
                </>
              )}
              .
              {result.correct && result.match === 'typo' && ' Your spelling was close enough.'}
              {result.correct && result.match === 'contains' && ' You wrote more than needed, but the term was there.'}
            </p>
          </div>

          {question.evidence && (
            <figure className="border-l-2 border-accent/40 pl-4">
              <figcaption className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <span className="eyebrow">From your material</span>
                <Link
                  href={`/study-set/${setId}/content?q=${encodeURIComponent(question.evidence.slice(0, 180))}`}
                  className="text-[12px] text-ink-2 underline-offset-2 hover:text-accent hover:underline"
                >
                  Show in source
                </Link>
              </figcaption>
              <blockquote className="font-serif text-[15px] leading-relaxed text-ink-2">
                &ldquo;{question.evidence}&rdquo;
              </blockquote>
            </figure>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-rule pt-5">
            {onAskTutor ? (
              <button
                onClick={() =>
                  onAskTutor(`Explain this: "${question.question}" - why is the answer "${expected}"?`)
                }
                className="cursor-pointer text-[13px] text-ink-2 underline-offset-2 hover:text-accent hover:underline"
              >
                Ask the tutor about this
              </button>
            ) : (
              <span />
            )}
            <button
              onClick={onNext}
              className="inline-flex h-9 cursor-pointer items-center rounded-md bg-accent px-4 text-[14px] font-medium text-white transition-colors hover:bg-accent-hover"
            >
              {isLast ? 'See results' : 'Next question'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
