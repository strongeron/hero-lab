import type { ReactNode } from 'react'

export interface SegmentedOption<T extends string | number> {
  value: T
  label: ReactNode
  /** Tooltip / extra context; also used as the accessible description. */
  title?: string
  disabled?: boolean
}

/** One choice out of a few, shown at once: view switcher, zoom, template,
 *  dither type. `pill` is floating chrome (the bottom view bar); `box` sits in
 *  toolbars and panels. Each option is a native button with aria-pressed. */
export default function Segmented<T extends string | number>({
  options, value, onChange, label, shape = 'box', size = 'sm', stretch = false,
}: {
  options: SegmentedOption<T>[]
  value: T | null
  onChange: (value: T) => void
  /** Accessible name of the group, e.g. "View" or "Zoom". */
  label: string
  shape?: 'pill' | 'box'
  size?: 'xs' | 'sm'
  /** Options share the full width equally. */
  stretch?: boolean
}) {
  const track = shape === 'pill'
    ? 'rounded-full p-1 gap-1'
    : 'rounded-lg p-0.5 gap-0.5 bg-lab-fill border border-lab-border'
  const item = [
    'shrink-0 cursor-pointer border-0 font-medium transition-[color,background-color,border-color,transform] active:scale-[0.96] lab-focus',
    'disabled:opacity-40 disabled:cursor-not-allowed',
    shape === 'pill' ? 'rounded-full px-3 py-1.5' : 'rounded-md px-2.5 py-1',
    size === 'xs' ? 'text-lab-xs' : 'text-lab-sm',
    stretch ? 'flex-1' : '',
  ].join(' ')
  return (
    <div role="group" aria-label={label} className={`flex items-center ${track}`}>
      {options.map((o) => {
        const on = o.value === value
        return (
          <button
            key={String(o.value)}
            type="button"
            onClick={() => onChange(o.value)}
            aria-pressed={on}
            disabled={o.disabled}
            title={o.title}
            className={`${item} ${on
              ? 'bg-lab-fill-selected text-lab-fg'
              : 'bg-transparent text-lab-fg-muted hover:text-lab-fg hover:bg-lab-fill-hover'}`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
