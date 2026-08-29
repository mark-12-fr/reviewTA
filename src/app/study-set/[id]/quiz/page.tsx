'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import IdentificationQuestion from '@/components/IdentificationQuestion'
import QuizQuestion from '@/components/QuizQuestion'
import StudySetHeader from '@/components/StudySetHeader'
import TutorChat from '@/components/TutorChat'
import type { Question, StudySetDetail } from '@/types'

interface Answer {
  questionId: string
  correct: boolean
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

const pad = (value: number) => String(value).padStart(2, '0')

function answerOf(question: Question): string {
  return question.kind === 'identification'
    ? (question.answer ?? '')
    : (question.options[question.correctAnswer] ?? '')
}

export default function QuizPage() {
  const params = useParams()
  const id = String(params.id)

  const [studySet, setStudySet] = useState<StudySetDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [queue, setQueue] = useState<Question[]>([])
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Answer[]>([])
  const [started, setStarted] = useState(false)
  const [tutorPrompt, setTutorPrompt] = useState('')
  const [tutorOpen, setTutorOpen] = useState(false)

  useEffect(() => {
    fetch(`/api/study-sets/${id}`)
      .then((response) => (response.ok ? response.json() : null))
      .then(setStudySet)
      .catch(() => setStudySet(null))
      .finally(() => setLoading(false))
  }, [id])

  const begin = useCallback((questions: Question[], randomise: boolean) => {
    setQueue(randomise ? shuffle(questions) : questions)
    setIndex(0)
    setAnswers([])
    setStarted(true)
  }, [])

  const recordAnswer = useCallback(
    async (question: Question, correct: boolean) => {
      setAnswers((current) => [...current, { questionId: question.id, correct }])
      try {
        await fetch('/api/progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ studySetId: id, questionId: question.id, correct }),
        })
      } catch {
        // Progress is a convenience - a failed save should not interrupt the quiz.
      }
    },
    [id]
  )

  const all = useMemo(() => studySet?.questions ?? [], [studySet])
  const multipleChoice = useMemo(() => all.filter((item) => item.kind === 'mcq'), [all])
  const identification = useMemo(() => all.filter((item) => item.kind === 'identification'), [all])
  const unmastered = useMemo(() => all.filter((item) => item.status !== 'mastered'), [all])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="eyebrow">Loading</p>
      </div>
    )
  }

  if (!studySet) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-5">
        <p className="text-[14px] text-ink-2">That study set no longer exists.</p>
        <Link href="/" className="text-[14px] text-accent underline-offset-2 hover:underline">
          Back to study sets
        </Link>
      </div>
    )
  }

  const finished = started && index >= queue.length
  const current = started && !finished ? queue[index] : null
  const correctCount = answers.filter((answer) => answer.correct).length
  const bothKinds = multipleChoice.length > 0 && identification.length > 0

  return (
    <div className="min-h-screen">
      <StudySetHeader
        id={id}
        title={studySet.title}
        active="quiz"
        actions={
          all.length > 0 ? (
            <button
              onClick={() => setTutorOpen((value) => !value)}
              className="h-8 cursor-pointer rounded-md border border-rule bg-surface px-3 text-[13px] text-ink-2 transition-colors hover:border-rule-strong hover:text-ink"
            >
              {tutorOpen ? 'Hide tutor' : 'Tutor'}
            </button>
          ) : undefined
        }
      />

      <div className="mx-auto max-w-2xl px-5 py-8 sm:px-8 sm:py-10">
        {all.length === 0 ? (
          <p className="py-20 text-center text-[14px] text-ink-2">This set has no quiz questions.</p>
        ) : !started ? (
          <div className="rounded-lg border border-rule bg-surface">
            <div className="border-b border-rule px-5 py-6 sm:px-6">
              <p className="eyebrow">Quiz</p>
              <h2 className="mt-2.5 font-serif text-[20px] leading-snug tracking-tight">
                {all.length} questions from your material
              </h2>
              <p className="mt-1.5 text-[14px] leading-relaxed text-ink-2">
                {bothKinds
                  ? `${multipleChoice.length} multiple choice and ${identification.length} identification. Each answer moves that item along your mastery ladder.`
                  : 'Each answer moves that item along your mastery ladder.'}
              </p>
            </div>
            <div className="divide-y divide-rule">
              <StartRow label="Start the full quiz" count={`${all.length} items`} primary onClick={() => begin(all, true)} />
              {bothKinds && (
                <>
                  <StartRow
                    label="Multiple choice only"
                    count={`${multipleChoice.length} items`}
                    onClick={() => begin(multipleChoice, true)}
                  />
                  <StartRow
                    label="Identification only"
                    count={`${identification.length} items`}
                    onClick={() => begin(identification, true)}
                  />
                </>
              )}
              {unmastered.length > 0 && unmastered.length < all.length && (
                <StartRow
                  label="Only what I have not mastered"
                  count={`${unmastered.length} items`}
                  onClick={() => begin(unmastered, true)}
                />
              )}
              <StartRow label="Keep the original order" count="unshuffled" muted onClick={() => begin(all, false)} />
            </div>
          </div>
        ) : finished ? (
          <Results
            total={queue.length}
            correct={correctCount}
            missed={queue.filter((_, position) => answers[position] && !answers[position].correct)}
            onRetryMissed={(missed) => begin(missed, true)}
            onRestart={() => begin(all, true)}
            setId={id}
          />
        ) : (
          current && (
            <>
              <div className="mb-8">
                <div className="mb-2 flex items-baseline justify-between font-mono text-[12px] tabular-nums text-ink-3">
                  <span>
                    Item {pad(index + 1)} <span className="text-rule-strong">/</span> {pad(queue.length)}
                  </span>
                  <span>{correctCount} correct</span>
                </div>
                <div className="h-px w-full bg-rule">
                  <div
                    className="h-px bg-accent transition-[width] duration-300"
                    style={{ width: `${(index / queue.length) * 100}%` }}
                  />
                </div>
              </div>

              {current.kind === 'identification' ? (
                <IdentificationQuestion
                  key={current.id}
                  question={current}
                  setId={id}
                  onAnswered={(correct) => recordAnswer(current, correct)}
                  onNext={() => setIndex((value) => value + 1)}
                  isLast={index === queue.length - 1}
                  onAskTutor={(prompt) => {
                    setTutorPrompt(prompt)
                    setTutorOpen(true)
                  }}
                />
              ) : (
                <QuizQuestion
                  key={current.id}
                  question={current}
                  setId={id}
                  onAnswered={(correct) => recordAnswer(current, correct)}
                  onNext={() => setIndex((value) => value + 1)}
                  isLast={index === queue.length - 1}
                  onAskTutor={(prompt) => {
                    setTutorPrompt(prompt)
                    setTutorOpen(true)
                  }}
                />
              )}
            </>
          )
        )}
      </div>

      {tutorOpen && (
        <div className="fixed inset-x-3 bottom-16 z-40 h-[60vh] sm:inset-x-auto sm:bottom-4 sm:right-4 sm:h-[32rem] sm:w-[380px]">
          <TutorChat kind="study-set" id={id} autoSend={tutorPrompt || undefined} />
        </div>
      )}
    </div>
  )
}

