# The language: what to read, what to reach for, how to repair

## Reading the reference

`node <skill>/scripts/sdk.mjs` prints the path of `LLM_REFERENCE.md` for the SDK in use and the
line where each section starts. It is generated from the handbook, the compiler's own catalog and
examples that CI compiles and runs, so it matches the compiler exactly. Its parts:

| Section | Read it |
| --- | --- |
| Write idiomatic props, Before and after, Compiler rules | before writing any code (lines 1 to about 440) |
| Assets, inputs and outputs; Source syntax; Types; Control flow; Helpers | when declaring inputs, outputs, constants and helpers |
| Randomness: ranges, gradients and distributions; Captured descriptions and explicit picks | for every draw, samplers and steppers |
| Drawing and colors; Palettes; Reusable materials | for shapes, colour derivation, palettes and materials |
| Immutable lists and polygon points | for `list<T>` and polygons |
| Parts | for imports, `draw(...)`, transforms, outputs of parts |
| Captured layers and surface painting | for layers, masks, clip, blur and alpha modes |
| Geometry, masks and typed parts | for `noise.mask`, `voronoi`, `contour`, `regions` and dynamic parts (0.9); the handbook's `noise.md` and `geometry.md` hold the constants (`noise.mode_cell`, `voronoi.grid`, ...) and more examples |
| Execution limits; Grammar | for fuel, work limits, canvas limits and syntax questions |
| Builtins | for the exact signature and argument names of every builtin |
| Rejection and repair | for typical compile errors and their fixes |

The handbook chapters behind it are in the SDK's `docs/language/*.md`, with longer explanations.
`ipc --describe-language` prints the compiler's whole catalog as JSON. When the SDK is missing,
`https://infiniteprops.dev/LLM_REFERENCE.md` holds the reference of the latest release.

## Minimum versions

| Feature | Since |
| --- | --- |
| `a to b` ranges (both ends included), `with` distributions, colour and vec2 gradients, nested parts | 0.6 |
| `const`, `list<T>`, samplers, steppers, `weighted` and `density`, layers, masks, `clip`, `.blur` | 0.7 |
| fuel budget 5,000,000 (was 2,000,000) | 0.7.1 |
| vec2 overloads of the drawing builtins | 0.7.2 |
| material libraries | 0.8.0 |
| `noise.mask`; `noise.fbm` with lacunarity and gain, `noise.cell2`, `noise.cell_id`, `noise.warp_vec`; `voronoi`, `contour`, `regions` with `gap`, `bevel` and `mask`; dynamic parts (`part.*`, `parts.*`, `output list part`); a new fuel tariff and a separate host work limit | 0.9.0 |

0.7 removed the implicit `v`/`a` controls and reserved `const`, `to`, `with`, `distribution`,
`sampler`, `stepper`, `weighted`, `density`, `layer`, `mask` and `clip`; `surface` cannot be an
import alias. `material` is a contextual keyword in 0.8. 0.9 reserves nothing new: the handle
types (`diagram2d`, `contours2d`, `regions2d`, `part2d`, `parts2d`) are contextual names.

## The features, in code

The snippets up to "Outputs" come from `references/snippets/` (`crate.ips`, `looks.ips`,
`parts/band.ips`), an asset that compiles and renders with 0.9.0; the 0.9 ones come from the model
assets in `examples/`. The tests compile both.

**Ranges and distributions.** A range picks `i32` or `f32` from its bounds; `with` shapes it in the
units of the drawn value.

```ips
  const distribution typical = gaussian(mean = 0.5, sigma = 0.18)
  const distribution kinds = weighted {1: 60, 2: 40}
...
    half = lerp(8.0, 13.0, 0.0 to 1.0 with typical)
    lean = -1.0 to 1.0 with gaussian(mean = 0.0, sigma = 0.4)
    planks = 2 to 4
    damaged = chance(0.25)
    look = 1 to 2 with kinds
```

