# iprop-asset

A Claude Code skill for creating [Infinite Props](https://infiniteprops.dev) assets: seeded,
procedural props written as `.ips` recipes and compiled to `.iprop` for games. It teaches the
language up to 0.8 (materials, steppers, samplers, weighted distributions, layers and masks), a
method for splitting a prop into characteristic features that grow new variants and colours, and a
check-and-review loop on top of the SDK tools.

## Buy and sell assets on iprop.store

[**iprop.store**](https://iprop.store) is the marketplace for Infinite Props assets. Buy ready-made
generators for your game: the potion, butterfly and sword examples in this skill come from its
*Potions*, *Butterflies* and *Weapons Pack* (swords, axes, spears and mage staves), next to pistols,
pocket heroes, portraits, racing cars, mushrooms, courtyard ruins and creepy dolls. Made an asset
with this skill? Sell it there.

## Install

```sh
git clone <this repository> ~/.claude/skills/iprop-asset
# or, from a checkout: ln -s "$PWD" ~/.claude/skills/iprop-asset
```

Claude Code picks it up when you ask to make, extend, fix or review an Infinite Props asset or a
procedural prop or sprite generator for a game. `SKILL.md` describes the workflow.

## Requirements

- Node 20 or newer; the scripts use no packages.
- The Infinite Props SDK. The scripts download 0.8.0 for macOS arm64, Linux x86_64 or Windows
  x86_64 into `~/.cache/iprop-asset/sdk/<version>` and check it against the release's SHA-256 sums.
  `IPROP_SDK` points them at an unpacked SDK instead, `IPROP_VERSION` selects another release and
  `IPROP_SDK_CACHE` moves the cache.

## Scripts

```sh
node scripts/sdk.mjs                                              # the SDK, its tools and its LLM reference
node scripts/new-asset.mjs ~/game/props --name Lantern --size 32x48 --variety high
node scripts/new-asset.mjs ~/game/props --name StreetLamp --size 32x64 --composed --features base,post,head \
  --outputs anchor,collider,light:circle                          # outputs only on request; none by default
node scripts/check-asset.mjs ~/game/props/lantern                 # compile, 200 seeds, contracts, variety, lint, sheet
node scripts/check-asset.mjs ~/game/props/lantern --emit          # ... and write lantern.iprop for the game
node scripts/sheet.mjs ~/game/props/lantern/lantern.ips --sweep kind=1,2,3 --outputs
node --test scripts/test                                          # the skill's own tests
```

`check-asset.mjs` exits with 1 when the asset is broken (compile errors, traps, empty, identical or
non-deterministic seeds). It also measures the variety level against the `// Variety:` line of the
asset's header. Renders go to `out/<asset>/` under the current folder.

## Contents

- `SKILL.md`: what to ask the user, the workflow, the house style, the features to use and the
  pitfalls.
- `references/`: the feature method, the variety levels, the model assets, the language (with
  snippets that compile), pixel-art quality and the lint, the review loop, using assets in games.
- `examples/`: five model assets. `tree`, `sword`, `potion` and `butterfly` come from the author's
  own collection (the last three are also sold on [iprop.store](https://iprop.store)); `potion` and
  `sword` were brought up to the 0.8 house style for this skill. `shield` was written by an agent
  with this skill from one prompt. All five name their stream keys (`const i32 shapeKey = ...`).
- `templates/`: the skeletons `new-asset.mjs` starts from.
- `scripts/`: the tools and their tests, with lint fixtures in `scripts/test/fixtures/`.
- `evals/`: test prompts for measuring the skill.

## Keeping it current

When an Infinite Props release changes the language, set `DEFAULT_VERSION` in
`scripts/lib/sdk.mjs`, read the idioms section of its `LLM_REFERENCE.md`, update `SKILL.md` and
`references/language.md`, and run `node --test scripts/test`: it compiles the templates, the
snippets and the examples with that SDK and checks that the lint still flags its fixtures.
