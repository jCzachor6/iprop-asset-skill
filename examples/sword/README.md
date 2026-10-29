# Sword

Procedural peasant, soldier and ornate fantasy inventory swords. Two characteristic features,
the blade and the hilt, are parts in two qualities: `blade.ips` and `hilt.ips` for soldier and
ornate swords, `plain-blade.ips` and `plain-hilt.ips` for peasant ones. `materials.ips` holds the
steel, gem and rust the parts share.

The native canvas is **96x96**, transparent, with the tip at the upper left.
The default seed pool selects approximately **55% peasant swords, 25%
soldier swords and 20% ornate swords**. Input `quality` can force any of the
three construction families.

Soldier swords sit between the two. They are well-made arming swords,
sabres and clipped-point falchions of clean forged steel, with a fuller down
two thirds of the blade, and have no rust, gilding, engraving or stones.
Guards are a straight crossbar, a downturned or swept bar, or a knuckle bow
on a sabre. Pommels are a disk, a diamond or an open wheel, fittings are
plain steel or bronze and grips dark leather. Enchanted (`enchant=2`), only a
thin inlay in the fuller lights up; the hilt stays unlit. The seeded glow
strength is subtle or normal, and `glowStrength` can still force any.

Peasant swords use iron ranging from subdued grey to pale silver, a few small
rust patches and shallow edge nicks. Matte faces meet a narrow honed bevel:
a cool dark shoulder leads to a fine bright cutting edge, with a dimmer
opposite bevel. Cached stepper tones follow the contour through curves,
notches and the tip. Four
narrow blade profiles combine with four simple crossbars, three small butt
caps and wood, worn leather or cord grips. They have no
face-wide specular stripe, gilding, engraving, gems or emission. Both enchantments
draw the same peasant sword, and the `magic` colour is ignored.

There are **40 base metal finishes**. Their seeded chances within the
peasant pool are 70% grey iron (16 shades), 29% pale silver (8 shades), and
1% ultra-rare coloured metal (16 shades). Each individual rare colour thus
has approximately a 1-in-1600 chance among peasant swords. A small seeded
tone offset of -3..+3 adds further variation to automatically selected finishes.
Ultra-rare finishes also roll **five matte tones and five cleanliness levels**
independently. Tones shift the base colour by -8, 0, +8, +16 or +24; cleaning
progressively removes clustered rust, oxide flecks and pitting from the blade,
guard and butt cap. Cleanliness levels 4 and 5 have completely rust-free metal.
Each rare base hue supports five tones and five selectable condition levels. These
choices use a separate seeded stream and keep the ultra-rare pool at 1%.

Ornate swords combine six blade profiles with eight guards and six pommels.
The previous 1px-per-side thinning is retained. Blade width
determines the guard proportions, and blade mass weights the fitting choices.
Metal planes, bevels, gilded
roots, chased quillons, wrapped grips, gemstones and fitted runes are drawn
directly on the pixel grid. Render at the native size; use nearest-neighbour
scaling for enlarged inventory icons and inspection.

`sword.ips` rolls the construction and composes `plain-blade.ips` and
`plain-hilt.ips`, or the ornate `blade.ips` and `hilt.ips`.
Construction, material palettes and part ornamentation use separate seeded
streams. Variant, renderPass and colour overrides never change the construction.

Ornate enchantments roll **24 glow colours and four intensity levels** in an
independent stream. The palette spans violet, blue, cyan, green, gold, orange,
red, pink and near-white shades. Intensity is subtle in 20% of rolls, normal
in 55%, strong in 20% and intense in 5%. Stronger levels brighten the stones,
widen the luminous runes and increase the halo's radius and brightness.
Peasant swords remain matte under every glow setting.

## Construction families

Peasant designs:

| Element | Seed-selected designs |
| --- | --- |
| Blade | Plain tapered, short, near-parallel with blunt point, slightly crooked |
| Guard | Straight crossbar, mildly upturned, mildly downturned, short crossbar |
| Pommel | Small block, disk, simple diamond |
| Grip | Wood grain, worn leather wrap, cord wrap |

| Metal finish IDs | Designs | Chance within peasant swords |
| --- | --- | --- |
| `1..16` | Original iron greys, warm/cool steel, ash, nickel and aged silver | 70% collectively |
| `17..24` | Blue, warm, steel, soft, icy, milky, pale and moonlight silver | 29% collectively |
| `25..40` | Obsidian, soot, black blue, dark cherry, clay red, burgundy, copper, forest green, jade, olive, petrol, navy, blue, violet, plum and aged brass | 1% collectively |

