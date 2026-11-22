import DitherPanel from '../heroes/dither/DitherPanel'

function SlidersIcon() {
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

/** The docked Design Panel: a header with a close button, and the hero's
 *  panel body. Full width on phones (it overlays there; HeroLab drops the
 *  layout offset below `sm`), 320px from `sm` up (HeroLab's PANEL_WIDTH). */
export default function DesignPanel({ onClose }: { onClose: () => void }) {
  return (
    <aside
      aria-label="Design Panel"
      data-design-panel
      className="fixed top-0 right-0 bottom-0 z-[1000] w-full sm:w-80 border-l bg-lab-panel border-lab-border flex flex-col overflow-hidden"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-lab-border shrink-0">
        <h2 className="m-0 text-lab-sm font-semibold text-lab-fg flex items-center gap-2">
          <SlidersIcon />
          Design Panel
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close design panel"
          title="Close design panel (⌘/Ctrl + Shift + E)"
          className="w-6 h-6 rounded-md flex items-center justify-center cursor-pointer bg-transparent border-0 text-lab-fg-subtle hover:text-lab-fg hover:bg-lab-fill-hover transition-colors lab-focus"
        >
          <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
      {/* overscroll-contain: the page behind a full-width phone panel does not
          scroll along. max-sm:pb-24 clears the view bar and perf strip, which
          cover the panel's bottom on phones. */}
      <div className="flex-1 overflow-y-auto overscroll-contain min-h-0 max-sm:pb-24">
        <DitherPanel />
      </div>
    </aside>
  )
}