Other families: `beta(alpha, beta)` leans towards one end (wear that is mostly low),
`triangular(min, peak, max)` has a clear most-likely value, `density {x: h, ...}` is a drawn curve.

**Choices.** `pick(1, 2, 2, 3)` among values (repeat one to weight it), `index(n)` for a palette
element, `chance(p)` for an optional feature. Each consumes one draw from the current stream.
`choose(hash, a, b, ...)` and `roll(hash, a, b)` draw from an isolated stream seeded by the hash.

**Stream keys, hashed rolls and streams.** One named key per purpose; `start` keeps the game's
seed before any draw moves `seed`.

```ips
  const i32 kindKey = 0x2f6b9a13
  const i32 shapeKey = 0x51ed2701
...
    start = seed
    look = clamp(kind, 0, 2)
    if (look == 0) {
      stream_push(hash(start ^ kindKey))
      look = 1 to 2 with kinds
      stream_pop()
    }
    stream_push(hash(start ^ shapeKey))   // the shape: every roll, whatever the kind
    ...
    stream_pop()
```

**Colours.** One gradient draw per colour; palettes for fixed sets; derived tones.

```ips
  palette stains = [#3a2a1a, #2a2a22, #4a3020]
...
    stain = stains[index(3)]
    tones = stepper(wood.shadow to wood.light).pick(5)      // five tones, a list<color>
    clip(mask.from(body)) { oval(x, y, 3.0, 1.0, color.mix(stain, tones[2], 0.5)) }
```

Gradient palettes hold descriptions; draw a colour with `.pick()`:
`palette woods = [#5a4230 to #7a5c40, #6a5a48 to #8a7a64]` then `woods[0 to 1 with kinds].pick()`.
`color.hsv(c, hue, saturation, value)` shifts the hue by turns and scales saturation and value;
`color.shade(c, steps)`, `color.mix(a, b, t)`, `color.scale(c, k)` and `color.set.a(c, alpha)` do
the rest. A colour input reads its channels: `tint.a != 0`.

**Constants, samplers and lists.**

```ips
  const sampler<f32> wobble = sampler(-1.0 to 1.0 with gaussian(mean = 0.0, sigma = 0.5))
  const list<vec2> chip = [{14, 27}, {18, 27}, {16, 29}]
...
    stainX = wobble.pick() * 3.0         // .pick(n) returns a list of n draws
    poly(chip, stain)                    // list.len(chip) == 3
```

**Materials** (a library file has no asset; its palettes and consts stay private to it):

```ips
// looks.ips
palette woods = [#5a4230 to #7a5c40, #6a5a48 to #8a7a64]
const distribution kinds = weighted {0: 70, 1: 30}

material Wood {
  base = woods[0 to 1 with kinds].pick()
  shadow = color.mix(base, #1a1428, 0.45)
  light = color.mix(base, #fff0c0, 0.35)
  edge = color.mix(base, #0c0808, 0.8)
}
```

```ips
import looks from "looks.ips"
...
    wood = looks.Wood()                                   // rolls every range once, in field order
    if (tint.a != 0) { wood = looks.Wood(base = color.set.a(tint, 255)) }   // later fields follow
```

Create instances only by assignment, pass them to helpers typed `m: looks.Wood`, and give a part a
colour, not a material: the part builds its own (`m = looks.Iron(base = iron)` in `band.ips`).
Check a library alone with `ipc looks.ips --check`.

**Layers, masks, outlines and translucency.** The root canvas starts in `surface.legacy`, where a
translucent colour over an empty pixel vanishes. Capture with source-over and paint with
source-over:

```ips
    layer body(alpha = surface.source_over) {
      ...rows of rect...
    }
    surface.paint(mask.expand(mask.from(body), 1), wood.edge, blend = surface.source_over)   // outline
    surface.paint(body, blend = surface.source_over)
    clip(mask.from(body)) { ... }                // paint only inside the body
...
    layer shadow(alpha = surface.source_over) { oval(16.0, 30.5, 12.0, 1.5, #00000060) }
    surface.paint(shadow, blend = surface.source_over)
```

