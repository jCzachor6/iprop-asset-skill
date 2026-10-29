# The feature method

Finished assets run to thousands of lines (the tree is 1,100, the sword 1,200, the butterfly 2,300).
They stay readable and keep growing because they are split along what makes the object
recognisable. Plan that split before writing code.

## 1. Name the characteristic features

List the parts a person would name when describing the object, and what makes each one vary:

| Object | Features |
| --- | --- |
| sword | blade (profile, length, width, bend, fuller, runes), guard, grip, pommel |
| potion | vessel (silhouette family, proportions, liquid level), neck, stopper, seal, label |
| tree | trunk (height, girth, lean, roots), limbs and twigs, leaf clumps, bark |
| butterfly | forewing, hindwing, body, antennae, wing pattern |

A feature becomes a **part** (its own `.ips` file) when it has its own shape families, is placed by
a mount point, is reused (twice, mirrored, or by several assets), or needs its own fuel budget.
Small details (a rivet, a label, a glint) stay **helpers** in the file that draws them.

## 2. One part per feature

A part is an ordinary asset that another file imports:

```ips
import blade from "blade.ips"
import hilt from "hilt.ips"
...
  const i32 bladeKey = 0x85ebca6b
  const i32 hiltKey = 0xc2b2ae35
...
    blade.draw(hash(start ^ bladeKey), at = {0, 0}, length = bladeLength, metal = metal)
    hilt.draw(hash(start ^ hiltKey), at = {0, 0}, reach = guardReach, metal = metal)
```

- **Seeds.** Give each feature a key of its own (`const i32 bladeKey = ...`) and seed its part
  with `hash(start ^ bladeKey)`. A part draws from an isolated stream, so its rolls never move the
  root's or another part's. Never reuse a stream's key for a part: the part would replay that
  stream's numbers (section 5).
- **Placement.** `at` puts the part's `origin` at a point of the caller. The models use two
  conventions. Potion and sword parts paint absolute canvas coordinates (`origin 0, 0`,
  `at = {0, 0}`), with the root passing every coordinate: simple when the root owns the geometry.
  The composed template and the SDK's `colony/` give each part a local origin (its bottom centre,
  its joint) and place it with `at = mount`, so the part fits anywhere.
- **Mount points.** A part reports where the next feature attaches, such as `output point top` or
  the vessel's `charm`. The caller reads `part.outputs.top` right after the call; the value is
  already in the caller's coordinates, transforms included.
