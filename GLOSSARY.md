# Hero Lab

A lab for building and art-directing landing-page heroes. The first hero, Dither, is a dot-field scene with a Problem ⇄ Fix reveal under the cursor.

## Scene

**Hero**:
One full-bleed landing-page section: a background scene with a copy block on top.

**Scene template**:
A named, authored set of motion and look values for the background (for example Full Bleed or Classic).
_Avoid_: preset, scene preset

**Hero template**:
A named combination of copy, composition, scene template and initial state shown in the Canvas view.

**Composition**:
Where the copy sits and how the background meets it: Split (headline left, response and CTA right, at the bottom), Centered or Wild type. The Design Panel calls it Layout.
_Avoid_: layout (in prose; `DitherLayoutConfig` is the Split column grid)

**Halo**:
In the Centered composition, the clear zone around the whole copy block. Tight or Wide.

**Letter fill**:
In the Wild type composition, the background shows only inside the headline's letters.
_Avoid_: text mask, clip text

**Layer**:
One colour in the background, with its own shape and opacity. Layers combine by screen blending.
_Avoid_: colour layer, alpha layer (as a separate concept)

**Tile grid**:
The fixed lattice of rounded squares that the background is cut into. Its size is the pitch.
_Avoid_: pixel grid (in prose), cell grid

**Tile display**:
How each tile shows the scene: as free colour, as snapped colour (one flat colour per tile), or as point sizes (dots that grow and shrink).
_Avoid_: tile mode, renderer

**Edge**:
How the background ends where the copy block starts (fade, sharp, overlap, ripple, dissolve, full).

**Clearance**:
The area around the copy text where no tile is drawn, so text never sits on a shape.
_Avoid_: exclusion, text clear

## States and hover

**Problem state** / **Fix state**:
The two looks of a hero. One is shown at rest (the initial state); the other appears under the cursor.

**Initial state**:
The state a hero shows at rest.

**Reveal**:
The hover effect that shows the other state's layers inside the cursor area.

**Recolor**:
The hover effect that keeps the resting pattern and changes only its colour inside the cursor area.

**Warp**:
The hover effect that rotates, rounds and resizes whole tiles inside the cursor area; it can also reveal or recolor them.

**Overlay**:
The hover effect that lays a flat colour over the cursor area.