Finish IDs `1..4` retain the original four iron colours. `finish=0` rolls
the material independently of geometry; a forced finish disables the small
tone offset. `finish=1..24` gives the exact grey/silver base, while `25..40`
selects the rare hue and still rolls its tone and cleanliness. Set `tone=2`
and `cleanliness=1` to reproduce a rare hue's original worn base finish.
The blade, guard and butt cap share the same metal. All finishes use diffuse
tone planes; pale silver and clean rare colours add no specular stripe or
emission. Grey iron can carry rust; all pale silver finishes (`17..24`) are
rust-free, including their guard and butt cap. `cleanliness=4..5` also removes
all rust from grey and rare metal.

Three independent rust overlays paint compact blotches, narrow streaks and
broken speckles. Among rusty weapons the seed selects one overlay in 75%
of rolls, two in 20% and all three in 5%. The selection is shared by the
blade and fittings and remains stable across enchantments and material changes.
Input `rust` selects 0 seeded, 1 blotches, 2 streaks, 3 speckles, 4 blotches
and streaks, 5 blotches and speckles, 6 streaks and speckles, 7 all three,
or 8 none. Clean metal keeps rust disabled even when an overlay is forced.

Ornate designs:

| Element | Seed-selected designs |
| --- | --- |
| Blade | Tapered, leaf, barbed, flame/wavy, swept sabre, notched clipped point |
| Guard | Swept, forked, downturned, straight, S-shaped, winged, knuckle bow, asymmetric hook |
| Pommel | Diamond, disk, crown, acorn, open wheel, horned clasp |
| Ornament | Runic, heraldic, botanical, demonic |

Each ornament style supplies a distinct root flourish, blade engraving,
quillon detail and grip texture. Heraldic fittings favour pale metal,
botanical fittings use warm browns and green stones, and demonic fittings
use darker iron and burgundy accents. The width of curved/wavy blades is
measured across their own centreline. The `tip` output follows a displaced
sabre or clipped point.

## Interface

| Parameter | Meaning |
| --- | --- |
| `seed` | Construction, materials, engraving and grip detail |
| `quality=0` | Default seeded pool: approximately 55% peasant, 25% soldier, 20% ornate |
| `quality=1` | Force a matte, mildly rusted peasant sword |
| `quality=2` | Force an ornate sword |
| `quality=3` | Force a soldier's sword: clean steel, a fuller and plain fittings |
| `finish=0` | Seeded peasant metal palette with rarity weights and small tone variation |
| `finish=1..24` | Force a grey/silver peasant finish |
| `finish=25..40` | Force an ultra-rare coloured peasant finish; ornate swords ignore this input |
| `cleanliness=0` | Worn grey iron, clean silver, seeded ultra-rare condition |
| `cleanliness=1..5` | Worn through fully clean peasant metal; 4 and 5 are rust-free |
| `rust=0/1..8` | Seeded overlay set / fixed blotches, streaks, speckles, combinations or none |
| `tone=0` | Seeded ultra-rare matte tone; five levels |
| `tone=1..5` | Force dark, base, lighter, pale or very pale rare tone |
| `enchant=0` | Rolls 1 or 2 from the seed |
| `enchant=1` | Ordinary sword; ornate designs have incised runes and unlit stones |
| `enchant=2` | Ornate designs gain luminous runes and stones, soldier swords a lit fuller inlay; peasant swords remain identical |
| `archetype=0` | Sword; this first pack has one archetype |
| `magicPalette=1` | Default: seed selects one of 24 enchantment colours |
| `magicPalette=0` | Use the custom `magic` colour |
| `magicPalette=2..25` | Force palette colour 1..24, in the order shown in `sword-glow-colours.png` |
| `magic=#bd69ff` | Custom enchantment RGB colour when `magicPalette=0` |
| `glowStrength=0` | Default: seeded intensity with 20/55/20/5% chances |
| `glowStrength=1..4` | Force subtle, normal, strong or intense glow |
| `renderPass=0` | Transparent RGBA colour sprite |
| `renderPass=1` | Transparent RGB emission map; empty for `enchant=1` and all peasant swords |

Outputs `tip` and `grip` are points in native canvas coordinates. `grip` is
the middle of the wrapped handle. Both points are identical across enchantments,
layers, magic colours, glow strengths and metal finishes for a given seed and quality.
Cleanliness, rust and tone also leave these points unchanged. Cleanliness and
rust apply to peasant metal; tone overrides apply to ultra-rare finishes.

