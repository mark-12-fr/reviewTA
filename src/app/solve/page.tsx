'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Markdown from '@/components/Markdown'
import SetupNotice from '@/components/SetupNotice'
import TutorChat from '@/components/TutorChat'
import { fieldClass } from '@/components/ui/Input'
import type { Solution } from '@/types'

const subjects = [
  { id: 'general', label: 'Any subject' },
  { id: 'math', label: 'Math' },
  { id: 'science', label: 'Science' },
  { id: 'language', label: 'Language' },
  { id: 'history', label: 'History' },
  { id: 'computing', label: 'Computing' },
]

const confidenceNote: Record<Solution['confidence'], string> = {
  high: 'read clearly, and the check holds',
  medium: 'worth verifying against your own working',
  low: 'something was unclear - read the warnings',
}

const confidenceColour: Record<Solution['confidence'], string> = {
  high: 'text-correct',
  medium: 'text-accent',
  low: 'text-wrong',
}

interface RecentSolve {
  id: string
  subject: string
  problem_text: string
  final_answer: string | null
  confidence: string
  created_at: string
}

const pad = (value: number) => String(value).padStart(2, '0')

export default function SolvePage() {
  const [subject, setSubject] = useState('general')
  const [image, setImage] = useState<File | null>(null)
  const [text, setText] = useState('')
  const [solving, setSolving] = useState(false)
  const [solution, setSolution] = useState<Solution | null>(null)
  const [error, setError] = useState('')
  const [recent, setRecent] = useState<RecentSolve[]>([])

  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/solve')
      .then((response) => (response.ok ? response.json() : []))
      .then(setRecent)
      .catch(() => {})
  }, [solution])

  const preview = useMemo(() => (image ? URL.createObjectURL(image) : null), [image])

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview)
    },
    [preview]
  )

  const solve = async () => {
    if (!image && !text.trim()) return
    setSolving(true)
    setError('')
    setSolution(null)

    const form = new FormData()
    form.set('subject', subject)
    if (image) form.set('image', image)
    if (text.trim()) form.set('text', text.trim())

    try {
      const response = await fetch('/api/solve', { method: 'POST', body: form })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'Could not solve that.')
      setSolution(data as Solution)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Something went wrong.')
    } finally {
      setSolving(false)
    }
  }

  const reset = () => {
    setSolution(null)
    setImage(null)
    setText('')
    setError('')
  }

  return (
    <div className="min-h-screen">
      <div className="border-b border-rule">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-5 sm:px-8">
          <div>
            <h1 className="text-[17px] font-semibold tracking-tight">Solve</h1>
            <p className="mt-0.5 text-[13px] text-ink-3">
              Photograph a problem and work through it step by step
            </p>
          </div>
          {solution && (
            <button
              onClick={reset}
              className="h-9 cursor-pointer rounded-md border border-rule bg-surface px-3.5 text-[14px] transition-colors hover:border-rule-strong hover:bg-sunken"
            >
              New problem
            </button>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-5 py-8 sm:px-8">
        {solution ? (
          <SolutionView solution={solution} />
        ) : (
          <div className="mx-auto max-w-xl space-y-6">
            <SetupNotice />

            <div className="overflow-hidden rounded-lg border border-rule bg-surface">
              {preview ? (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={preview}
                    alt="The problem you captured"
                    className="max-h-[45vh] w-full bg-sunken object-contain"
                  />
                  <button
                    onClick={() => setImage(null)}
                    className="absolute right-3 top-3 h-8 cursor-pointer rounded-md border border-rule bg-surface px-3 text-[13px] transition-colors hover:bg-sunken"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div className="px-6 py-10 text-center">
                  <p className="text-[14px] font-medium text-ink">Photograph the question</p>
                  <p className="mt-1 text-[13px] text-ink-3">Or type it out below</p>
                  <div className="mt-5 flex justify-center gap-2">
                    <button
                      onClick={() => cameraRef.current?.click()}
                      className="h-9 cursor-pointer rounded-md bg-accent px-3.5 text-[14px] font-medium text-white transition-colors hover:bg-accent-hover"
                    >
                      Take a photo
                    </button>
                    <button
                      onClick={() => galleryRef.current?.click()}
                      className="h-9 cursor-pointer rounded-md border border-rule bg-surface px-3.5 text-[14px] transition-colors hover:border-rule-strong hover:bg-sunken"
                    >
                      Choose image
                    </button>
                  </div>
                </div>
              )}
            </div>

            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(event) => setImage(event.target.files?.[0] ?? null)}
              className="hidden"
            />
            <input
              ref={galleryRef}
              type="file"
              accept="image/*"
              onChange={(event) => setImage(event.target.files?.[0] ?? null)}
              className="hidden"
            />

            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              rows={3}
              placeholder="Type the problem, or add context to the photo"
              aria-label="The problem"
              className={`${fieldClass} resize-none font-serif`}
            />

            <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
              {subjects.map((entry) => (
                <button
                  key={entry.id}
                  onClick={() => setSubject(entry.id)}
                  className={`h-8 flex-shrink-0 cursor-pointer rounded-md border px-3 text-[13px] transition-colors ${
                    subject === entry.id
                      ? 'border-ink bg-ink text-white'
                      : 'border-rule bg-surface text-ink-2 hover:border-rule-strong hover:text-ink'
                  }`}
                >
                  {entry.label}
                </button>
              ))}
            </div>

            {error && (
              <p className="border-l-2 border-wrong pl-4 text-[14px] leading-relaxed text-wrong">{error}</p>
            )}

            <div>
              <button
                onClick={solve}
                disabled={solving || (!image && !text.trim())}
                className="h-10 w-full cursor-pointer rounded-md bg-accent text-[15px] font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-sunken disabled:text-ink-3"
              >
                {solving ? 'Working through it' : 'Solve'}
              </button>
              {solving && (
                <p className="eyebrow mt-3 text-center">
                  Reading the problem, solving, then checking the answer
                </p>
              )}
            </div>

            {recent.length > 0 && !solving && (
              <section className="border-t border-rule pt-6">
                <h2 className="eyebrow mb-3">Recently solved</h2>
                <ul className="divide-y divide-rule border-t border-rule">
                  {recent.slice(0, 5).map((entry) => (
                    <li key={entry.id} className="py-3">
                      <p className="line-clamp-2 font-serif text-[14px] leading-relaxed text-ink-2">
                        {entry.problem_text}
                      </p>
                      {entry.final_answer && (
                        <p className="mt-1 font-mono text-[13px] text-ink">{entry.final_answer}</p>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function SolutionView({ solution }: { solution: Solution }) {
  return (
    <div className="animate-reveal grid gap-8 lg:grid-cols-[1fr_340px]">
      <div className="space-y-8">
        <section>
          <p className="eyebrow">The problem as it was read</p>
          <p className="mt-2 whitespace-pre-wrap font-serif text-[17px] leading-relaxed text-ink">
            {solution.problemText}
          </p>
          <p className="mt-2 text-[13px] text-ink-3">
            If that is not your problem, retake the photo. Everything below depends on it.
          </p>
        </section>

        {solution.warnings.length > 0 && (
          <section className="border-l-2 border-accent pl-4">
            <p className="eyebrow">Worth knowing</p>
            <ul className="mt-2 space-y-1 text-[14px] leading-relaxed text-ink-2">
              {solution.warnings.map((warning, index) => (
                <li key={index}>{warning}</li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <h2 className="eyebrow mb-4">Working</h2>
          <ol className="divide-y divide-rule border-t border-rule">
            {solution.steps.map((step, index) => (
              <li key={index} className="flex gap-4 py-5">
                <span className="mt-0.5 font-mono text-[12px] tabular-nums text-ink-3">
                  {pad(index + 1)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold text-ink">{step.title}</p>
                  <Markdown className="mt-1.5 text-[15px] [&_p:last-child]:mb-0">{step.detail}</Markdown>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="rounded-lg border border-rule bg-surface p-5">
          <p className="eyebrow">Answer</p>
          <p className="mt-2 font-serif text-[24px] leading-snug tracking-tight text-ink">
            {solution.finalAnswer}
          </p>
          <p className="mt-3 font-mono text-[12px] text-ink-3">
            <span className={confidenceColour[solution.confidence]}>{solution.confidence} confidence</span>
            {' · '}
            {confidenceNote[solution.confidence]}
          </p>
        </section>

        {solution.check && (
          <section className="border-l-2 border-correct/40 pl-4">
            <p className="eyebrow">How the answer was checked</p>
            <Markdown className="mt-2 text-[15px] text-ink-2 [&_p:last-child]:mb-0">
              {solution.check}
            </Markdown>
          </section>
        )}
      </div>

      <div className="lg:sticky lg:top-8 lg:h-[min(34rem,calc(100vh-7rem))]">
        <TutorChat
          kind="solution"
          id={solution.id}
          suggestions={['Why that step?', 'Show me a simpler way', 'Give me a similar problem']}
          emptyTitle="Still not clear?"
          emptyHint="Ask about any step and it will be explained again."
          placeholder="Ask about this problem"
        />
      </div>
    </div>
  )
}