Masks combine with `mask.union`, `mask.subtract`, `mask.intersect`, `mask.invert`,
`mask.shrink(m, r)`, `mask.offset(m, dx, dy)`; `layer.blur(sigma)` and `mask.blur(sigma)` soften
(realistic style). A part can export one with `output mask name` for its caller to clip to.

**Parts.**

```ips
import band from "parts/band.ips"
...
      band.draw(hash(start ^ bandKey), at = {16.0, top + tall * 0.5}, half = half, iron = iron.base)
      rivets = band.outputs.rivet                 // read right after the call, in caller coordinates
      band.draw(hash(start ^ bandKey), at = {16.0, top + tall * 0.5}, half = half, iron = iron.base, mirror_x = 1)
```

Both bands share one key, so the mirrored one repeats the first: a symmetric pair. The seed is
positional or named; `at` and the inputs are named; `rot` is 0, 90, 180 or 270 and
`mirror_x`/`mirror_y` are 0 or 1, all compile-time constants. Import paths resolve from the
importing file.

**Outputs**, only those the game reads: `output point anchor`, `output rect collider`,
`output circle light`; `output list point rivets` appends every assignment. Assign `{x, y}`,
`{x, y, w, h}`, `{x, y, r}`.

### 0.9: noise masks, geometry and dynamic parts

Pick the smallest pipeline: a texture is one `noise.mask`; geometry (`voronoi` or `contour`, then
`regions`) when pieces need gaps, adjacency or shapes of their own; dynamic parts only when pieces
need their own placement, appearance or export. All of them take an explicit seed, draw nothing
from the current stream and cannot be consts: give each a key (`hash(start ^ fissureKey)`), so
adding one moves no other roll.

**Noise masks** (`potion.ips`, its rare crackled glass). `noise.mask(origin, size, kind,
frequency, threshold, seed)` samples a noise field over the rectangle and keeps where it passes the
threshold; the named tail adds `octaves` (1-8), `softness` (0 is crisp), `comparison` and
`warp_amount`. Kinds: `noise.mode_value`, `mode_grad`, `mode_fbm`, `mode_cell` (spots below a
threshold), `mode_cell_edge` (seams below one, patches above), `mode_ridge` (veins above a high
one). The threshold is the raw noise value, and the field stays anchored to the canvas when the
rectangle moves.

```ips
    fissures = noise.mask({0, 0}, {64, 64}, noise.mode_cell_edge, {0.14, 0.14}, 0.08,
                          hash(start ^ fissureKey), octaves = 1, softness = 0.0,
                          comparison = noise.below, warp_amount = 0.3)
    surface.paint(fissures, color.set.a(#eef8ff, 100), blend = surface.source_over)
```

A mask combines like any other. The tree's moss is two bands of fbm noise kept inside the wood,
which the tree captures in a layer for its mask, with the tops lit and the undersides shaded by
offsets of the mask itself (`tree.ips`, `mossOn`):

```ips
    mask growth = mask.intersect(mask.union(low, high), mask.shrink(timber, 1))
    surface.paint(growth, m.base)
    surface.paint(mask.subtract(growth, mask.offset(growth, 0, 1)), m.light)
    surface.paint(mask.subtract(growth, mask.offset(growth, -1, -1)), m.deep)
```

**Voronoi and regions** (`shield.ips`, a cracked or shattered shield). `voronoi(origin, size,
count, seed)` scatters sites (`voronoi.grid`, jitter, Lloyd relaxation, anisotropy and rows in the
longer forms), or takes a `list<vec2>` of sites; the shield rings the hit with five so every crack
runs out from it. `regions(d)` makes the cells addressable (`regions.count`, `id`, `area`,
`center`, `neighbors`, `points`, `mask`); `regions(d, inset, min_area)` shrinks or grows them;
`regions.gap(rs, width, variation, seed)` opens gaps of varying width between them.
`regions.bevel(rs, width, light)` returns a soft shading layer for the realistic style; pixel art
shades from mask offsets, like the moss above.

