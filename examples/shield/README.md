# Shield

Procedural shields for a top-down roguelike, to hold and to pick up. Native **48x48**, seen
face-on (the way top-down and three-quarter games show held items and pickups), lit from the upper
left, symmetric about `x = 24`. Every shield is laid out around the canvas centre, the declared
origin `(24, 24)`, which engines that read the origin (the Unity sprite helper) use as the pivot.
A seed alone gives a different shield. Variety: high.

An agent wrote this asset with the skill from a single prompt (a 48x48 shield for a top-down
roguelike, from an earlier test of the skill); only its stream keys were named afterwards, which
changed no pixel.

## Features and files

| File | Feature |
| --- | --- |
| `shield.ips` | the root: rolls the design, places the parts, paints the emblem in four passes, reports the outputs |
| `parts/board.ips` | the body: silhouette (eight families), wooden planks or metal plate, field paint and its chips, the rim and its studs; exports the face masks the emblem is clipped to and the boss's place |
| `parts/boss.ips` | the boss in the middle: dome, flanged dome, spike, square or diamond plate, studded dome; exports its footprint for its shadow |
| `parts/emblem.ips` | a painted heraldic emblem in one colour, called once per paint tone with the same seed |
| `materials.ips` | `Wood`, `Metal`, `Hide` (rawhide rim) and `Paint`, each five tones from `deep` to `shine` plus an `edge` |

What a seed rolls, each concern in a stream of its own (forcing one input never moves the others):

| Axis | Values and odds |
| --- | --- |
| shape | round 22%, heater 22%, kite 14%, buckler 12%, oval 10%, tower 10%, hex 7%, waisted 3% |
| proportions | width, height and the family's profile (shoulder, taper, corner, waist), gaussian around the typical shield |
| body | wood (five wood families, oak most common) or metal plate (iron, dark iron, bronze, brass, copper, silver, gold; gold rarest); a third metal, bucklers 3 in 4, towers 1 in 7 |
| rim | 2 px (3 px on some big shields): a metal band, rawhide (wood only) or the plate's rolled edge; studs on 45% of metal rims |
| boss | dome 36%, flanged 24%, plate 16%, spike 12%, studded 12%; sized to the face's width at its row |
| paint | a field on 35% of wooden boards and 8% of metal plates; an emblem on half of the shields; bucklers stay bare |
| emblem | cross, saltire, chevron, per pale, quarterly, bend, fess, ring, gyronny, sun rays, lozenge, chief, pale, in the rule of tincture (a colour on a metal, a metal on a colour) |
| wear | chips in the paint showing the wood or metal beneath, mostly near the rim; few on most shields |

## Inputs

| Input | Values |
| --- | --- |
| `shape` | 0 rolls; 1 round, 2 heater, 3 kite, 4 buckler, 5 oval, 6 tower, 7 hex, 8 waisted |
| `body` | 0 rolls; 1 wooden, 2 metal |
| `emblem` | 0 rolls; 1 none, 2 cross, 3 saltire, 4 chevron, 5 per pale, 6 quarterly, 7 bend, 8 fess, 9 ring, 10 gyronny, 11 sun rays, 12 lozenge, 13 chief, 14 pale |
| `paint` | transparent rolls the paint; any other colour paints the field, or the emblem on a bare face (team colours) |

A rolled value renders exactly like the same value forced. A forced colour keeps the silhouette and
the outputs; the emblem then takes a tincture that stands out on it. Where a ring has no room
between the boss and the rim, the shield gets a cross instead.

## Outputs

All in canvas pixels, y down; convert with the game's pixel scale.

- `anchor` (point): the foot of the shield on its centre line, the bottom of the outline. Where a
  dropped shield rests on the ground; y-sort by it.
- `grip` (point): where the hand holds it, behind the boss. Put this point on the character's hand.
- `collider` (rect): the shield's bounds, rim and outline included.

The parts also report `boss`, `room`, `foot` and `bounds`; they are internal and the game can ignore
them.

## Using it

Generate when a shield spawns, not every frame, and cache by (seed, inputs). Store the seed and the
inputs in saves, not the picture. Render at 48x48 and scale with nearest neighbour.

`node scripts/check-asset.mjs examples/shield --emit` (from the skill folder) writes
`examples/shield/shield.iprop`, the compiled asset for the game.

```sh
SDK=~/.cache/iprop-asset/sdk/0.8.0
"$SDK/bin/ipgen" examples/shield/shield.iprop --seed 7 -o shield-7.png          # JSON with the outputs on stdout
"$SDK/bin/ipgen" examples/shield/shield.iprop --seed 7 --uniform paint=#2e6db0 -o blue-team.png
"$SDK/bin/ipsheet" examples/shield/shield.iprop --seed 1 --seeds 16 --columns 8 -o atlas.png
```

## Checking

From the skill folder:

```sh
node scripts/check-asset.mjs examples/shield --scan 1000
node scripts/sheet.mjs examples/shield/shield.ips --sweep shape=1,2,3,4,5,6,7,8 --seeds 1-6 --outputs
node scripts/sheet.mjs examples/shield/shield.ips --sweep emblem=2,3,4,5,6,7,8 --seeds 2,5,7,13,14,15
node scripts/sheet.mjs examples/shield/shield.ips --sweep body=1,2 --seeds 1,2,5,7,9,13,16
node scripts/sheet.mjs examples/shield/shield.ips --sweep paint=#b03a2e,#2e6db0,#d8c040 --seeds 2,5,13,37,41,56
```

Seeds 1-1000 all render, all differ; fuel mean about 243,000, peak 417,272 (8% of 5,000,000) at
seed 117, a kite whose emblem takes four passes. `seeds.txt` holds the seeds to compare across
revisions: one of every family and emblem design, the heaviest ones and those that once looked
wrong.
