# Potion

Procedural RPG potions, native 64x64, standing on `(32, bottom of the vessel)`. A seed alone gives a
completely random potion.

This generator is sold on [iprop.store](https://iprop.store) as *Potions*, where you can also buy
more assets or sell your own.

## Features and files

| File | Feature |
| --- | --- |
| `potion.ips` | the root: rolls the design, places the parts, draws the glass decoration, reports the outputs |
| `vessel.ips` | the glass body and its liquid, in one of seventeen silhouette families |
| `neck.ips` | the neck and its lip, in seven styles |
| `cork.ips` | the stopper: cork, wax seal, metal cap, gem, cloth-wrapped, flat, crown cap or big cork |
| `seal.ips` | a short neck binding with a wax, paper or brass apothecary seal |
| `materials.ips` | cork, pewter, slate, cloth, wax, paper, brass, twine, parchment, gold and etching |

The root rolls the silhouette family and its proportions in one stream, the neck and the stopper in
another and the decoration materials in a third, so adding a family or a material never moves the
others. Every stream and every part has its own named key (`silhouetteKey`, `vesselKey`, ...). The
vessel and the neck once drew from the silhouette's and the neck's keys, which tied their bubbles,
drops and pewter to the family and the neck style; with keys of their own those details differ from
the original `props` potion for the same seed, while the silhouettes, liquids and stoppers stay
the same. Glass and liquid are plain colours: the liquid comes from a palette of twelve elixir
gradients and the glass tint follows it through `color.hsv` (analog, complementary or the same
hue). The parts receive colours and build the materials they need from the shared library.

The vessel fits the decoration inside the glass and the seal against the shoulder, and reports both
through its outputs (`label`, `labelfit`, `charm`); the root reads them right after the call.

**Crackled glass (0.9).** About one potion in seven has old, crackled glass: 6% of plain ones, 12%
of ornate ones and 22% of arcane flasks. The fissures are the seams between warped Worley cells, one
`noise.mask` (`noise.mode_cell_edge` below a small threshold, crisp), painted pale at one alpha
inside the vessel's interior mask and under the decoration. Whether a potion is crackled is a
hashed roll with a key of its own (`crackleKey`) and the mask takes its own explicit seed
(`fissureKey`), so every other potion keeps the pixels it had.

## Inputs

| Input | Values |
| --- | --- |
| `fill` | 0 rolls; 1 nearly full .. 5 nearly empty |
| `style` | 0 rolls; 1 ornate, 2 plain, 3 arcane |
| `liquid` | transparent rolls the liquid colour; any other colour sets it |
| `seal` | 0 follows the style; 1 wax, 2 folded paper, 3 brass, 4 none |

A rolled `fill` or `style` renders exactly like the same value forced, because both are chosen by
hashing the seed.

## Outputs

- `anchor`: the foot of the vessel, where it stands.
- `collider`: the bounds of the glass, the neck and the stopper.
- `label`, `labelfit`, `charm` come from the vessel part; the host sees them too.

## Checking

From the skill folder:

```sh
node scripts/check-asset.mjs examples/potion
node scripts/sheet.mjs examples/potion/potion.ips --sweep style=1,2,3 --seeds 1-8
node scripts/sheet.mjs examples/potion/potion.ips --sweep fill=1,3,5 --seeds 1-8 --outputs
```

With Infinite Props 0.9, fuel stays near 335,000 on average and under 530,000 over seeds 1-200 (the
crackle's noise mask over the 64x64 canvas adds about 52,000 where it appears; 0.8's older tariff
gave about 370,000 and 520,000). The
vessel fills its body pixel by pixel from a signed distance, because every pixel's tone depends on
where it sits in the glass; everything else is drawn as rows, lines and shapes.
