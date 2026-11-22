import type { ReactNode } from 'react'

/** One on/off setting: a pressed-state button, with a visible label row by
 *  default. `inline` drops the row (for a SectionLabel action); the label then
 *  names the button. `children` replaces the On/Off text. */
export default function Toggle({ label, on, onChange, inline = false, children }: {
  label: string
  on: boolean
  onChange: (on: boolean) => void
  inline?: boolean
  children?: ReactNode
}) {
  const button = (
    <button
      type="button"
      onClick={() => onChange(!on)}
      aria-pressed={on}
      aria-label={inline || children == null ? label : undefined}
      className={`min-h-6 min-w-9 shrink-0 px-2 rounded-md border text-lab-xs font-medium cursor-pointer transition-colors lab-focus ${
        on
          ? 'border-lab-accent/40 bg-lab-accent/15 text-lab-accent'
          : 'border-lab-border bg-lab-fill text-lab-fg-subtle hover:text-lab-fg-muted hover:bg-lab-fill-hover'
      }`}
    >
      {children ?? (on ? 'On' : 'Off')}
    </button>
  )
  if (inline) return button
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-lab-xs text-lab-fg-muted">{label}</span>
      {button}
    </div>
  )
}
