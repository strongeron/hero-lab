/** Classes for a pickable tile (a preview with a label): Design Panel and
 *  Layers. Add the padding at the call site (p-1 or p-1.5). Pressed state via
 *  aria-pressed. */
export const pickTile =
  'min-w-0 rounded-md border border-lab-border bg-lab-fill text-left text-lab-fg-muted hover:bg-lab-fill-hover aria-pressed:border-lab-border-strong aria-pressed:bg-lab-fill-selected aria-pressed:text-lab-fg cursor-pointer transition-[color,background-color,border-color,transform] active:scale-[0.96] lab-focus'
