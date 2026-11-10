# Butterfly

A butterfly seen from above, native 256x256 with the thorax at `(128, wing root)`, painted towards
a photograph rather than pixel art: soft gradients, blurred hair, translucent shadows and fine
scale texture, with no bitmaps. A seed alone gives a completely random butterfly, often in fantasy
colours.

## Features and files

| File | Feature |
| --- | --- |
| `butterfly.ips` | the root: one side drawn twice for symmetry, the body over both, the outputs |
| `wing.ips` | one side: forewing, hindwing, their shadows and the antenna; every style, scheme and motif |
| `body.ips` | thorax, head and abdomen, with the hair blurred in a captured layer |
| `scales.ips` | a 40x40 tile of wing-scale texture exported as a mask (`output mask dark`) |
| `forewing.ips`, `hindwing.ips` | each wing as a program of its own, with a whole fuel budget for detail |

How it is built:

- **Symmetry from one part.** The root draws `wing.ips` with a seed, then the same part with the
  same seed and `mirror_x = 1`, so both sides match to the pixel. The mirrored call passes
  `report = 0`, so the host keeps the right side's outputs.
- **Data between parts through outputs.** The body must match the wings, so the wing part resolves
  its rolled style and colour scheme and reports them as point outputs (`span`, `build`, `shift`,
  `level`, `dusk`, `design`). The root reads them right after the call and passes them to the body.
- **Orthogonal axes.** `style` (13 species looks), `scheme` (14 colour schemes) and `motif`
  (9 abstract overlays) each roll from their own hash of the seed with a `weighted` mix, and each can
  be forced alone.
- **Shape before colour.** The silhouette rolls first, in its own stream; colours and patterns
  follow, so a forced scheme keeps the seed's wings.
- **Textures as masks.** `scales.ips` exports a mask once; the wing tiles it with `mask.offset`
  instead of drawing every scale.
- **Budget.** Detail costs fuel: with Infinite Props 1.0 the single-program butterfly spends about
  2.9 million on average and up to about 3.5 million over seeds 1-200. It was built for the
  5,000,000 a program had before 1.0, where that was up to 71%; of the 25,000,000 of 1.0 it is
  14%. With `which = 1/2` and `detail = 1` each wing becomes a program of its own (about 2 million
  on average, 3.1 million at most), and a host composes them.
- **A cheaper relative (0.9).** The marble and shimmer motifs are pixel loops, too costly to run
  for both sides in the single program under the budget it was built for, so it draws a relative
  instead. Marble used to fall back to ripples; now it is painted as marble from two ridge
  `noise.mask`es with soft edges (`marbleVeins`: warped pale veins and fainter dark ones without
  the costly warp), for under half a million fuel for both sides. Marble forced on every seed
  peaks at about 4.0 million. The wing programs keep the loop; shimmer still falls back to a
  sunburst.

## Inputs

| Input | Values |
| --- | --- |
| `style` | 0 rolls; 1 monarch, 2 swallowtail, 3 morpho, 4 white or sulphur, 5 peacock, 6 admiral, 7 longwing, 8 fritillary, 9 blue, 10 emerald or birdwing, 11 glasswing, 12 satyr, 13 copper |
| `tint` | transparent rolls the wing colour; any other colour sets it |
| `shadow` | 1 casts a soft shadow under the wings, 0 leaves it out |
| `scheme` | 0 rolls; 1 natural, 2 pastel, 3 neon, 4 dark, 5 light, 6 magic, 7 aberrant, 8 gradient, 9 duo, 10 nebula, 11 opal, 12 flame, 13 frost, 14 prism |
| `motif` | 0 rolls; 1 none, 2 ripples, 3 marble, 4 filigree, 5 stardust, 6 orbs, 7 sunburst, 8 shimmer, 9 pearls |

Outputs: `anchor` (the thorax, where the wings meet the body) and `collider` (the bounds of the
wings, body and antennae).

## Checking

From the skill folder; the realistic style skips the pixel-art lint checks that do not apply:

```sh
node scripts/check-asset.mjs examples/butterfly/butterfly.ips --style realistic
node scripts/check-asset.mjs examples/butterfly/forewing.ips --style realistic --allow-edge
node scripts/sheet.mjs examples/butterfly/butterfly.ips --sweep scheme=1,3,6,10 --seeds 1-4
```

The wing programs start at the body axis, so they touch their left edge by design: check them with
`--allow-edge`. Under the 5,000,000 budget of 0.9 the butterfly spent up to about 71% of its fuel
on its heaviest seeds (under 0.8's tariff it was 88%, which the check reported as a warning); the
split wing programs exist for that budget. With the 25,000,000 of 1.0 the check reports 14%.

The butterfly predates materials: its colours are gradient palettes indexed by style. Written today,
a wing look (ground, rim, two accents and hair) could be a material that the scheme overrides.

This generator is sold on [iprop.store](https://iprop.store) as *Butterflies*, where you can also buy
more assets or sell your own.
