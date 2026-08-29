'use client'

import { useEffect, useState } from 'react'

interface Status {
  configured: boolean
  provider: string | null
  label: string | null
  model: string | null
  free: boolean
}

let cached: Status | null = null

/** States plainly what is switched off and exactly how to switch it on. */
export default function SetupNotice({ className = '' }: { className?: string }) {
  const [status, setStatus] = useState<Status | null>(cached)

  useEffect(() => {
    if (cached !== null) return
    fetch('/api/ai/status')
      .then((response) => response.json())
      .then((data: Status) => {
        cached = data
        setStatus(data)
      })
      .catch(() => setStatus({ configured: true, provider: null, label: null, model: null, free: false }))
  }, [])

  if (!status || status.configured) return null

  return (
    <div className={`rounded-lg border border-rule bg-surface ${className}`}>
      <div className="border-b border-rule px-5 py-4">
        <p className="eyebrow">Setup needed</p>
        <p className="mt-2 text-[15px] font-medium text-ink">
          Creating sets, solving problems, and the tutor are switched off
        </p>
        <p className="mt-1 text-[14px] leading-relaxed text-ink-2">
          Add one key to the <code className="font-mono text-[13px] text-ink">.env</code> file in the
          project folder, then restart the dev server. Everything else keeps working meanwhile.
        </p>
      </div>

      <div className="grid divide-y divide-rule sm:grid-cols-2 sm:divide-x sm:divide-y-0">
        <div className="px-5 py-4">
          <p className="text-[14px] font-medium text-ink">
            Free <span className="font-normal text-ink-3">· Google Gemini</span>
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-2">
            Free tier, no card. Key from{' '}
            <a
              className="text-accent underline underline-offset-2"
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noopener noreferrer"
            >
              aistudio.google.com
            </a>
            .
          </p>
          <pre className="mt-2.5 overflow-x-auto rounded-md bg-sunken px-3 py-2 font-mono text-[12px] text-ink">
            GEMINI_API_KEY=
          </pre>
        </div>

        <div className="px-5 py-4">
          <p className="text-[14px] font-medium text-ink">
            Paid <span className="font-normal text-ink-3">· Claude</span>
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-2">
            More accurate, a few cents per set. Key from{' '}
            <a
              className="text-accent underline underline-offset-2"
              href="https://console.anthropic.com/settings/keys"
              target="_blank"
              rel="noopener noreferrer"
            >
              console.anthropic.com
            </a>
            .
          </p>
          <pre className="mt-2.5 overflow-x-auto rounded-md bg-sunken px-3 py-2 font-mono text-[12px] text-ink">
            ANTHROPIC_API_KEY=
          </pre>
        </div>
      </div>
    </div>
  )
}
