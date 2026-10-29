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
| Execution limits; Grammar | for fuel, canvas limits and syntax questions |
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

0.7 removed the implicit `v`/`a` controls and reserved `const`, `to`, `with`, `distribution`,
`sampler`, `stepper`, `weighted`, `density`, `layer`, `mask` and `clip`; `surface` cannot be an
import alias. `material` is a contextual keyword in 0.8.

## The features, in code

Every snippet below comes from `references/snippets/` (`crate.ips`, `looks.ips`,
`parts/band.ips`), an asset that compiles and renders with 0.8.0.

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

## Traps (they pass `--check` and fail at run time)

| Trap | Cause and fix |
| --- | --- |
| a distribution with no mass in its range | parameters in the wrong units: `14.0 to 26.0 with gaussian(0.5, 0.18)`; use the value's units or `lerp(lo, hi, 0.0 to 1.0 with d)` |
| fuel exhausted | pixel loops or too many shapes: paint rows, reuse layers and masks, split heavy features |
| integer division by zero | guard divisors (`max(n, 1)`) |
| an unbalanced `stream_pop` | every `stream_push` needs a `stream_pop` on every path |
| reading an output never set | read a part's output only after a call that sets it, on every branch |
| a list index out of range | indexes are `i32`, from 0 to `list.len(items) - 1` |
| a reversed range or a bad blur sigma | keep `lo <= hi` for dynamic bounds; blur sigma from 0 to 64 |

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

After each step, `check-asset --baseline <old.iprop>` shows which seeds changed; a change of RNG
order (a new draw, `chance` instead of a range) legitimately changes seeds, so look at the sheets.
