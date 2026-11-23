import { useId } from 'react'

/** One numeric setting: a labelled native range input with its current value.
 *  The <label> names the input, so screen readers announce "Speed, 0.12". */
export default function SliderRow({
  label, value, min, max, step, suffix, onChange, className = '',
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  suffix?: string
  onChange: (value: number) => void
  className?: string
}) {
  const id = useId()
  return (
    <div className={`space-y-1 ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-lab-xs text-lab-fg-muted">{label}</label>
        <output htmlFor={id} className="text-lab-xs text-lab-fg-subtle font-mono tabular-nums">
          {value}{suffix ?? ''}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="lab-range lab-focus w-full"
      />
    </div>
  )
}
