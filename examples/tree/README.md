# Trees

Procedural pixel-art trees, native 128x128 with the ground anchor at
`(64, 124)`, in the small-pixel style of a hand-drawn reference tree. Two
separate assets share the folder and its materials:

- `tree.ips` — a broadleaf tree: a dark trunk of bark strands twisting round
  it, flared into roots at the ground, limbs that wander up and out and thin
  to one-pixel zigzag twigs with a few leaves at their tips, and dense
  clumps of small leaves lit from the upper left.
- `spruce.ips` — a spruce: the same trunk, mostly hidden under tiers of
  needles that hang from it and droop to their tips, lit along their tops
  and dark underneath, with a thin leader at the top and, on some, cones.
- `materials.ips` — the material file both import: `Bark`, `Leaves`,
  `Needles` and `Cone`.

A seed alone grows a different tree every time.

## Tree

| `kind` | Silhouette |
| --- | --- |
| 0 | Rolled from the seed (weighted) |
| 1 | Gnarled: an S-bent trunk forking low into two or three limbs, each ending in one big clump, with bare twigs between them |
| 2 | Broad: a short, thick trunk under many spreading limbs, the clumps heaped into one wide crown |
| 3 | Windswept: a leaning trunk, every limb blown to one side and the clumps flattened in the wind |
| 4 | Slender: a tall, thin trunk with short limbs all the way up and small clumps among leafy twigs |
| 5 | Umbrella: limbs spreading almost flat from the top of the trunk under wide, flat clumps |

Within a silhouette the seed rolls the trunk's height, girth, lean, S-bend,
kinks, swellings, roots and knots, how it forks, the side limbs, where
every limb, branch and twig goes, which of them end in clumps, the small
clumps beside the limbs' joints, the clumps' size and the puffs they are
heaped from. Proportions are drawn with gaussians, so typical trees are
common and extreme ones rare. The silhouette, the colours and the shape roll
from their own hashes of the seed, so forcing `kind` keeps a seed's colours.

`Bark` and `Leaves` derive every tone from their rolled `base`: the outline
and shade darker and cooler, the light warmer, the bark's half-lit `sheen`
between its body and its light. Every colour is drawn from a gradient
(`#a to #b`): the leaves from some summer green between a deep and a fresh
one, or from spring lime, blue-green, olive, autumn (anywhere from gold to
red), copper or blossom (petals from pink to near white on the lit leaves);
the bark from brown, grey, red-brown, pale ash or near black. Each clump
then drifts a little towards a cool blue or a warm yellow and a little
lighter or darker, so a crown is never one flat colour. A transparent `leaf`
rolls the foliage, any other colour sets its base tone.

Outputs: `anchor` is the foot of the trunk, `collider` the trunk's base, and
`crown` one circle per leaf clump.

The tree's shape comes from one stream of its own and is walked five times,
once per pass: the wood's dark outline, its body shifted towards the light,
its bark strands, the leaf clumps and the leaves on bare twigs. Every walk
makes the same draws, so the passes line up, and painting each tone over the
whole tree keeps the joints between limbs clean. The trunk's bend is known
before it is drawn, so its base is placed to keep the crown on the canvas,
and wood that heads off the canvas is turned back over it.

Thick wood is wrapped in two to five strands of bark running round it in a
slow helix. Only the front of each turn shows: lit on the side towards the
light, half lit in the middle, with a dark groove after each strand. The
trunk swells and narrows a little on the way up, kinks by a noise of its
own, carries a knot or two, and flares at the ground into roots that run
along it.

A clump is a big core with a few smaller puffs in front, each painted in
runs row by row. A cellular grain splits a puff into leaves a pixel or two
across and the dark gaps between them; leaves take their tone from the
light on the puff, gaps stay in shade, and only leaves stick out past its
outline.

## Spruce

| `kind` | Silhouette |
| --- | --- |
| 0 | Rolled from the seed (weighted) |
| 1 | Classic: a dense, even cone of tiers down to the ground |
| 2 | Slender: a tall, narrow column of short tiers |
| 3 | Old: a tall trunk bare and twiggy low down, under long, drooping tiers with gaps between them |
| 4 | Wild: a leaning spruce, its tiers reaching much further to one side, ragged and gappy |
| 5 | Young: a short, bushy cone, its tiers close together |

Within a silhouette the seed rolls the height, the width at the bottom tier,
how many tiers there are and how deep and far each one reaches, whether the
branch tips hang or turn up, the lean and the side the spruce reaches
further to, missing tiers, dead twigs on the bare trunk, a broken or split
top, and cones. `Needles` are a dark spruce green, or a fresh green, dark
blue-green or yellow-green, each drawn from a gradient; each
tier drifts a little from the tree's colour. `Cone` is a brown gradient, and
the bark brown, grey-brown or red-brown. A transparent `needles` rolls the
needle colour, any other colour sets its base tone.

Outputs: `anchor` is the foot of the trunk, `collider` the trunk's base, and
`crown` the bounds of the needles.

The spruce is drawn in one walk: the trunk (the tree's bark strands and
roots), dead twigs, then the tiers from the bottom up, so each hangs over
the one below, the cones under them and the top. A tier is painted column
by column in runs: its outline depends only on the column, its top rises a
little by the trunk and falls by its droop towards the tips, and its lower
edge hangs in a ragged fringe. The top is lit, most at its upper left, the
underside is in deep shade, and a streaky grain runs down and out along the
needles. The branch wood under each tier shows where the needles hang thin.

## Building

The trees use materials, so they need Infinite Props 0.8.0 or newer. From the skill folder:

```sh
node scripts/check-asset.mjs examples/tree
node scripts/sheet.mjs examples/tree/tree.ips --seeds 1-25
node scripts/sheet.mjs examples/tree/spruce.ips --sweep kind=1,2,3 --seeds 1-8
```

Fuel stays under 4,000,000. Over seeds 0-1999 the heaviest broadleaf tree
takes 3,674,631 (seed 803), the 99th percentile about 2.9 million and the
median about 1.25 million; over seeds 0-299 the heaviest spruce takes
625,803 (seed 118) and the median about 400,000. No tree or spruce among
the first 300 seeds reaches the left, right or top edge of the canvas.