```ips
      pieces = regions.gap(regions(voronoi({0, 0}, {48, 48}, spokes)), 1.0, 0.6, hash(seed ^ crackKey))
      // Region masks are anti-aliased; a legacy capture keeps only their
      // whole pixels, so the cracks stay crisp.
      layer kept { surface.paint(regions.mask(pieces), #ffffff) }
```

**Contours** turn a mask back into geometry. The shield traces its pixels between the cracks, so
each shard's shape is exactly what it shows; a low threshold keeps every whole pixel inside, and
`min_area` drops slivers:

```ips
        outlines = contour(mask.intersect(mask.from(whole), mask.from(kept)), 0.1, 0.0, 3.0, contour.four)
```

**Dynamic parts** are pieces made at run time, unlike the static parts above, which are files.
`part.create(rs, i)`, `part.create(mask)` or `part.create(layer)` make one, `parts.from_regions(rs)`
one per region; `part.fill(p, colour)` and `part.texture(p, image)` return a new view with an
appearance; `part.place(p, at, rot, mirror_x, mirror_y)` puts the original anchor at `at` (quarter
turns and mirrors, then a rounded translation, never cumulative); `part.center`,
`part.bounds_origin` and `part.bounds_size` read the result. `part.draw(p)` paints; only an
assignment to an `output list part` slot hands a piece to the game. At most 256 per generation.

```ips
  output list part shards           // a shattered shield's pieces, for the game's debris
...
        shardSet = parts.from_regions(regions(outlines))
        layer debris(alpha = surface.source_over) {
          for i in 0..parts.count(shardSet) {
            piece = part.texture(parts.get(shardSet, i), whole)
            away = part.center(piece) - hit
            piece = part.place(piece, part.center(piece) + away * (1.0 / max(vec2.len(away), 1.0)), 0, 0, 0)
            part.draw(piece)
            shards = piece
          }
        }
        // The traced edges pass half a pixel outside: keep the whole pixels.
        layer solid { surface.paint(mask.from(debris), #ffffff) }
        clip(mask.from(solid)) { surface.paint(debris, blend = surface.source_over) }
```

The handles (`diagram2d`, `contours2d`, `regions2d`, `part2d`, `parts2d`) can be locals, helper
parameters and return values; they cannot be consts, inputs, palette or list elements.

## Diagnostics and repair

`check-asset.mjs` runs `ipc <entry> --check --diagnostics=json` on every entry and prints
`file:line:column`, the code and the message. Run it alone when you want the JSON, which also carries
`suggestions` and `fix_its`. Codes: `IPS-LEX`, `IPS-PARSE`, `IPS-IMPORT`, `IPS-IO`, `IPS-TYPE`,
`IPS-CONST`, `IPS-PLAN`, `IPS-LIMIT`, `IPS-VALIDATE`.

| Message | Fix |
| --- | --- |
| `cannot assign f32` | a local keeps its first type: start it as `0.0`, or convert with `float()` / `int()` |
| `input 'x' is only visible inside 'draw'` | pass the input to the helper as a typed parameter |
| `has no argument 'colour'` | use the builtin's declared parameter names (see Builtins) |
| `function 'part.draw' has no argument 'x'` | the part does not declare `input ... x`; add it or drop the argument |
| `material 'lib.X' can only be created by assignment` | `m = lib.X()` first, then read `m.base` |
| `local 'x' is lib.X, cannot assign a non-material value` | the name already holds a material; use another name |
| `a material file has no asset to compile` | compile the asset that imports it; check the library with `--check` |
| a reserved word as a name (`layer`, `mask`, `const`, `to`, ...) | rename the local, input or helper |
| `min`/`max`/`clamp` result assigned to an `f32` local | integers in, integer out: pass one `f32` argument |
| comparing colours with `==` | compare channels: `c.a == 0` |
| `geometry handles depend on generation and cannot be const` | build the diagram, regions or parts in `draw` or a helper |
| `list elements must be scalar values, sampler<T> or stepper<T>, got part2d` | keep pieces in a `parts2d` (`parts.from_regions`) or loop over region indices |

