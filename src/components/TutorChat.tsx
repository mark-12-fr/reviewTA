'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Markdown from '@/components/Markdown'
import type { ChatTurn } from '@/types'

interface TutorChatProps {
  kind: 'study-set' | 'solution'
  id: string
  suggestions?: string[]
  placeholder?: string
  emptyTitle?: string
  emptyHint?: string
  /** Sent automatically the first time it appears - used by "ask about this question". */
  autoSend?: string
}

export default function TutorChat({
  kind,
  id,
  suggestions = [],
  placeholder = 'Ask about this material',
  emptyTitle = 'Ask your tutor',
  emptyHint = 'Answers come from your own material.',
  autoSend,
}: TutorChatProps) {
  const [turns, setTurns] = useState<ChatTurn[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [pending, setPending] = useState('')
  const [error, setError] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const autoSentRef = useRef<string | null>(null)

  useEffect(() => {
    fetch(`/api/tutor?kind=${kind}&id=${id}`)
      .then((response) => (response.ok ? response.json() : []))
      .then((data: ChatTurn[]) => setTurns(data))
      .catch(() => {})
  }, [kind, id])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [turns, pending])

  const send = useCallback(
    async (message: string) => {
      const text = message.trim()
      if (!text || streaming) return

      setError('')
      setInput('')
      setTurns((previous) => [...previous, { role: 'user', content: text }])
      setStreaming(true)
      setPending('')

      try {
        const response = await fetch('/api/tutor', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kind, id, message: text }),
        })

        if (!response.ok || !response.body) {
          const data = await response.json().catch(() => ({ error: 'The tutor is unavailable right now.' }))
          throw new Error(data.error ?? 'The tutor is unavailable right now.')
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let reply = ''

        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          reply += decoder.decode(value, { stream: true })
          setPending(reply)
        }

        setTurns((previous) => [...previous, { role: 'assistant', content: reply }])
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Something went wrong.')
      } finally {
        setPending('')
        setStreaming(false)
      }
    },
    [id, kind, streaming]
  )

  useEffect(() => {
    if (!autoSend || autoSentRef.current === autoSend) return
    autoSentRef.current = autoSend
    void send(autoSend)
  }, [autoSend, send])

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-rule bg-surface">
      <div className="flex items-baseline justify-between border-b border-rule px-4 py-3">
        <h3 className="text-[14px] font-semibold tracking-tight">Tutor</h3>
        <span className="eyebrow">From your material</span>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
        {turns.length === 0 && !pending && (
          <div className="py-4">
            <p className="text-[14px] font-medium text-ink">{emptyTitle}</p>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-2">{emptyHint}</p>
            {suggestions.length > 0 && (
              <div className="mt-4 flex flex-col items-start gap-1.5">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => send(suggestion)}
                    className="cursor-pointer text-left text-[13px] text-ink-2 underline-offset-2 hover:text-accent hover:underline"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {turns.map((turn, index) =>
          turn.role === 'user' ? (
            <div key={index} className="flex justify-end">
              <p className="max-w-[85%] whitespace-pre-wrap rounded-md bg-sunken px-3 py-2 text-[14px] leading-relaxed text-ink">
                {turn.content}
              </p>
            </div>
          ) : (
            <Markdown key={index} className="text-[14px] leading-relaxed [&_p:last-child]:mb-0">
              {turn.content}
            </Markdown>
          )
        )}

        {pending && (
          <Markdown className="text-[14px] leading-relaxed [&_p:last-child]:mb-0">{pending}</Markdown>
        )}

        {streaming && !pending && <p className="eyebrow animate-pulse">Thinking</p>}

        {error && <p className="border-l-2 border-wrong pl-3 text-[13px] text-wrong">{error}</p>}
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault()
          send(input)
        }}
        className="border-t border-rule p-3"
      >
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                send(input)
              }
            }}
            rows={1}
            placeholder={placeholder}
            aria-label={placeholder}
            className="max-h-32 flex-1 resize-none rounded-md border border-rule bg-surface px-3 py-2 text-[14px] text-ink placeholder:text-ink-3 transition-colors hover:border-rule-strong focus:border-accent focus:outline-none"
          />
          <button
            type="submit"
            disabled={streaming || !input.trim()}
            aria-label="Send"
            className="flex h-9 w-9 flex-shrink-0 cursor-pointer items-center justify-center rounded-md bg-accent text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-sunken disabled:text-ink-3"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5m0 0l-6 6m6-6l6 6" />
            </svg>
          </button>
        </div>
      </form>
    </div>
  )
}
