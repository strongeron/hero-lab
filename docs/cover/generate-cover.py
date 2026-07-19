"""A1 (full bleed, copy punched out of the field) — four ways to make the change
read as continuous rather than stepped.

The stepped feel came from long holds: `0%,20%` parks the field on a state, then
it jumps to the next. Every variant here removes the holds; they differ in HOW
they avoid landing on a uniform state.

  n1  even keyframes, no holds        — simplest continuous loop
  n2  many micro-states               — evolution rather than transitions
  n3  deep stagger                    — bands far enough apart that the field is
                                        never uniform; the wave IS the motion
  n4  decoupled rates                 — shape and colour on different periods, so
                                        they never re-align and the loop stops
                                        announcing itself
"""
import pathlib

W, H = 1120, 700
BG = "#0A1714"
INK = "#E8EFEA"
DIM = "#ffffff"
G1, G2 = "#2DD4A8", "#3ECF8E"
P1, P2 = "#E6307A", "#FF6B2B"

BANDS = 6
out = pathlib.Path(__file__).parent

# A sine-like curve: symmetric, no hard start or stop. `ease-in-out` built-in is
# too weak; this is the audit's strong ease-in-out relaxed toward a smoother
# mid-section so continuous motion never snaps.
SINE = "cubic-bezier(.37,0,.63,1)"


def shell(css, defs_extra, field_body, cta=G1):
    header = (f'  <g>\n    <rect x="36" y="30" width="28" height="28" rx="8" fill="{DIM}" fill-opacity=".30"/>\n'
              f'    <rect x="76" y="37" width="58" height="14" rx="7" fill="{INK}" fill-opacity=".55"/>\n')
    x = 210
    for w in (62, 74, 58, 44, 66):
        header += f'    <rect x="{x}" y="38" width="{w}" height="12" rx="6" fill="{DIM}" fill-opacity=".22"/>\n'
        x += w + 26
    header += (f'    <rect x="{W-232}" y="28" width="84" height="32" rx="16" fill="none" stroke="{DIM}" stroke-opacity=".22"/>\n'
               f'    <rect x="{W-136}" y="28" width="100" height="32" rx="16" fill="{cta}" fill-opacity=".85"/>\n  </g>\n')
    copy = (f'  <g>\n'
            f'    <rect x="72" y="424" width="380" height="22" rx="11" fill="{INK}" fill-opacity=".92"/>\n'
            f'    <rect x="72" y="460" width="281" height="22" rx="11" fill="{INK}" fill-opacity=".92"/>\n'
            f'    <rect x="72" y="508" width="311" height="10" rx="5" fill="{DIM}" fill-opacity=".26"/>\n'
            f'    <rect x="72" y="528" width="220" height="10" rx="5" fill="{DIM}" fill-opacity=".26"/>\n'
            f'    <rect x="72" y="564" width="160" height="36" rx="18" fill="{cta}" fill-opacity=".9"/>\n'
            f'  </g>\n')
    defs = f'''    <linearGradient id="g1" x1="0" y1="0" x2="1" y2=".4">
      <stop offset="0" stop-color="#fff" stop-opacity=".9"/>
      <stop offset="1" stop-color="#fff" stop-opacity=".22"/>
    </linearGradient>
    <mask id="mClear">
      <rect width="{W}" height="{H}" fill="url(#g1)"/>
      <rect x="40" y="392" width="470" height="216" rx="24" fill="#000"/>
    </mask>
{defs_extra}'''
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" fill="none">\n'
            f'  <style>\n{css}\n  </style>\n  <defs>\n{defs}  </defs>\n'
            f'  <rect width="{W}" height="{H}" fill="{BG}"/>\n'
            f'{field_body}{header}{copy}</svg>\n')


def bands(prefix, step, cell_attrs='class="cell" x="5" y="5" width="26" height="26" rx="13"'):
    defs = "".join(
        f'    <pattern id="{prefix}{i}" width="{step}" height="{step}" patternUnits="userSpaceOnUse" '
        f'class="b{i}"><rect {cell_attrs} fill="{G1}"/></pattern>\n' for i in range(BANDS))
    bw = W / BANDS
    body = '  <g mask="url(#mClear)">\n'
    for i in range(BANDS):
        body += (f'    <rect x="{i*bw:.0f}" y="96" width="{bw:.0f}" height="{H-96}" '
                 f'fill="url(#{prefix}{i})"/>\n')
    body += '  </g>\n'
    return defs, body


