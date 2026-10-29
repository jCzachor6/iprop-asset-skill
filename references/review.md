# Reviewing an asset

An asset is done when many seeds look good, not when it compiles. Review after every change.

## The loop

1. `node <skill>/scripts/check-asset.mjs <asset-folder>`. Fix errors first: compile errors, traps,
   empty seeds, identical seeds, renders that differ when repeated. They make the asset unusable.
2. Read `out/<asset>/sheet.png`: 24 seeds (or the ones in `seeds.txt`) side by side, zoomed. Look
   at the whole sheet first (variety, rhythm, what repeats), then at single seeds.
3. Sweep every axis: `node <skill>/scripts/sheet.mjs <entry.ips> --sweep kind=1,2,3,4 --seeds 1-8`.
   Each row forces one value. Every row should read as its family; for a colour axis
   (`--sweep tint=#b03a2e,#2e6db0,#d8c040`) a column should keep one silhouette.
4. Look at the extremes: the heaviest seeds the check names (`--seeds 57,113,9`) and the families
   that are rare by weight (force them).
5. Look at the outputs, if the asset has any: `--outputs` draws colliders (magenta), circles (cyan)
   and points (yellow). A collider should wrap the solid part, the anchor sit on the ground, mount
   points where things attach.
6. Look in context: `--bg light`, `--bg checker`, or the game's background colour (`--bg #2a3a2a`);
   `--real-size` adds the seeds at 1x.
7. Compare: `sheet-previous.png` keeps the previous run. Keep `seeds.txt` with seeds that once looked
   wrong. When a change must not move pixels (moving a feature into a part, introducing a
   material), run `check-asset.mjs <folder> --baseline <old.iprop>`.

Change one thing at a time and look again: several changes at once hide which one helped.

## When the base is good enough for variety

Variety comes after quality (`references/variety.md`). Before adding families and colours, the
base, at low variety, must pass all of these:

- `check-asset` has no errors; every lint warning left is a deliberate style;
- at 1x (`--real-size`) every seed reads as the object at a glance, on the game's background;
- the main material has its 4-5 tones, the light comes from the upper left, the edge reads;
- the proportions look like the object, not like a placeholder: compare with a reference;
- nothing is left of the scaffold: no placeholder shapes, colours or comments.

Then add variety one axis at a time, and after the pass review the sheet again: every family, rare
ones included, must meet the same bar.

## What to look for

- Every seed reads as the object at 1x, and seeds differ in silhouette, not only in colour.
- Most seeds look typical, extremes are rare, rare families are rare.
- No broken seed: detached or floating parts, overlaps through each other, holes, clipped edges,
  decorations hanging outside their feature.
- Each material reads as itself (wood, metal, glass) in 4 or 5 tones, lit from the upper left,
  shadows cool and lights warm.
- A readable edge everywhere; no single-pixel noise, checkerboards, combs or stray pixels.
- Colours belong together; no garish combination comes up in 24 seeds.
- Every forced input value is distinct and correct; a rolled value equals one forced value.
- Outputs are where the game expects them.

## What check-asset reports

| Check | Means | Usual fix |
| --- | --- | --- |
| `compile` | diagnostics of every entry and unused library | the code and message; `references/language.md` |
| `ipval` | the compiled binary failed validation | rare; recompile with the same SDK, report it |
| `traps` | seeds that stop with a run-time error | the trap table in `references/language.md` |
| `empty` | seeds that draw nothing | a family or branch that never paints; a translucent paint on the legacy root |
| `variety` | distinct images and silhouettes among the scanned seeds | roll the shape, not only colours; check streams |
| `level` | the variety level measured over the scan (silhouette groups and colour schemes for 90% of seeds) against the `// Variety:` line or `--variety` | below: add families on the poorer axis; two above: narrow them (`references/variety.md`) |
| `fuel` | mean, peak and heaviest seeds; warns above 80% of the budget | rows instead of pixels, reuse layers, split features |
| `outputs` | outputs the entry declares: unset, not finite or off the canvas; none is fine | set every output on every path; check coordinates |
| `edge` | seeds touching the canvas edge (the bottom is fine when the origin stands there) | smaller proportions, a margin, a larger canvas |
| `determinism` | the same seed renders twice the same | do not depend on anything but the seed and inputs |
| `input <name>` | an input documented as "0 rolls" or "transparent rolls" | hash the seed for the roll; make every roll unconditionally; roll colours after the shape |
| `baseline` | seeds whose pixels or outputs changed since the last run or `--baseline` | expected after a visual change; a bug after a pure refactor |
| lint codes | measurable pixel-art problems | `references/pixel-art.md` |

`report.json` in the output folder holds everything for scripts; `--json` prints it.
