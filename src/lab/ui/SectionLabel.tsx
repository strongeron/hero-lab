import type { ReactNode } from 'react'

/** The small uppercase heading that opens a group of settings in a panel or
 *  a toolbar column. Renders a real heading so the panel has an outline. */
export default function SectionLabel({ children, level = 3, action, className = '' }: {
  children: ReactNode
  level?: 2 | 3 | 4
  /** Optional trailing control, e.g. a small Reset or Copy button. */
  action?: ReactNode
  className?: string
}) {
  const H = `h${level}` as 'h2' | 'h3' | 'h4'
  return (
    <div className={`flex items-center justify-between gap-2 ${className}`}>
      <H className="m-0 text-lab-2xs font-semibold uppercase tracking-[0.1em] text-lab-fg-subtle">{children}</H>
      {action}
    </div>
  )
}
