'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'

const tabs = [
  { id: '', label: 'Overview' },
  { id: 'notes', label: 'Notes' },
  { id: 'quiz', label: 'Quiz' },
  { id: 'flashcards', label: 'Flashcards' },
  { id: 'content', label: 'Source' },
] as const

interface StudySetHeaderProps {
  id: string
  title: string
  active: (typeof tabs)[number]['id']
  subtitle?: string
  actions?: React.ReactNode
}

export default function StudySetHeader({ id, title, active, subtitle, actions }: StudySetHeaderProps) {
  const router = useRouter()

  return (
    <div className="sticky top-0 z-20 border-b border-rule bg-paper/90 backdrop-blur">
      <div className="mx-auto max-w-5xl px-5 sm:px-8">
        <div className="flex items-center justify-between gap-3 pt-5">
          <div className="flex min-w-0 items-center gap-2.5">
            <button
              onClick={() => router.push('/')}
              aria-label="Back to study sets"
              className="-ml-1.5 cursor-pointer rounded-md p-1.5 text-ink-3 transition-colors hover:bg-sunken hover:text-ink"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.5 5.5L8 12l6.5 6.5" />
              </svg>
            </button>
            <div className="min-w-0">
              <h1 className="truncate text-[17px] font-semibold tracking-tight">{title}</h1>
              {subtitle && <p className="truncate text-[13px] text-ink-3">{subtitle}</p>}
            </div>
          </div>
          {actions && <div className="flex flex-shrink-0 items-center gap-1.5">{actions}</div>}
        </div>

        <nav className="no-scrollbar -mb-px mt-4 flex gap-5 overflow-x-auto">
          {tabs.map((tab) => {
            const isActive = tab.id === active
            return (
              <Link
                key={tab.id || 'overview'}
                href={`/study-set/${id}${tab.id ? `/${tab.id}` : ''}`}
                aria-current={isActive ? 'page' : undefined}
                className={`flex-shrink-0 border-b-2 pb-2.5 text-[14px] transition-colors ${
                  isActive
                    ? 'border-accent font-medium text-ink'
                    : 'border-transparent text-ink-2 hover:border-rule-strong hover:text-ink'
                }`}
              >
                {tab.label}
              </Link>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
