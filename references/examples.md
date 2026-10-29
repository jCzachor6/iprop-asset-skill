# The model assets

Five finished assets ship in `examples/`. Read the one closest to your task: its README first, then
the root, then one part. Four are pixel art; the butterfly aims at realism. All compile with 0.8.0
and pass `check-asset` (the sword with `--lint-off alpha` for its soft enchanted aura, the butterfly
with `--style realistic`, its wing programs also with `--allow-edge`). Every file names its stream
keys (`const i32 shapeKey = 0x51ed2701`) next to its other constants, and every root states its
variety level: the tree, the potion and the butterfly are extreme, the spruce, the sword and the
shield high.

| Model | Canvas | Shows best |
| --- | --- | --- |
| `tree/` | 128x128 | materials shared by two assets, weighted families, multi-pass drawing, clipping to the ground |
| `sword/` | 96x96 | one part per feature in two qualities, weighted quality tiers, a separate emission pass, mount points |
| `potion/` | 64x64 | parts that report where decorations fit, a clipping mask exported by a part, a material library used by every part |
| `butterfly/` | 256x256 | realism: symmetry from one mirrored part, data between parts through outputs, textures as masks, splitting for budget |
| `shield/` | 48x48 | this skill's workflow end to end: features as parts, masks exported for clipping, one part drawn in several passes, outputs taken from a part |

## tree: materials, families, passes

Files: `tree.ips` (broadleaf), `spruce.ips` (conifer) and `materials.ips` (`Bark`, `Leaves`,
`Needles`, `Cone`), which both trees import as `wood`.

- **Materials**: every tone of `Bark` and `Leaves` derives from the rolled `base`, so a grey bark or
  an autumn crown keeps the shading of the default ones. The root picks a season with
  `weighted {1: 44, 2: 12, ...}`, draws a shade from that season's gradient
  (`foliage[...].pick()`), then overrides: `leaves = wood.Leaves(base = hue)`. Blossom overrides
  only the light tones: `wood.Leaves(light = petal, glint = ...)`.
- **Families**: `kind` 0 rolls one of five silhouettes with `weighted`; the README describes each.
- **Every roll up front**: `grow()` pushes the shape stream and makes all its rolls first, whatever
  the silhouette, then walks the tree. The root calls it five times (dark outline, wood body, wood
  light, leaf clumps, sprigs); each walk makes the same draws, so the passes line up and each tone
  is painted over the whole tree at once, which keeps joints clean.
- **Masks**: a `layer ground(...)` rectangle becomes a mask (`mask.from`) and `clip(soil)` cuts
  the trunk and roots off flat at the ground line; `mask.offset(soil, 0, -1)` shifts it a pixel.
- **Constants**: named indices (`const i32 WOOD_DARK = 0`, `CURL`, `PULL`, ...) instead of magic
  numbers, and per-silhouette parameter lists.
