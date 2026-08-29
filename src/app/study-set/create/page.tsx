'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import SetupNotice from '@/components/SetupNotice'
import { fieldClass } from '@/components/ui/Input'

type Mode = 'text' | 'file' | 'link'

const STAGES = [
  { id: 'reading', label: 'Reading your material' },
  { id: 'writing', label: 'Writing notes, flashcards, and quiz' },
  { id: 'grounding', label: 'Checking every item against your source' },
  { id: 'verifying', label: 'Double-checking the answers' },
  { id: 'saving', label: 'Saving your study set' },
]

const MODES: Array<{ id: Mode; label: string }> = [
  { id: 'text', label: 'Paste text' },
  { id: 'file', label: 'Upload' },
  { id: 'link', label: 'Link' },
]

const pad = (value: number) => String(value).padStart(2, '0')

export default function CreateStudySetPage() {
  return (
    <Suspense fallback={null}>
      <CreateForm />
    </Suspense>
  )
}

function CreateForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialMode = (searchParams.get('mode') as Mode) || 'text'

  const [mode, setMode] = useState<Mode>(MODES.some((m) => m.id === initialMode) ? initialMode : 'text')
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  const [url, setUrl] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [dragging, setDragging] = useState(false)

  const [busy, setBusy] = useState(false)
  const [stage, setStage] = useState('')
  const [detail, setDetail] = useState('')
  const [error, setError] = useState('')

  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  // The work is not resumable, so warn before the tab closes mid-run.
  useEffect(() => {
    if (!busy) return
    const handler = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [busy])

  const addFiles = (incoming: FileList | null) => {
    if (!incoming) return
    setFiles((current) => [...current, ...Array.from(incoming)].slice(0, 5))
    setError('')
  }

  const canSubmit =
    !busy &&
    ((mode === 'text' && text.trim().length > 0) ||
      (mode === 'file' && files.length > 0) ||
      (mode === 'link' && url.trim().length > 0))

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!canSubmit) return

    setBusy(true)
    setError('')
    setStage('reading')
    setDetail('')

    const form = new FormData()
    form.set('mode', mode)
    form.set('title', title.trim())
    if (mode === 'text') form.set('text', text.trim())
    if (mode === 'link') form.set('url', url.trim())
    if (mode === 'file') files.forEach((file) => form.append('files', file))

    try {
      const response = await fetch('/api/study-sets/generate', { method: 'POST', body: form })
      if (!response.ok || !response.body) {
        throw new Error('Could not start. Check that the dev server is still running.')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        const chunks = buffer.split('\n\n')
        buffer = chunks.pop() ?? ''

        for (const chunk of chunks) {
          const line = chunk.split('\n').find((entry) => entry.startsWith('data: '))
          if (!line) continue
          const event = JSON.parse(line.slice(6)) as {
            type: string
            stage?: string
            detail?: string
            studySetId?: string
            message?: string
          }

          if (event.type === 'progress') {
            setStage(event.stage ?? '')
            setDetail(event.detail ?? '')
          } else if (event.type === 'done' && event.studySetId) {
            router.push(`/study-set/${event.studySetId}`)
            return
          } else if (event.type === 'error') {
            setError(event.message ?? 'Something went wrong.')
            setBusy(false)
            return
          }
        }
      }

      setError('The connection closed before the study set was finished. Try again.')
      setBusy(false)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Something went wrong.')
      setBusy(false)
    }
  }

  const currentStageIndex = STAGES.findIndex((entry) => entry.id === stage)

  return (
    <div className="min-h-screen">
      <div className="border-b border-rule">
        <div className="mx-auto flex max-w-2xl items-center gap-2.5 px-5 py-5 sm:px-8">
          <Link
            href="/"
            aria-label="Back to study sets"
            className="-ml-1.5 rounded-md p-1.5 text-ink-3 transition-colors hover:bg-sunken hover:text-ink"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.5 5.5L8 12l6.5 6.5" />
            </svg>
          </Link>
          <h1 className="text-[17px] font-semibold tracking-tight">New study set</h1>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-5 py-8 sm:px-8">
        {busy ? (
          <div className="py-6">
            <p className="eyebrow">Creating</p>
            <h2 className="mt-2.5 font-serif text-[20px] tracking-tight">
              Building your study set
            </h2>
            <p className="mt-1.5 text-[14px] text-ink-2">
              This takes a minute or two. Keep this tab open.
            </p>

            <ol className="mt-8 divide-y divide-rule border-t border-rule">
              {STAGES.map((entry, index) => {
                const state =
                  currentStageIndex > index ? 'done' : currentStageIndex === index ? 'active' : 'todo'
                return (
                  <li key={entry.id} className="flex items-baseline gap-4 py-3.5">
                    <span
                      className={`font-mono text-[12px] tabular-nums ${
                        state === 'todo' ? 'text-rule-strong' : 'text-ink-3'
                      }`}
                    >
                      {pad(index + 1)}
                    </span>
                    <span className="flex-1">
                      <span
                        className={`block text-[14px] ${
                          state === 'todo' ? 'text-ink-3' : state === 'active' ? 'font-medium text-ink' : 'text-ink-2'
                        }`}
                      >
                        {entry.label}
                      </span>
                      {state === 'active' && detail && (
                        <span className="mt-0.5 block text-[13px] text-ink-3">{detail}</span>
                      )}
                    </span>
                    {state === 'done' && (
                      <svg
                        className="h-3.5 w-3.5 text-correct"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2.5}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    {state === 'active' && (
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
                    )}
                  </li>
                )
              })}
            </ol>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-7">
            <SetupNotice />

            <div className="no-scrollbar -mb-px flex gap-5 overflow-x-auto border-b border-rule">
              {MODES.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setMode(tab.id)}
                  className={`flex-shrink-0 cursor-pointer border-b-2 pb-2.5 text-[14px] transition-colors ${
                    mode === tab.id
                      ? 'border-accent font-medium text-ink'
                      : 'border-transparent text-ink-2 hover:border-rule-strong hover:text-ink'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {mode === 'text' && (
              <div className="space-y-1.5">
                <label htmlFor="material" className="eyebrow block">
                  Your material
                </label>
                <textarea
                  id="material"
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  rows={16}
                  placeholder="Paste your lesson, notes, or reviewer here"
                  className={`${fieldClass} resize-none font-serif leading-relaxed`}
                />
                <p className="font-mono text-[12px] tabular-nums text-ink-3">
                  {text.trim() ? `${text.trim().split(/\s+/).length} words` : 'A paragraph or more works best'}
                </p>
              </div>
            )}

            {mode === 'file' && (
              <div className="space-y-3">
                <div
                  onDragOver={(event) => {
                    event.preventDefault()
                    setDragging(true)
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(event) => {
                    event.preventDefault()
                    setDragging(false)
                    addFiles(event.dataTransfer.files)
                  }}
                  className={`rounded-lg border border-dashed p-10 text-center transition-colors ${
                    dragging ? 'border-accent bg-accent-tint' : 'border-rule-strong bg-surface'
                  }`}
                >
                  <p className="text-[14px] font-medium text-ink">Drop a PDF or photo here</p>
                  <p className="mt-1 font-mono text-[12px] text-ink-3">
                    PDF · JPG · PNG · WebP · TXT · up to 20 MB
                  </p>
                  <div className="mt-5 flex flex-wrap justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="h-9 cursor-pointer rounded-md bg-accent px-3.5 text-[14px] font-medium text-white transition-colors hover:bg-accent-hover"
                    >
                      Choose files
                    </button>
                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      className="h-9 cursor-pointer rounded-md border border-rule bg-surface px-3.5 text-[14px] transition-colors hover:border-rule-strong hover:bg-sunken"
                    >
                      Take a photo
                    </button>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".pdf,image/*,text/plain,.md,.csv"
                    onChange={(event) => addFiles(event.target.files)}
                    className="hidden"
                  />
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(event) => addFiles(event.target.files)}
                    className="hidden"
                  />
                </div>

                {files.length > 0 && (
                  <ul className="divide-y divide-rule border-t border-rule">
                    {files.map((file, index) => (
                      <li key={`${file.name}-${index}`} className="flex items-center gap-3 py-3">
                        <span className="min-w-0 flex-1 truncate text-[14px] text-ink">{file.name}</span>
                        <span className="font-mono text-[12px] tabular-nums text-ink-3">
                          {(file.size / 1024 / 1024).toFixed(1)} MB
                        </span>
                        <button
                          type="button"
                          onClick={() => setFiles((current) => current.filter((_, i) => i !== index))}
                          aria-label={`Remove ${file.name}`}
                          className="cursor-pointer rounded p-1 text-ink-3 transition-colors hover:bg-sunken hover:text-ink"
                        >
                          <svg
                            className="h-3.5 w-3.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={1.5}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {mode === 'link' && (
              <div className="space-y-1.5">
                <label htmlFor="url" className="eyebrow block">
                  Page address
                </label>
                <input
                  id="url"
                  type="url"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder="https://example.com/lesson"
                  className={fieldClass}
                />
                <p className="text-[13px] text-ink-3">
                  Ordinary article pages work. Pages that need a login do not.
                </p>
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="title" className="eyebrow block">
                Title (optional)
              </label>
              <input
                id="title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Left blank, a title is written for you"
                className={fieldClass}
              />
            </div>

            {error && (
              <p className="border-l-2 border-wrong pl-4 text-[14px] leading-relaxed text-wrong">{error}</p>
            )}

            <div className="flex items-center gap-2.5 border-t border-rule pt-6">
              <button
                type="submit"
                disabled={!canSubmit}
                className="h-9 cursor-pointer rounded-md bg-accent px-4 text-[14px] font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-sunken disabled:text-ink-3"
              >
                Create study set
              </button>
              <Link
                href="/"
                className="h-9 rounded-md px-3 text-[14px] leading-9 text-ink-2 transition-colors hover:bg-sunken hover:text-ink"
              >
                Cancel
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
