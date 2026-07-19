import BrandMark from '../components/BrandMark'

/** The title block shared by every lab view's toolbar (Templates, Breakpoints,
 *  Layers). Templates was the reference; the other two had drifted — no mark,
 *  `items-baseline` instead of `items-center`, and straps that wrapped instead
 *  of truncating. One component so they cannot drift again.
 *
 *  The mark is the animated one: these toolbars belong to Hero Lab rather than
 *  to the demo brand inside the artboards, and only one view is mounted at a
 *  time, so this costs a single WebGL context. */
export default function LabToolbarTitle({ view, strap }: { view: string; strap: string }) {
  // `min-w-0` + `nowrap` so the strap truncates rather than wrapping: without
  // it a narrow viewport turns this row into a tall column and shoves the
  // canvas down the page. The strap is context, not navigation, so it is the
  // first thing to go when space is short.
  return (
    <span className="text-[12px] font-semibold text-white/90 flex items-center gap-2 min-w-0 whitespace-nowrap">
      <BrandMark size={20} />
      Hero Lab
      <span className="font-normal text-white/45">{view}</span>
      <span className="hidden lg:inline font-normal text-white/25 truncate">{strap}</span>
    </span>
  )
}