- **Outputs**: `anchor` (the foot of the trunk), `collider` (the trunk's base) and
  `output list circle crown` (one circle per leaf clump) for a game's foliage or shade.
- Peak fuel about 3.7 million over seeds 0-1999, the most of the three pixel-art models; look at
  the heaviest seeds the check names.

## sword: features in two qualities, tiers, emission

Files: `sword.ips` (root), `blade.ips` + `hilt.ips` (soldier and ornate swords),
`plain-blade.ips` + `plain-hilt.ips` (peasant swords), `materials.ips` (`Steel`, `Gem`, `Rust`).

- **Feature split**: the two characteristic features, blade and hilt, are parts; each comes in a
  plain and an ornate version, chosen by the quality tier. The root rolls one construction (profile,
  guard, grip, pommel, proportions) and passes it to whichever pair draws.
- **Weighted pools**: `const distribution tiers = weighted {1: 55, 2: 20, 3: 25}` (peasant, ornate,
  soldier), `powers` for the enchantment strength, `finishFamilies` for the 40 metal finishes (70%
  worn grey, 29% pale silver, 1% one of sixteen rare hues). Each is drawn inside its own stream.
- **Colours**: palettes for fittings, grips, stones and handles, all drawn in one colour stream so
  they never move the construction. Gems are a material: `mats.Gem(base = stone)`, with brighter
  overrides when lit.
- **Axes as inputs**: `enchant`, `quality`, `finish`, `tone`, `cleanliness`, `rust`, `glowStrength`,
  `magicPalette`; 0 rolls each from the seed, and `check-asset` confirms a rolled value equals one
  forced value.
- **Two passes for the engine**: `renderPass 0` is the colour sprite, `renderPass 1` an emission map
  of the glowing pixels; the `glow` output carries the blur and bloom recipe as data. Render both
  with the same seed and inputs.
- **Mount points**: `tip` and `grip` let a game put the sword in a hand and trail effects from its
  point; they stay stable across enchantments and materials.
- The blades are painted pixel by pixel in the blade's own frame (along and across the blade),
  because the shading follows the diagonal blade; the cost stays near 0.5 million.

## potion: fitting features to each other

Files: `potion.ips` (root), `vessel.ips`, `neck.ips`, `cork.ips`, `seal.ips`, `materials.ips`
(cork, pewter, slate, cloth, wax, paper, brass, twine, parchment, gold, etching).

- **Families**: seventeen vessel silhouettes, each a branch that sets the proportions from a shared
  `sampler<f32>`; the neck and the stopper roll in a stream of their own.
- **A key per stream and per part**: `start = seed` on the first line, then `silhouetteKey`,
  `neckShapeKey`, `decorKey` for the streams and `vesselKey`, `neckKey`, `corkKey`, `sealKey` for
  the parts. A part seeded with a stream's key would replay that stream's numbers: its details
  would follow the silhouette family instead of varying on their own.
- **Parts that answer questions**: the root asks the vessel to fit a decoration of a given size at
  a given height; the vessel reports `label` (where), `labelfit` (at what scale it fits) and
  `charm` (where the seal rests), and exports `output mask interior`. The root reads them right
  after the call and paints the decoration inside `clip(vessel.outputs.interior)`.
- **One material library for every part**: the cork, the neck's rings, the vessel's bands and the
  seal import the same `materials.ips`. The parts receive the liquid's colour and build their
  materials; the root's decorations are helpers that take `p: mats.Parchment` or `g: mats.Gold`.
- **Derived colours**: the liquid is drawn from one of twelve elixir gradients; the glass tint
  follows it through `color.hsv` (an analog, complementary or the same hue, with a rolled
  saturation and value), so glass and liquid always belong together.
- **Inputs**: `fill` and `style` hash the seed when 0, `liquid` rolls when transparent, `seal`
  follows the style when 0. **Outputs**: `anchor` (the foot) and `collider` (glass, neck and
  stopper).
- The whole composition is captured in a `layer potionImage(alpha = surface.source_over)` and
  painted with `blend = surface.source_over`, so translucent glass and shadows survive.

## butterfly: the realistic direction

Files: `butterfly.ips` (root), `wing.ips` (one side: both wings, shadows, antenna), `body.ips`,
`scales.ips` (a texture tile exported as a mask), `forewing.ips` and `hindwing.ips` (each wing as a
program of its own). Its README describes the structure. What to take from it:

- one part drawn twice with the same seed, the second time `mirror_x = 1`, for exact symmetry, and
  keys shared on purpose: `hairKey` in `wing.ips` and `body.ips` gives the wings and the body one
  hair colour, and each motif's soft and sharp passes share a key so they draw the same motif;
- data between parts through point outputs when one part must match another (the body takes the
  wings' resolved style and colour scheme);
- orthogonal, weighted axes (`style`, `scheme`, `motif`), each forced alone;
- a texture drawn once as a mask and tiled with `mask.offset`;
- splitting a feature into its own program when it needs a whole fuel budget;
- soft painting: captured layers, `.blur(sigma)`, translucent shadows painted with source-over.

It predates materials: its colours are gradient palettes indexed by style. Written today, a wing
look (ground, rim, two accents, hair) would be a material that each colour scheme overrides.

## shield: what the workflow produces

Files: `shield.ips` (root), `parts/board.ips`, `parts/boss.ips`, `parts/emblem.ips` and
`materials.ips` (`Wood`, `Metal`, `Hide`, `Paint`). An agent wrote it with this skill from one
prompt: a 48x48 shield for a top-down roguelike, with an anchor, a grip and a collider.

- **Features as parts**: the board (silhouette, planks or plate, field paint, wear, rim and studs),
  the boss and the emblem. The root rolls the design and places them.
- **Families as profiles**: every row of the board is one span, symmetric about the centre, so each
  of the eight families is a half-width profile (`spanAt`) and the body is rows of `rect`. Weights
  keep round and heater shields common and the waisted one rare.
- **Masks as outputs**: the board exports `paint`, `lit`, `shade` and `seams`. The root draws the
  emblem four times with one key, clipped to each zone in the matching tone of one `Paint`
  material, so the emblem takes the board's light and its plank seams. The boss exports its
  footprint for its shadow.
- **Rules between axes**: bucklers lean to metal and stay bare unless an emblem is forced; the
  emblem keeps the rule of tincture (a colour on a metal, a metal on a colour) by comparing its
  brightness with what lies beneath.
- **Outputs from a part**: the board reports `foot`, `bounds` and `boss`; the root returns them as
  `anchor`, `collider` and `grip`.
- Peak fuel about 417,000, on a kite whose emblem takes four passes.

## Examples in the SDK

`node <skill>/scripts/sdk.mjs` prints the examples folder. Under `examples/language/`, every file
compiles and runs in the SDK's CI. Good for idioms:

- `minimal-prop.ips` (a boulder with one shared distribution) and `idioms.ips` (a crystal using every
  rule of the house style);
- `material-tree.ips` with `materials/forest.ips` (materials and helpers typed by a material);
- `point-distributions.ips`, `weighted.ips`, `samplers.ips`, `steppers.ips`, `collections.ips`;
- `captured-panels.ips`, `blurred-layer.ips`, `soft-mask.ips`, `masked-badge.ips` (layers, masks,
  clip, blur), `resource-exports.ips` with `parts/` (masks and layers exported by parts);
- `nested-import.ips` and `../colony/` (parts that import parts);
- `style/*.ips` (programs that break one rule each; the reference shows the fix) and `errors/`,
  `traps/` (what a diagnostic or a trap looks like).

The public site has a compact 0.8 sample of parts and materials: `https://infiniteprops.dev/intro/`
`tree.ips`, `clump.ips` (a part that takes a colour and builds the material from it, five-tone
ramp, a shadow from `mask.offset`) and `foliage.ips` (a library with a private palette and a
weighted family).

Do not copy the style of `examples/recipes/` (written for 0.4) or of the root `pot.ips`,
`flower.ips`, `portrait.ips`, `plant.ips`, `eyes.ips` and `hair.ips` (older `unit()`/`range()` style).
