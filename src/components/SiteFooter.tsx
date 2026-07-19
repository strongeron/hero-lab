/** Author / colophon footer, shown below the hero on the Live view only.
 *
 *  Deliberately quiet: the hero is the loud part, and this is the credit line
 *  underneath it. Colours come from the `t-*` palette tokens so it follows
 *  whatever palette the active template sets, rather than pinning its own. */

const LINKS = [
  { label: 'Source on GitHub', href: 'https://github.com/strongeron/hero-lab' },
  { label: 'Paper Design shaders', href: 'https://github.com/paper-design/shaders' },
  { label: 'glebstroganov.com', href: 'https://glebstroganov.com' },
  { label: 'X', href: 'https://x.com/strongeron' },
]

export default function SiteFooter() {
  return (
    <footer className="border-t border-t-border bg-t-bg">
      <div className="max-w-[1440px] mx-auto px-5 sm:px-8 xl:px-16 py-16 sm:py-20">
        <div className="max-w-[68ch] flex flex-col gap-5">
          <p className="text-[15px] sm:text-base leading-relaxed text-t-body">
            Built by{' '}
            <a
              href="https://glebstroganov.com"
              className="font-semibold text-t-headline no-underline hover:underline underline-offset-4"
            >
              Gleb Stroganov
            </a>
            , design engineer at{' '}
            <a
              href="https://evilmartians.com/martians/gleb-stroganov"
              className="text-t-headline no-underline hover:underline underline-offset-4"
            >
              Evil Martians
            </a>
            .
          </p>

          <p className="text-[15px] sm:text-base leading-relaxed text-t-body">
            <span className="text-t-headline">Hero Lab</span> is a playground for hero
            sections — a WebGL dithering shader with every parameter wired to a live
            control, breakpoint previews, and template artboards. Built to answer a narrow
            question quickly: what does this section actually look like at 320px, in
            motion, before anyone writes the CSS. Tune it, then copy the config back into
            code.
          </p>

          <p className="text-[15px] sm:text-base leading-relaxed text-t-body">
            The shader itself is{' '}
            <a
              href="https://github.com/paper-design/shaders"
              className="text-t-headline no-underline hover:underline underline-offset-4"
            >
              @paper-design/shaders
            </a>{' '}
            by{' '}
            <a
              href="https://paper.design"
              className="text-t-headline no-underline hover:underline underline-offset-4"
            >
              Paper Design
            </a>{' '}
            — free, open source, and MIT licensed. This lab is a control surface on top of
            their work, not a replacement for it.
          </p>

          <nav className="flex flex-wrap items-center gap-x-8 gap-y-3 pt-2">
            {LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noreferrer"
                className="text-[15px] text-t-body underline underline-offset-4 decoration-t-border-strong hover:text-t-headline hover:decoration-current transition-colors"
              >
                {link.label}
              </a>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  )
}
