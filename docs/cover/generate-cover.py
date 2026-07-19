"""Hero Lab card art for glebstroganov.com/lab.

Skeleton only, no title: header parts (mark, nav, sign-in, CTA) over a dithering
field, hero copy and CTA below. The copy area is punched out of a MASK rather
than covered by a plate — that is what the real hero does, flowing around the
text instead of sitting behind a panel.

GEOMETRY — every cell must land whole
-------------------------------------
Partial cells sliced by an edge look like a rendering bug, not a design. Three
things have to agree with the cell step for that to hold:

  * the field width must be a whole number of cells   1120 / 32 = 35   OK
  * the field height likewise                          576 / 32 = 18   OK
  * every band boundary, since each band is its own clipped rect —
    7 bands x 160px = 5 cells each                                     OK

`patternUnits="userSpaceOnUse"` tiles from the SVG origin, so tile boundaries
fall on multiples of the step from 0. The field starts at y=124, which is not
one, hence `patternTransform` phase-shifting the grid by 124 mod 32 = 28. That
buys a field flush to the bottom edge with no sliced row.

The shape is also inset within its cell, so it never touches a tile edge and
cannot appear clipped where two bands meet.

MOTION
------
The field MORPHS rather than cross-fading. Fading stacked pattern layers
double-exposes — a circle and a square visible at once, which reads muddy. One
cell animating its own geometry is a single continuous shape.

No holds: parking on each state and jumping reads as steps, not change. Even
keyframes on a sine-like curve keep it moving (measured 95% of sampled frames
in motion; the rest is the curve's own turnarounds).

Bands are staggered so the change sweeps across instead of snapping in unison.
The stagger must scale with the loop — the usual 30-80ms guidance is calibrated
for ~250ms UI entrances and is invisible against a 12s ambient loop.
"""
import pathlib

W, H = 1120, 700

STEP = 32                          # cell pitch
FIELD_X, FIELD_W = 0, 1120         # 35 cells
FIELD_Y, FIELD_H = 124, 576        # 18 rows, flush to the bottom edge
PHASE = FIELD_Y % STEP             # 28 — shifts the tile grid onto FIELD_Y
BANDS = 7                          # 160px each = 5 cells, so band edges align

# The copy clearance is snapped to the same grid, so its straight edges fall
# BETWEEN rows instead of slicing through one. Only the 24px corner radius
# crosses a cell, which is far less legible than a sliced row.
HOLE_X, HOLE_Y, HOLE_W, HOLE_H = 32, 380, 480, 224   # 15 cells x 7 rows

BG = "#0A1714"
INK = "#E8EFEA"
DIM = "#ffffff"
G1, G2 = "#2DD4A8", "#3ECF8E"
P1, P2 = "#E6307A", "#FF6B2B"

SINE = "cubic-bezier(.37,0,.63,1)"
DUR = 12
SPREAD = 1.2                       # seconds of stagger across the full width

out = pathlib.Path(__file__).parent


def inset(size):
    """Centre `size` in the cell, so the shape never touches the tile edge."""
    return (STEP - size) / 2


def keyframes():
    states = ((0, 22, 11, G1), (25, 18, 1, P1), (50, 13, 6.5, G2), (75, 17, 4, P2), (100, 22, 11, G1))
    return "\n".join(
        f'      {pct}%  {{rx:{rx}px;x:{inset(sz):g}px;y:{inset(sz):g}px;'
        f'width:{sz}px;height:{sz}px;fill:{col}}}'
        for pct, sz, rx, col in states)


def css():
    step = SPREAD / (BANDS - 1)
    delays = "\n".join(f'    .b{i} .cell{{animation-delay:{-i*step:.2f}s}}' for i in range(BANDS))
    return f"""    .cell{{animation:m1 {DUR}s {SINE} infinite}}
{delays}
    @keyframes m1{{
{keyframes()}
    }}
    @media (prefers-reduced-motion:reduce){{
      .cell{{animation:none}}
    }}"""


