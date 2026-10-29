# Quality: pixel art and the realistic direction

Judge the pixels, not the code. These rules come from the house style of the language and from
the fixes that made the model assets look right (four readable tones, a silhouette outline, no
single-pixel noise, clean bands instead of dithering, masses instead of combs, light from the upper
left). Each says why, so you can tell when an asset has a reason to break it.

## Pixel art

**Tones.** Paint each material in 4 or 5 tones: deep shadow, shadow, base, light and one
highlight, `tones = stepper(dark to light).pick(5)`, built once before painting. Lean shadows cool
(mix towards a blue or violet) and lights warm (towards a yellow): flat value steps look grey and
dead. Paint broad areas of each tone; a smooth gradient of many tones reads as blur at pixel size.

**Light.** One light, from the upper left, for every prop of a game: top and left faces lighter,
bottom and right darker, a highlight near the upper-left edge, at most a faint bounce light on the
shadow side. Mixed light directions make a scene look pasted together.

**Edge.** The silhouette needs a readable edge: a one-pixel outline darker than the inside, derived
from the material (`color.mix(base, #0c1018, 0.75)`) rather than pure black, or a rim light on the
lit side. A captured shape gets its outline from its own mask:
`surface.paint(mask.expand(mask.from(body), 1), edge, blend = surface.source_over)` before
painting the body. Without an edge, a prop disappears on a background of similar value.

**Silhouette.** Break perfect shapes: lobes along an edge, jittered angles and sizes. Perfect
circles read as bubbles. Build readable masses; a row of one-pixel spikes (hair, grass, a mohawk)
reads as a comb. Keep one-pixel strands for what really is thin (twigs, antennae, strings), sparse.

**Texture.** Build texture from small marks in the ramp: one- or two-pixel leaves, chips, grain
lines, rivets. Per-pixel random colours read as static. Do not dither in checkerboards; use clean
bands of tones.

**Crisp pixels.** Single pixels go to integer positions; turns are 90° only (`rot`, `mirror_x`);
no anti-aliased edges. Alpha is 0 or 255, except deliberate translucency (glass, a ground shadow)
in one uniform alpha, painted with source-over.

**Wear.** In layers: rub patches off with a mask, then add grit or rust in clusters to what is
left. Restrained: most seeds a little, a few a lot (`beta` leaning low).

**Variety.** Distinct silhouettes across seeds, not just recolours; typical proportions common and
extremes rare (gaussian); rare looks rare (`weighted`, 1 seed in 16 or in 100); colour families as
gradients with a shade drawn inside each.

**Fit.** Details fit inside their feature (a label on the glass, a gem in its socket): let the part
that owns the space report where they fit. Nothing touches the canvas edge unless it stands on the
ground there; leave room for the outline, glows and blur. Props of one game share one pixel scale.

**Real size.** Details under two pixels vanish at 1x. Look at the `--real-size` strip and at the
prop on the game's background.

## The realistic direction

The butterfly paints towards a photograph: many colours, soft gradients, blurred hair, translucent
shadows. The rules that still hold: one light direction, a readable silhouette, variety across
seeds, rare looks rare, details fitted to their features, the fuel budget. Capture soft work in
layers with `alpha = surface.source_over`, soften with `.blur(sigma)`, paint with
`blend = surface.source_over`. Check it with `check-asset.mjs <folder> --style realistic`, which
keeps only the lint checks that apply.

## The lint

`check-asset` measures the seeds of the sheet and warns when a fifth of them (at least two) pass a
limit, or one passes it far. It is advice: look at the seed it names before changing anything, and
silence a check that contradicts a deliberate style with `--lint-off code,code`.

| Code | Measures | Warns when | Usual fix | Fine to silence when |
| --- | --- | --- | --- | --- |
| `noise` | interior pixels unlike all eight neighbours | over 12% | marks in the ramp instead of per-pixel colours | never in pixel art |
| `dither` | 3x3 blocks alternating two colours | over 1% | clean bands of tones | a deliberate retro pattern |
| `spurs` | pixels one pixel thin across | over 12% | thicker masses, fewer strands | the object is made of strands (grass, a net) |
| `palette` | pixels whose colour appears at most twice | over 12% | a tone ramp (`stepper`) instead of smooth gradients | realistic style (off there) |
| `alpha` | outer pixels fading in an alpha gradient | over 25% | hard edges; uniform alpha for translucency | glows and auras (the sword's enchantment) |
| `outline` | edge pixels contrasting with the tone inside | under 35% | an outline or a rim light | the prop always sits on a contrasting background |
| `light` | where the bright pixels sit in the shape | bright side lower right | light from the upper left | a lit-from-below effect (fire, lava) |
| `canvas` | the drawing's bounding box on the canvas | under 8% | a smaller canvas or a larger drawing | — |

`--style realistic` keeps `light` and `canvas` only.