def stagger_rules(total_spread, dur):
    """Spread the band delays across `total_spread` seconds."""
    step = total_spread / (BANDS - 1)
    return "\n".join(f'    .b{i} .cell{{animation-delay:{-i*step:.2f}s}}' for i in range(BANDS))


REDUCED = """    @media (prefers-reduced-motion:reduce){
      .cell{animation:none}
    }"""


# n1 — even keyframes, no holds
def n1():
    dur = 12
    css = f"""    .cell{{animation:m1 {dur}s {SINE} infinite}}
{stagger_rules(1.2, dur)}
    @keyframes m1{{
      0%   {{rx:13px;x:5px; y:5px; width:26px;height:26px;fill:{G1}}}
      25%  {{rx:2px; x:7px; y:7px; width:22px;height:22px;fill:{P1}}}
      50%  {{rx:8px; x:10px;y:10px;width:16px;height:16px;fill:{G2}}}
      75%  {{rx:4px; x:8px; y:8px; width:20px;height:20px;fill:{P2}}}
      100% {{rx:13px;x:5px; y:5px; width:26px;height:26px;fill:{G1}}}
    }}
{REDUCED}"""
    d, b = bands("f", 36)
    return shell(css, d, b)


# n2 — many micro-states: evolution rather than transitions
def n2():
    dur = 16
    stops = [(0, 13, 26, G1), (12, 10, 24, G2), (24, 5, 21, P2), (36, 2, 19, P1),
             (48, 6, 17, P1), (60, 9, 20, G2), (72, 12, 23, G1), (86, 13, 25, G1), (100, 13, 26, G1)]
    kf = "\n".join(
        f'      {p}%  {{rx:{r}px;x:{(30-w)/2:.0f}px;y:{(30-w)/2:.0f}px;width:{w}px;height:{w}px;fill:{c}}}'
        for p, r, w, c in stops)
    css = f"""    .cell{{animation:m2 {dur}s linear infinite}}
{stagger_rules(1.6, dur)}
    @keyframes m2{{
{kf}
    }}
{REDUCED}"""
    d, b = bands("f", 36)
    return shell(css, d, b)


# n3 — deep stagger: the wave is the motion
def n3():
    dur = 10
    css = f"""    .cell{{animation:m3 {dur}s {SINE} infinite}}
{stagger_rules(dur * 0.72, dur)}
    @keyframes m3{{
      0%   {{rx:13px;x:5px; y:5px; width:26px;height:26px;fill:{G1}}}
      33%  {{rx:2px; x:7px; y:7px; width:22px;height:22px;fill:{P1}}}
      66%  {{rx:8px; x:10px;y:10px;width:16px;height:16px;fill:{G2}}}
      100% {{rx:13px;x:5px; y:5px; width:26px;height:26px;fill:{G1}}}
    }}
{REDUCED}"""
    d, b = bands("f", 36)
    return shell(css, d, b)


# n4 — decoupled rates: shape and colour never re-align
def n4():
    css = f"""    .cell{{animation:shape 9s {SINE} infinite, hue 14s {SINE} infinite}}
{stagger_rules(1.4, 9)}
    @keyframes shape{{
      0%   {{rx:13px;x:5px; y:5px; width:26px;height:26px}}
      34%  {{rx:2px; x:7px; y:7px; width:22px;height:22px}}
      67%  {{rx:8px; x:10px;y:10px;width:16px;height:16px}}
      100% {{rx:13px;x:5px; y:5px; width:26px;height:26px}}
    }}
    @keyframes hue{{
      0%   {{fill:{G1}}}
      30%  {{fill:{P1}}}
      55%  {{fill:{P2}}}
      80%  {{fill:{G2}}}
      100% {{fill:{G1}}}
    }}
{REDUCED}"""
    d, b = bands("f", 36)
    return shell(css, d, b)


for name, fn in (("n1-even", n1), ("n2-micro", n2), ("n3-wave", n3), ("n4-decoupled", n4)):
    p = out / f"cover-a1-{name}.svg"
    p.write_text(fn())
    print(f"cover-a1-{name}.svg  {p.stat().st_size:>6,} bytes")
