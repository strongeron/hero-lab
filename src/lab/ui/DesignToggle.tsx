export function SlidersIcon() {
  return (
    <svg aria-hidden="true" width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="21" y1="4" x2="14" y2="4" />
      <line x1="10" y1="4" x2="3" y2="4" />
      <line x1="21" y1="12" x2="12" y2="12" />
      <line x1="8" y1="12" x2="3" y2="12" />
      <line x1="21" y1="20" x2="16" y2="20" />
      <line x1="12" y1="20" x2="3" y2="20" />
      <line x1="14" y1="2" x2="14" y2="6" />
      <line x1="8" y1="10" x2="8" y2="14" />
      <line x1="16" y1="18" x2="16" y2="22" />
    </svg>
  )
}

/** Opens and closes the Design Panel. It renders only in views the panel
 *  edits (Live, Breakpoints, Canvas), never in Recipe.
 *  - `toolbar`: at the right end of a lab view's toolbar, next to Zoom.
 *  - `edge`: Live has no lab toolbar (the header there is the demo site's), so
 *    a closed panel leaves a tab on the right edge, where the panel opens. */
export default function DesignToggle({ open, onToggle, variant = 'toolbar' }: {
  open: boolean
  onToggle: () => void
  variant?: 'toolbar' | 'edge'
}) {
  const label = `${open ? 'Close' : 'Open'} the Design Panel (⌘/Ctrl + Shift + E)`
  if (variant === 'edge') {
    return (
      <button
        type="button"
        onClick={onToggle}
        aria-label="Open the Design Panel"
        aria-keyshortcuts="Meta+Shift+E Control+Shift+E"
        title={label}
        className="fixed right-0 top-1/2 z-[1002] -translate-y-1/2 flex flex-col items-center gap-2 px-1.5 py-3 rounded-l-lg border border-r-0 bg-lab-surface border-lab-border shadow-lab-float text-lab-xs font-medium text-lab-fg-muted hover:text-lab-fg cursor-pointer transition-colors lab-focus"
      >
        <SlidersIcon />
        <span className="[writing-mode:vertical-rl]">Design</span>
      </button>
    )
  }
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={open}
      aria-keyshortcuts="Meta+Shift+E Control+Shift+E"
      title={label}
      className={`min-h-6 shrink-0 inline-flex items-center gap-1.5 px-2 rounded-md border text-lab-xs font-medium cursor-pointer transition-[color,background-color,border-color,scale] motion-safe:active:scale-[0.96] lab-focus ${
        open ? 'bg-lab-fill-selected border-lab-border-strong text-lab-fg' : 'bg-lab-fill border-lab-border text-lab-fg-muted hover:text-lab-fg hover:bg-lab-fill-hover'
      }`}
    >
      <SlidersIcon />
      Design
    </button>
  )
}
