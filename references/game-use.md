# Using an asset in a game

## Compile

`node <skill>/scripts/check-asset.mjs <asset-folder> --emit` checks the asset and writes
`<entry>.iprop` next to each entry; `ipc <entry>.ips -o <path>.iprop` does the same without the
checks. Each entry becomes one self-contained file: its parts and materials are linked in, and the
game never loads `.ips` sources. Keep the sources as the truth and recompile when the SDK changes.
The 0.8 release changed only the source language; its `.iprop` files run on 0.7 runtimes.

## Runtimes

Each SDK carries a README per runtime under `share/iprop/backends/<name>/`:

| Runtime | What it is |
| --- | --- |
| `capi` | the C API (`ipropc`, shared and static), the base of every native host |
| `godot` | a GDExtension exposing assets as Godot resources and nodes (Godot 4.5) |
| `unity` | a UPM package: `.iprop` importer with previews, `IpropAsset`, Texture2D and Sprite helpers |
| `html5` | the runtime in WebAssembly: `generate(fileBytes, inputs)` returns pixels, outputs and fuel |
| `apple` | a Swift package for macOS and iOS with CGImage, SpriteKit and Metal helpers |
| `android` | a Kotlin AAR with a Bitmap adapter |
| `python` | a `ctypes` package over the C API, Pillow optional |
| `sfml` | a desktop host and viewer |

## What the game passes and gets

- **In**: the seed (u32), any declared inputs by name, optionally a target size (which scales
  the drawing; `ipgen --size WxH` does the same) and a fuel budget.
- **Out**: RGBA pixels and the outputs, in the root canvas's pixel coordinates: points, rects
  (`x, y, w, h`), circles (`x, y, r`) and lists of them.
- **Determinism**: the same program, seed and inputs give the same pixels and outputs on every
  platform. Store the seed and the input values in save files and level data, not pictures.

## Patterns

- **Generate when spawning or loading, not every frame.** Cache the texture by (asset, seed,
  inputs). Generation time grows with fuel; the check's peak fuel tells you the worst case, and a
  level of dozens of props multiplies it.
- **Place by the origin.** The asset's `origin` (and the `anchor` output) is where it stands: put
  that pixel on the entity's position. Convert colliders and mount points from canvas pixels to
  world units with the game's pixel scale.
- **Mount points** (`tip`, `grip`, `top`, `muzzle`) attach other entities, effects and lights.
  Lists (`output list circle crown`) describe many regions, such as the shade of a tree's clumps.
- **Second passes**: an input such as the sword's `renderPass` renders an emission map with the
  same seed for bloom; generate both with identical inputs.
- **Inputs from game state**: team colours through a tint, a quality tier, a damaged state. Leave
  them at their rolling defaults when the seed alone should decide.
- **Pre-rendering** for an engine without a runtime: render the seeds you need with
  `ipgen <file.iprop> --seed N -o out.png` (its JSON on stdout carries the outputs) or a strip with
  `ipsheet <file.iprop> --seed 1 --seeds 16 --columns 8 -o atlas.png`, and pack them.
- **Stable looks**: changing a family's weight, adding a roll before others or reordering streams
  changes what existing seeds produce. When saves depend on looks, keep the families' numbers
  stable, add new rolls in streams of their own, and version the asset when looks must change.