- **Symmetry.** Draw one side and call the same part again with the same seed and `mirror_x = 1`
  (the butterfly's wings match to the pixel). `rot` takes 0, 90, 180 or 270; transforms are exact
  pixel permutations, not filtered rotations.
- **Inputs and outputs.** Parts declare the inputs the root passes (named only, defaults for the
  rest). Mount points between parts are part outputs the root reads; the game sees every output,
  including the parts', so the root declares only the ones the user asked for (none by default) and
  documents them.
- Parts may import parts (the SDK's `colony/`: colony, mushroom, then cap and stem), up to 256
  instances in all.

## 3. Axes of variation

Give every feature a few independent axes and decide how each is rolled:

- **Shape families**: a few distinct silhouettes, chosen with weights so the classic one is common
  and odd ones rare: `const distribution kinds = weighted {1: 30, 2: 20, 3: 18, 4: 14, 5: 18}`
  (the tree's gnarled, broad, windswept, slender and umbrella). Each family is a branch that sets
  the proportions.
- **Proportions**: one shared description, `const distribution typical = gaussian(mean = 0.5,
  sigma = 0.18)`, used as `lerp(lo, hi, 0.0 to 1.0 with typical)` for every size of the object.
- **Details**: `chance(p)` for optional pieces, `2 to 4` for counts, `pick(...)` among a few values.
- **Wear**: in layers: rub patches off with a mask, then add grit to what is left.

How many families, colours and details each feature gets follows the variety level the user chose
(`references/variety.md`): build the base at low, polish it, then add axes up to the level.

Make an axis an input only when the game needs to force it, default it to 0 = rolls, and comment
it: `input u32 kind = 0 // 0 rolls; 1 gnarled, 2 broad, 3 windswept`. Axes stay orthogonal: the
butterfly's `style`, `scheme` and `motif` each roll from their own hash, so forcing one keeps the
others. `check-asset` verifies that a rolled value renders exactly like one forced value.

## 4. Colours and materials

A **material** is a named look with all its tones, declared once in a file with no asset and used
by every file that imports it (0.8):

```ips
// materials.ips
material Leaves {
  base = #3c6632 to #7aa04a with gaussian(mean = 0.5, sigma = 0.25)
  deep = color.mix(color.scale(base, 0.6), #3a3a30, 0.35)   // the dark inside of a clump
  light = color.mix(color.scale(base, 1.2), #e8e070, 0.06)  // leaves in the light, warmer
}
```

```ips
import wood from "materials.ips"
...
    leaves = wood.Leaves()                  // rolls base once; deep and light follow it
    autumn = wood.Leaves(base = hue)        // an override; later fields read it
    clump(x, y, leaves)
...
  clump(x: f32, y: f32, m: wood.Leaves) { oval(x, y, 6, 4, m.deep) ... }
```

- Every tone follows the rolled `base`, so a recoloured instance keeps its shading. Shadows lean
  cool, lights warm.
- Use a material for a look with several related tones that more than one place draws (cork,
  pewter, bark, gem, rust). Use a palette for a set to choose from: `palette barks = [#45403e to
  #6c6660, #5a3226 to #7e4e38]`. An entry of a gradient palette is a description: draw a colour
  from it with `barks[i].pick()`. A palette of plain colours is indexed directly: `hues[index(3)]`.
- Choose a colour family first (weighted), then a shade inside its gradient:
  `hue = foliage[0 to 4 with families].pick()`, then `wood.Leaves(base = hue)`.
- Parts take colours, not materials: the root passes `leaf = leaves.base`; the part builds
  `m = foliage.Leaf(base = leaf)` from the same library (see the potion's cork and seal).
- Colours that follow one rolled colour (the potion's glass from its liquid) are derived with
  `color.hsv`, `color.mix` and `color.shade` rather than rolled again.

## 5. Streams: growing an asset without breaking it

The layout every model uses:

```ips
  // Stream keys, one per purpose. Keep them fixed once a game stores seeds.
  const i32 kindKey = 0x2f6b9a13
  const i32 shapeKey = 0x51ed2701
  const i32 colorKey = 0x6c656166     // "leaf" in ASCII
...
  draw {
    start = seed                      // the game's seed, before any draw moves it
    look = clamp(kind, 0, 5)
    if (look == 0) { look = rolledKind(start) }   // hashed, so rolled == forced
    stream_push(hash(start ^ shapeKey))           // the shape: every roll, whatever the family
    size = 0.0 to 1.0 with typical
    lean = -2.0 to 2.0 with gaussian(mean = 0.0, sigma = 0.8)
    stream_pop()
    stream_push(hash(start ^ colorKey))           // the colours: materials and families
    bark = wood.Bark()
    stream_pop()
...
  // The kind a seed rolls: weighted, in a stream of its own.
  rolledKind(start: i32) -> i32 {
    stream_push(hash(start ^ kindKey))
    look = 1 to 5 with kinds
    stream_pop()
    return look
  }
```

A single value needs no stream of its own: `roll(hash(start ^ phaseKey), 0.0, 3.0)` draws a
uniform number and `choose(hash(start ^ guardKey), 0, 1, 1, 2)` one of its values (repeat one to
weight it), each from an isolated stream. A weighted roll goes into a small helper like
`rolledKind`; a group of values shares one `stream_push`/`stream_pop`.

Why `hash(start ^ shapeKey)` and not just `seed`: `seed` reads the current state of the stream; XOR
with a key labels a purpose (the shape, the colours, the third part); `hash` (splitmix32) mixes the
bits so the derived seed shares nothing with the seed or with other purposes. A key can be any fixed
32-bit value, but it must differ per purpose (two streams with one key draw the same numbers, which
the butterfly uses on purpose for its mirrored wings; the potion's vessel once shared its key with
the silhouette stream, which tied its bubbles to the silhouette family), must never change once a
game stores seeds, and should look random: with small keys, `seed ^ 1` of seed 3 equals `seed ^ 2`
of seed 0, so nearby seeds would share streams. Large keys (the models borrow them from known
hashes: `0x9e3779b9` the golden ratio, `0x85ebca6b` and `0xc2b2ae35` from MurmurHash3, `0x27d4eb2f`
and `0x165667b1` from xxHash, the SHA-256 initial values) push such collisions to seeds no game
uses. The compiler folds the named constants, so naming a key changes no pixel. Save
`start = seed` on the first line of `draw`: every draw in the main stream changes `seed`, so a part
seeded from `seed` after other draws would change whenever a draw is added before it.

Because each concern rolls in its own stream and every roll is made unconditionally:

- **a new shape family** is a new branch plus a weight; other seeds keep their rolls (changing the
  weights remaps some seeds, so add new families at the end with small weights);
- **a new colour family or material** is a palette entry or a material; shapes stay put;
- **a new feature** is a new part file, a new key and one call; nothing else moves;
- **forcing an input** never shifts the rolls that follow it.

Keep the numbers of families, styles and finishes stable once a game uses them: a save file stores
the seed and the inputs, not the picture. After a restructuring, run
`check-asset.mjs <folder> --baseline <old.iprop>` to prove the pixels did not move.

## 6. Budget

Every instruction spends fuel from 5,000,000 per generation; parts spend from the same budget.
Paint rows, not pixels; draw a texture once as a layer or a mask and reuse it (the butterfly tiles
its scale mask with `mask.offset`); when one feature needs a whole budget for detail, make it a
program of its own that the game composes (the butterfly's `forewing.ips` and `hindwing.ips`). The
check reports the heaviest seeds; look at them, they are usually the most complex looks.

## 7. Write it down

The root opens with a comment that says what a seed rolls, the variety level (`// Variety: high`),
what every input does (`0 rolls; 1 ...`) and what every output means, and each part says which
feature it draws. The asset folder carries a README with the same, the canvas and origin, and the
peak fuel the check reported.
