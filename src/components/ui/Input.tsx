'use client'

import { InputHTMLAttributes, forwardRef } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  hint?: string
  error?: string
}

/** Shared field styling, so inputs and textareas across the app match. */
export const fieldClass =
  'w-full rounded-md border border-rule bg-surface px-3 py-2 text-[15px] text-ink placeholder:text-ink-3 transition-colors hover:border-rule-strong focus:border-accent focus:outline-none focus-visible:outline-none'

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', label, hint, error, id, ...props }, ref) => (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={id} className="eyebrow block">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={id}
        aria-invalid={error ? true : undefined}
        className={`${fieldClass} ${error ? 'border-wrong' : ''} ${className}`}
        {...props}
      />
      {error ? (
        <p className="text-[13px] text-wrong">{error}</p>
      ) : hint ? (
        <p className="text-[13px] text-ink-3">{hint}</p>
      ) : null}
    </div>
  )
)

Input.displayName = 'Input'

export default Input