def defs():
    i0 = inset(22)
    pats = "".join(
        f'    <pattern id="f{i}" width="{STEP}" height="{STEP}" patternUnits="userSpaceOnUse" '
        f'patternTransform="translate(0,{PHASE})" class="b{i}">'
        f'<rect class="cell" x="{i0:g}" y="{i0:g}" width="22" height="22" rx="11" fill="{G1}"/>'
        f'</pattern>\n' for i in range(BANDS))
    return pats + f'''    <linearGradient id="g1" x1="0" y1="0" x2="1" y2=".4">
      <stop offset="0" stop-color="#fff" stop-opacity=".9"/>
      <stop offset="1" stop-color="#fff" stop-opacity=".22"/>
    </linearGradient>
    <mask id="mClear">
      <rect width="{W}" height="{H}" fill="url(#g1)"/>
      <rect x="{HOLE_X}" y="{HOLE_Y}" width="{HOLE_W}" height="{HOLE_H}" rx="24" fill="#000"/>
    </mask>
'''


def field():
    bw = FIELD_W // BANDS
    body = '  <g mask="url(#mClear)">\n'
    for i in range(BANDS):
        body += (f'    <rect x="{FIELD_X + i*bw}" y="{FIELD_Y}" width="{bw}" height="{FIELD_H}" '
                 f'fill="url(#f{i})"/>\n')
    return body + '  </g>\n'


def header(y=44):
    s = f'  <g>\n    <rect x="36" y="{y-14}" width="28" height="28" rx="8" fill="{DIM}" fill-opacity=".30"/>\n'
    s += f'    <rect x="76" y="{y-7}" width="58" height="14" rx="7" fill="{INK}" fill-opacity=".55"/>\n'
    x = 210
    for w in (62, 74, 58, 44, 66):
        s += f'    <rect x="{x}" y="{y-6}" width="{w}" height="12" rx="6" fill="{DIM}" fill-opacity=".22"/>\n'
        x += w + 26
    s += (f'    <rect x="{W-232}" y="{y-16}" width="84" height="32" rx="16" fill="none" '
          f'stroke="{DIM}" stroke-opacity=".22"/>\n'
          f'    <rect x="{W-136}" y="{y-16}" width="100" height="32" rx="16" fill="{G1}" fill-opacity=".85"/>\n  </g>\n')
    return s


def copy_block(x=72, y=424):
    return (f'  <g>\n'
            f'    <rect x="{x}" y="{y}" width="380" height="22" rx="11" fill="{INK}" fill-opacity=".92"/>\n'
            f'    <rect x="{x}" y="{y+36}" width="281" height="22" rx="11" fill="{INK}" fill-opacity=".92"/>\n'
            f'    <rect x="{x}" y="{y+84}" width="311" height="10" rx="5" fill="{DIM}" fill-opacity=".26"/>\n'
            f'    <rect x="{x}" y="{y+104}" width="220" height="10" rx="5" fill="{DIM}" fill-opacity=".26"/>\n'
            f'    <rect x="{x}" y="{y+140}" width="160" height="36" rx="18" fill="{G1}" fill-opacity=".9"/>\n'
            f'  </g>\n')


svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" fill="none">\n'
       f'  <style>\n{css()}\n  </style>\n  <defs>\n{defs()}  </defs>\n'
       f'  <rect width="{W}" height="{H}" fill="{BG}"/>\n'
       f'{field()}{header()}{copy_block()}</svg>\n')

p = out / "hero-lab-cover.svg"
p.write_text(svg)
print(f"hero-lab-cover.svg  {p.stat().st_size:,} bytes")
print(f"  field {FIELD_W}x{FIELD_H} at ({FIELD_X},{FIELD_Y}) = "
      f"{FIELD_W//STEP} x {FIELD_H//STEP} whole cells, phase {PHASE}")
print(f"  {BANDS} bands x {FIELD_W//BANDS}px = {FIELD_W//BANDS//STEP} cells each")