function StartRow({
  label,
  count,
  onClick,
  primary = false,
  muted = false,
}: {
  label: string
  count: string
  onClick: () => void
  primary?: boolean
  muted?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full cursor-pointer items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-sunken/50 sm:px-6"
    >
      <span className={`text-[14px] ${primary ? 'font-medium text-ink' : muted ? 'text-ink-2' : 'text-ink'}`}>
        {label}
      </span>
      <span className="flex-shrink-0 font-mono text-[12px] tabular-nums text-ink-3">{count}</span>
    </button>
  )
}

function Results({
  total,
  correct,
  missed,
  onRetryMissed,
  onRestart,
  setId,
}: {
  total: number
  correct: number
  missed: Question[]
  onRetryMissed: (questions: Question[]) => void
  onRestart: () => void
  setId: string
}) {
  const percentage = total === 0 ? 0 : Math.round((correct / total) * 100)

  return (
    <div className="animate-reveal">
      <div className="rounded-lg border border-rule bg-surface">
        <div className="flex items-end justify-between gap-6 border-b border-rule px-5 py-6 sm:px-6">
          <div>
            <p className="eyebrow">Score</p>
            <p className="mt-2 font-mono text-[36px] leading-none tabular-nums tracking-tight text-ink sm:text-[40px]">
              {percentage}
              <span className="text-[20px] text-ink-3">%</span>
            </p>
          </div>
          <p className="font-mono text-[13px] tabular-nums text-ink-2">
            {correct} of {total} correct
          </p>
        </div>

        <p className="border-b border-rule px-5 py-4 text-[14px] leading-relaxed text-ink-2 sm:px-6">
          {percentage === 100
            ? 'Every item right. Each one moved a rung up your mastery ladder.'
            : `${missed.length} ${missed.length === 1 ? 'item' : 'items'} slipped back a rung and will come round again.`}
        </p>

        <div className="divide-y divide-rule">
          {missed.length > 0 && (
            <StartRow label="Retry what I missed" count={`${missed.length} items`} primary onClick={() => onRetryMissed(missed)} />
          )}
          <StartRow label="Take the whole quiz again" count="" muted onClick={onRestart} />
          <Link
            href={`/study-set/${setId}`}
            className="block px-5 py-4 text-[14px] text-ink-2 transition-colors hover:bg-sunken/50 sm:px-6"
          >
            Back to the study set
          </Link>
        </div>
      </div>

      {missed.length > 0 && (
        <section className="mt-10">
          <h3 className="eyebrow mb-4">Answer key for what you missed</h3>
          <ol className="divide-y divide-rule border-t border-rule">
            {missed.map((question, position) => (
              <li key={question.id} className="flex gap-4 py-5">
                <span className="mt-0.5 font-mono text-[12px] tabular-nums text-ink-3">
                  {pad(position + 1)}
                </span>
                <div className="min-w-0">
                  <p className="font-serif text-[16px] leading-snug text-ink">{question.question}</p>
                  <p className="mt-2 text-[14px] text-correct">{answerOf(question)}</p>
                  {question.explanation && (
                    <p className="mt-1.5 text-[13px] leading-relaxed text-ink-2">{question.explanation}</p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  )
}
