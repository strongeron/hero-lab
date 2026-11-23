import BrandMark from '../components/BrandMark'

/** The title block shared by every lab view's toolbar (Canvas, Breakpoints,
 *  Layers). Canvas was the reference; the other two had drifted — no mark,
 *  `items-baseline` instead of `items-center`, and straps that wrapped instead
 *  of truncating. One component so they cannot drift again.
 *
 *  The mark is Hero Lab's morphing one, not the demo brand's: these toolbars
 *  belong to the lab rather than to the artboards. Clicking it goes home. */
export default function LabToolbarTitle({ view, onHome }: {
  view: string
  /** Go to the lab's main page (Canvas). Omitted on Canvas itself. */
  onHome?: () => void
}) {
  // No strap: the bottom bar already names the view, and a sentence of
  // explanation in every toolbar was noise. Mark, product, view — that's all.
  return (
    // h1: the view's own title, so Canvas, Breakpoints and Recipe each have a
    // top-level heading for screen-reader navigation.
    <h1 className="m-0 text-lab-sm font-semibold text-lab-fg flex items-center gap-2.5 min-w-0 whitespace-nowrap">
      <BrandMark size={24} onClick={onHome} label={onHome ? 'Hero Lab — go to Canvas' : undefined} />
      Hero Lab
      <span aria-hidden="true" className="font-normal text-lab-fg-subtle">/</span>
      <span className="font-normal text-lab-fg-muted">{view}</span>
    </h1>
  )
}