Output `glow` is a rect used to carry effect data, rather than a bounding box:
`x` is the palette colour ID (0 means custom), `y` the intensity level,
`w` the blur sigma in native pixels and `h` the bloom multiplier. The recipe
is identical across enchantments and layers; unlit swords still have empty
emission maps. Peasant swords output four zeros.

| Intensity | Native blur sigma | Bloom multiplier |
| --- | --- | --- |
| 1: subtle | 1.2 | 0.8 |
| 2: normal | 1.8 | 1.7 |
| 3: strong | 2.8 | 4.5 |
| 4: intense | 3.8 | 9.0 |

## Export

From the skill folder, with the SDK that `node scripts/sdk.mjs` prints:

```sh
SDK=~/.cache/iprop-asset/sdk/0.8.0
mkdir -p out/sword
"$SDK/bin/ipc" examples/sword/sword.ips -o out/sword/sword.iprop
"$SDK/bin/ipval" out/sword/sword.iprop

# Matte peasant sword, with no emitting pixels even with `enchant=2`.
"$SDK/bin/ipgen" out/sword/sword.iprop --seed 7 --uniform enchant=1 \
  --uniform quality=1 -o out/sword/peasant.png

# The same construction in moonlight silver or clean, pale ultra-rare burgundy.
"$SDK/bin/ipgen" out/sword/sword.iprop --seed 7 --uniform enchant=1 \
  --uniform quality=1 --uniform finish=24 -o out/sword/peasant-silver.png
"$SDK/bin/ipgen" out/sword/sword.iprop --seed 7 --uniform enchant=1 \
  --uniform quality=1 --uniform finish=30 --uniform cleanliness=5 --uniform tone=5 \
  -o out/sword/peasant-burgundy.png

# Paired layers: all generation parameters except `renderPass` are identical.
"$SDK/bin/ipgen" out/sword/sword.iprop --seed 7 --uniform enchant=2 \
  --uniform quality=2 --uniform magicPalette=0 --uniform magic=#bd69ff \
  --uniform glowStrength=3 --uniform renderPass=0 -o out/sword/colour.png
"$SDK/bin/ipgen" out/sword/sword.iprop --seed 7 --uniform enchant=2 \
  --uniform quality=2 --uniform magicPalette=0 --uniform magic=#bd69ff \
  --uniform glowStrength=3 --uniform renderPass=1 -o out/sword/emission.png
```

The emission map contains the RGB of the visible glowing rune/gem faces.
Emitting texels have alpha 255; inactive texels are transparent black. A
translucent `magic` input is normalized to opaque material colours. White
steel highlights, gold ornamentation and the non-emitting parts of stones
remain outside the emission map.

The engine can blur `emission.rgb * emission.a` using `glow.w`, multiply by
`glow.h` and screen-blend the result behind the colour sprite. This preserves
the crisp silhouette while adding a soft halo. Apply bloom at native
resolution before nearest-neighbour upscaling, or scale the blur radius with
the sprite. The generated asset supplies the two registered textures and the
recipe; engine integration is a subsequent step.

## Reproducible previews

The twelve comparison seeds are in `seeds.txt`, which the skill tools use by default. From the
skill folder:

```sh
node scripts/check-asset.mjs examples/sword --lint-off alpha   # the enchanted aura is soft on purpose
node scripts/sheet.mjs examples/sword/sword.ips --sweep enchant=1,2
node scripts/sheet.mjs examples/sword/sword.ips --sweep quality=1,2 --uniform enchant=2
node scripts/sheet.mjs examples/sword/sword.ips --uniform enchant=2 --uniform renderPass=1 --bg checker
```

The sword was verified against this contract: repeated renders are identical, enchantments and palettes
keep the geometry and the attachment points, the silhouette keeps a transparent margin and stays
8-connected, emission colours register exactly with the colour pass, and every blade, guard and
pommel fits every other at their largest sizes. Peasant swords and metal finishes keep the
silhouette and the anchors; changing the enchantment or the magic colour of a peasant sword leaves its
pixels identical; rust settings only add rust; glow controls never light peasant or ordinary swords.
Every render stays within the released SDK fuel budget.

This generator is sold on [iprop.store](https://iprop.store) in the *Weapons Pack*, with axes, spears
and mage staves; there you can also buy more assets or sell your own.
