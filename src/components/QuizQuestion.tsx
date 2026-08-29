'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import type { Question } from '@/types'

interface QuizQuestionProps {
  question: Question
  setId: string
  onAnswered: (isCorrect: boolean) => void
  onNext: () => void
  isLast: boolean
  onAskTutor?: (prompt: string) => void
}

const LETTERS = ['A', 'B', 'C', 'D']

export default function QuizQuestion({
  question,
  setId,
  onAnswered,
  onNext,
  isLast,
  onAskTutor,
}: QuizQuestionProps) {
  const [selected, setSelected] = useState<number | null>(null)
  const answered = selected !== null
  const isCorrect = selected === question.correctAnswer

  const choose = useCallback(
    (index: number) => {
      if (selected !== null) return
      setSelected(index)
      onAnswered(index === question.correctAnswer)
    },
    [onAnswered, question.correctAnswer, selected]
  )

  // A-D or 1-4 answers, Enter moves on: the whole quiz works from the keyboard.
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName)) return

      if (!answered) {
        const key = event.key.toUpperCase()
        const index = LETTERS.includes(key) ? LETTERS.indexOf(key) : Number(event.key) - 1
        if (index >= 0 && index < question.options.length) choose(index)
      } else if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        onNext()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [answered, choose, onNext, question.options.length])

  const rowClass = (index: number) => {
    if (!answered) return 'border-rule hover:border-rule-strong hover:bg-sunken/50'
    if (index === question.correctAnswer) return 'border-rule bg-correct-tint'
    if (index === selected) return 'border-rule bg-wrong-tint'
    return 'border-rule opacity-70'
  }

  const markerClass = (index: number) => {
    if (!answered) return 'border-rule-strong text-ink-2'
    if (index === question.correctAnswer) return 'border-correct bg-correct text-white'
    if (index === selected) return 'border-wrong bg-wrong text-white'
    return 'border-rule text-ink-3'
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <span className="eyebrow">{question.difficulty}</span>
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

      <div className="space-y-2">
        {question.options.map((option, index) => (
          <button
            key={index}
            onClick={() => choose(index)}
            disabled={answered}
            className={`flex w-full items-start gap-3.5 rounded-md border px-4 py-3.5 text-left transition-colors ${rowClass(index)} ${answered ? 'cursor-default' : 'cursor-pointer'}`}
          >
            <span
              className={`mt-px flex h-6 w-6 flex-shrink-0 items-center justify-center rounded border font-mono text-[12px] font-medium transition-colors ${markerClass(index)}`}
            >
              {LETTERS[index]}
            </span>
            <span className="font-serif text-[16px] leading-relaxed text-ink">{option}</span>
          </button>
        ))}
      </div>

      {!answered && <p className="eyebrow mt-4">Press A-D to answer</p>}

      {answered && (
        <div className="animate-reveal mt-7 space-y-5">
          <div>
            <p className={`text-[14px] font-semibold ${isCorrect ? 'text-correct' : 'text-wrong'}`}>
              {isCorrect ? 'Correct' : `Incorrect - the answer is ${LETTERS[question.correctAnswer]}`}
            </p>
            {question.explanation && (
              <p className="mt-1.5 text-[14px] leading-relaxed text-ink-2">{question.explanation}</p>
            )}
          </div>

          {question.evidence && (
            <figure className="border-l-2 border-accent/40 pl-4">
              <figcaption className="mb-1.5 flex items-baseline justify-between gap-3">
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
                  onAskTutor(
                    `Explain this question: "${question.question}" - why is "${question.options[question.correctAnswer]}" the answer?`
                  )
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