## Traps (they pass `--check` and fail at run time)

| Trap | Cause and fix |
| --- | --- |
| a distribution with no mass in its range | parameters in the wrong units: `14.0 to 26.0 with gaussian(0.5, 0.18)`; use the value's units or `lerp(lo, hi, 0.0 to 1.0 with d)` |
| fuel exhausted | pixel loops or too many shapes: paint rows, reuse layers and masks, split heavy features |
| integer division by zero | guard divisors (`max(n, 1)`) |
| an unbalanced `stream_pop` | every `stream_push` needs a `stream_pop` on every path |
| reading an output never set | read a part's output only after a call that sets it, on every branch |
| `slot does not belong to the last called part` | a part's output read after another part was drawn: read every output right after its own call |
| a list index out of range | indexes are `i32`, from 0 to `list.len(items) - 1` |
| a reversed range or a bad blur sigma | keep `lo <= hi` for dynamic bounds; blur sigma from 0 to 64 |
| `noise mask octaves must be in 1..8` and other parameter checks | `--check` accepts them; keep noise octaves 1-8, sizes and frequencies positive, contour thresholds 0-1, Voronoi counts 1-256 and explicit sites distinct and inside the rectangle |
| `region offset has an ambiguous touching boundary` | Voronoi sites at one distance from a point meet in one vertex: jitter the distances |
| a dynamic part from an empty mask or layer, more than 256 parts, `regions.points` of a region with holes or over 256 vertices | build parts from regions or masks known to hold pixels; use `regions.mask` for complex regions |

`check-asset` scans seeds 1-200 because a trap often needs a rare seed. Raise `--scan` for assets
with rare looks.

## Modernising older sources

| Older code | Today |
| --- | --- |
| `w = 20 + int(unit() * 11)`, `range(a, b)` | `w = 20 to 30` |
| a uniform proportion `h = 14.0 to 26.0` | `lerp(14.0, 26.0, 0.0 to 1.0 with typical)` |
| `rgb(40 to 90, 120 to 200, 180 to 255)` | `#2878b4 to #5ac8ff` |
| `if ((0 to 5) == 0)` | `if (chance(1.0 / 6.0))` |
| thresholds on one roll (`r < 0.55`, `r < 0.80`) | `const distribution tiers = weighted {1: 55, 2: 25, 3: 20}` |
| `input i32 v = 0`, `input i32 a = 0` | inputs named after what they do: `fill`, `style`, `enchant`, each `0 rolls` |
| `hash(seed ^ 0x51ed2701)` repeated across `draw` | `const i32 shapeKey = 0x51ed2701` and `hash(start ^ shapeKey)` after `start = seed`: the same pixels wherever the old hash came before any draw in the main stream |
| the same tone code copied into several parts | a material library imported by each part |
| literal colours in drawing code | palettes, consts and material fields |
| a per-pixel fill of a shape | rows of `rect`, or a layer drawn once and reused through its mask |
| a translucent overlay painted on the root | a layer with `alpha = surface.source_over`, painted with `blend = surface.source_over` |
| spots, patches or veins from a per-pixel noise loop (`if (noise.cell(...) < t) pixel(...)`) | one `noise.mask`, painted or used as a clip: the butterfly's single program draws its marble this way for a fraction of the loop's fuel |
| stones or tiles placed on a jittered grid by hand | `voronoi` (`voronoi.grid` with jitter), `regions.gap`, `regions.mask` per stone |

After each step, `check-asset --baseline <old.iprop>` shows which seeds changed; a change of RNG
order (a new draw, `chance` instead of a range) legitimately changes seeds, so look at the sheets.
