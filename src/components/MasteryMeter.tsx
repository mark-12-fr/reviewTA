import type { ProgressCounts } from '@/types'

/**
 * The one place colour is allowed to mean something: how far along you are.
 * The bar fills from the deepest ink (mastered) outward, so a set that has
 * been studied reads darker than one that has not.
 */
const STEPS = [
  { key: 'mastered', label: 'Mastered', swatch: 'bg-m3' },
  { key: 'familiar', label: 'Familiar', swatch: 'bg-m2' },
  { key: 'learning', label: 'Learning', swatch: 'bg-m1' },
  { key: 'unfamiliar', label: 'Not started', swatch: 'bg-m0' },
] as const

interface MasteryMeterProps {
  progress: ProgressCounts
  size?: 'sm' | 'md'
  legend?: boolean
}

export default function MasteryMeter({ progress, size = 'md', legend = false }: MasteryMeterProps) {
  const total = Math.max(1, progress.totalItems)
  const width = (count: number) => `${(count / total) * 100}%`

  return (
    <div>
      <div
        className={`flex w-full overflow-hidden rounded-full bg-m0 ${size === 'sm' ? 'h-1.5' : 'h-2'}`}
        role="img"
        aria-label={`${progress.mastered} mastered, ${progress.familiar} familiar, ${progress.learning} learning, ${progress.unfamiliar} not started`}
      >
        <span className="bg-m3 transition-[width] duration-500" style={{ width: width(progress.mastered) }} />
        <span className="bg-m2 transition-[width] duration-500" style={{ width: width(progress.familiar) }} />
        <span className="bg-m1 transition-[width] duration-500" style={{ width: width(progress.learning) }} />
      </div>

      {legend && (
        <dl className="mt-4 flex flex-wrap gap-x-7 gap-y-2">
          {STEPS.map((step) => (
            <div key={step.key} className="flex items-baseline gap-2">
              <span className={`h-2 w-2 flex-shrink-0 translate-y-px rounded-full ${step.swatch}`} />
              <dt className="text-[13px] text-ink-2">{step.label}</dt>
              <dd className="font-mono text-[13px] tabular-nums text-ink">{progress[step.key]}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}
