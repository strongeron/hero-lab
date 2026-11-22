import BrandMark from '../components/BrandMark'

/** The title block shared by every lab view's toolbar (Canvas, Breakpoints,
 *  Layers). Canvas was the reference; the other two had drifted — no mark,
 *  `items-baseline` instead of `items-center`, and straps that wrapped instead
 *  of truncating. One component so they cannot drift again.
 *
 *  The mark is Hero Lab's morphing one, not the demo brand's: these toolbars
 *  belong to the lab rather than to the artboards. Clicking it goes home. */
export default function LabToolbarTitle({ view, strap, onHome }: {
  view: string
  strap: string
  /** Go to the lab's main page (Canvas). Omitted on Canvas itself. */
  onHome?: () => void
}) {
  // `min-w-0` + `nowrap` so the strap truncates rather than wrapping: without
  // it a narrow viewport turns this row into a tall column and shoves the
  // canvas down the page. The strap is context, not navigation, so it is the
  // first thing to go when space is short.
  return (
    <span className="text-lab-sm font-semibold text-lab-fg flex items-center gap-2 min-w-0 whitespace-nowrap">
      <BrandMark size={20} onClick={onHome} label={onHome ? 'Hero Lab — go to Canvas' : undefined} />
      Hero Lab
      <span className="font-normal text-lab-fg-muted">{view}</span>
      <span className="hidden lg:inline font-normal text-lab-fg-subtle truncate">{strap}</span>
    </span>
  )
}
