# Variety: how different the seeds are

The user picks how far one seed may stray from the next: **low**, **medium**, **high** or
**extreme** (medium when nobody says). Variety is added only after the prop looks right, because
every family, colour and detail multiplies the looks that must also look right. Build at low,
polish, then climb the ladder to the level asked for, one axis at a time.

## The levels

| Level | Seeds look like | Typical use | Groups for 90% of seeds, per axis |
| --- | --- | --- | --- |
| low | the same object made by one hand: proportions, shade and wear drift a little | tiles, a row of matching crates, a prop that must stay recognisable | up to 3 |
| medium | different items of one kind | most props: barrels, lamps, chairs | 4-7 |
| high | a shop shelf of them: every feature varies, materials and decorations change | loot, weapons, potions, trees in a forest | 8-19 |
| extreme | every seed a surprise, still clearly the same kind of thing | collectables, rare drops, a showcase of the generator | 20 or more |

`check-asset` measures two axes over 200 seeds: silhouette groups (seeds whose shapes overlap by
80% or more share a group) and colour schemes (seeds whose colours share 70% or more). Each axis
gets the level of the number of groups that hold 90% of the seeds; the prop's level is the mean of
the two, rounded up. Measured this way, the scaffolds and the crate snippet are medium, the shield
and the sword are high, the potion, the tree and the butterfly are extreme,
and the spruce is high: extreme in silhouettes, medium in colours.

## What each level adds

Each level keeps everything below it. The examples are for a shield and a potion.

**low: the base, polished**
- one shape family per feature; proportions from a narrow distribution
  (`gaussian(mean = 0.5, sigma = 0.1)`), so a seed is never extreme;
- one material per feature, its `base` drawn from one short gradient (one hue, a few shades);
- wear, grain and small marks that differ per seed; at most one optional detail.

**medium**
- the main feature in 2-4 shape families, weighted so the classic one is common
  (`const distribution kinds = weighted {1: 50, 2: 30, 3: 20}`): a round, heater or kite shield;
- the usual proportion spread (`sigma = 0.18`);
- 3-5 colour families per material as a gradient palette (`palette woods = [#5a4230 to #7a5c40, ...]`)
  picked with `weighted`;
- 2-3 optional details with `chance(p)`: a boss ornament, a painted rim, a label on the bottle.

**high**
- every characteristic feature has its own families (3-6 each), so they combine: rim styles x
  boss styles x body shapes;
- a feature changes material, not only colour: a wooden or a metal body, a cork or a wax seal;
- 6-10 colour families including rare ones (weights of 2-5), accent colours in their own stream;
- counts that vary (rivets 4-8, planks 3-6, bubbles 1-3);
- decorations with families of their own: emblems, patterns, runes, labels;
- rarity tiers: common, ornate, rare finishes (the sword's `tiers`, `finishFamilies`).

**extreme**
- structure varies: features appear or not, double, swap places (two gems, a broken top, a cracked
  half);
- sub-families inside families (a heater shield with a flat or a curved top);
- colour schemes beyond the material: painted divisions, two-tone patterns, gradients across the
  prop, glows and enchantments in their own layer;
- very rare looks (weights of 1 in 100 or less) with something special: a golden finish, an aura;
- many decorations combined, each with its own families and colours.

Variety never means noise: a random pixel here and there is not a new look. Add a family only when
it reads as different at the game's size (look at the real-size strip), and give it the same care as
the base.

## The variety pass

1. **The base must be good first.** At low variety (one family, typical proportions, the main
   material) the prop passes `check-asset` without errors, the lint is clean or every warning is a
   deliberate style, and the sheet and the real-size strip look like the finished object: tones,
   light, outline, proportions (`references/review.md`). Do not add variety to a prop that does not
   yet look right; fix the base.
2. **Plan the axes for the level.** Per characteristic feature, list what the level adds (the
   section above): families, materials, colour families, counts, details, rare looks. Write it into
   the header comment next to the `Variety:` line.
3. **Add one axis at a time.** A new family is a branch plus a weight at the end of the
   distribution; a colour family is a palette entry; a detail is a `chance` and a helper; a new
   feature is a part with a key of its own. Each draws in the stream of its concern
   (`references/features.md`), so the seeds the user has seen keep their other looks.
4. **Look at each addition.** Sweep the new axis (`sheet.mjs <entry> --sweep kind=1,2,3,4`) and the
   colours (`--sweep tint=...` or a palette input), then the sheet of seeds 1-24. Every family
   must look as finished as the base; a family that does not is fixed or removed, not left rare.
5. **Measure.** `check-asset` reads the `Variety:` line of the header (or `--variety high`) and
   reports the level it measures over 200 seeds, per axis and in all. It warns when the measure
   falls short of the target, naming the poorer axis, or when it overshoots by two levels. The
   measure is a guide, not the judge: the spruce is high through its silhouettes while its greens
   stay close, which is right for a spruce, and details inside the silhouette (an emblem, runes)
   barely move either count. When the measure and the sheet disagree, trust the sheet and say why
   in the README.
6. **Keep rare looks rare.** After the pass, the most common look still deserves the most care:
   most players see the classic shield, not the legendary one.

## Asking for the level

Ask the user before designing (SKILL.md, "Ask first"). Describe the levels in the user's terms,
for this object:

- low: "every shield is the same round wooden shield; only the shade, the wear and the proportions
  change a little";
- medium: "round, heater or kite, a few wood and paint colours, sometimes an emblem";
- high: "every part varies: shape, rim, boss, wood or metal, many paint schemes, emblems, rare
  finishes";
- extreme: "no two alike: split and quartered paint, broken rims, glowing runes, very rare
  legendary looks".
