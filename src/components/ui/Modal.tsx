'use client'

import { useEffect, useRef, HTMLAttributes } from 'react'

interface ModalProps extends HTMLAttributes<HTMLDivElement> {
  isOpen: boolean
  onClose: () => void
  title?: string
}

export default function Modal({ isOpen, onClose, title, children, className = '' }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/20 p-4 backdrop-blur-[2px]"
      onClick={(event) => {
        if (event.target === overlayRef.current) onClose()
      }}
    >
      <div
        className={`animate-reveal max-h-[90vh] w-full max-w-md overflow-auto rounded-lg border border-rule bg-surface shadow-[0_16px_48px_-24px_rgba(22,23,26,0.35)] ${className}`}
      >
        {title && (
          <div className="flex items-center justify-between border-b border-rule px-5 py-3.5">
            <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
            <button
              onClick={onClose}
              aria-label="Close"
              className="-mr-1 cursor-pointer rounded-md p-1.5 text-ink-3 transition-colors hover:bg-sunken hover:text-ink"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}
