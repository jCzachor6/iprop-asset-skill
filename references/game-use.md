# Using an asset in a game

## Compile

`node <skill>/scripts/check-asset.mjs <asset-folder> --emit` checks the asset and writes
`<entry>.iprop` next to each entry; `ipc <entry>.ips -o <path>.iprop` does the same without the
checks. Each entry becomes one self-contained file: its parts and materials are linked in, and the
game never loads `.ips` sources. Keep the sources as the truth and recompile when the SDK changes.
The file format has not changed since 0.9: a program compiled with 1.0 holds no new instruction,
so it also runs on a 0.9 runtime, with the same pixels, outputs and fuel, and a 1.0 runtime runs
every file compiled with 0.9 as before. The file carries its own fuel budget: 25,000,000 when 1.0
compiled it, 5,000,000 when 0.9 did, until it is recompiled. An asset that uses noise masks,
geometry or dynamic parts needs a 0.9 runtime or newer; 0.9 and 1.0 runtimes draw files older
than that with the same pixels and outputs, but charge fuel by the 0.9 tariff.

## Runtimes

Each SDK carries a README per runtime under `share/iprop/backends/<name>/`:

| Runtime | What it is |
| --- | --- |
| `capi` | the C API (`ipropc`, shared and static), the base of every native host |
| `godot` | a GDExtension exposing assets as Godot resources and nodes (Godot 4.5.2) |
| `unity` | a UPM package (Unity 2022.3+): `.iprop` importer with previews, `IpropAsset`, Texture2D and Sprite helpers |
| `html5` | the runtime in WebAssembly: `generate(fileBytes, inputs)` returns pixels and outputs, parts included |
| `apple` | a Swift package for macOS and iOS with CGImage, SpriteKit and Metal helpers |
| `android` | a Kotlin AAR with a Bitmap adapter |
| `python` | a `ctypes` package over the C API, Pillow optional |
| `sfml` | a desktop host and viewer |

## What the game passes and gets

- **In**: the seed (u32), any declared inputs by name, optionally a target size (which scales
  the drawing; `ipgen --size WxH` does the same) and a fuel budget. Since 0.9 every binding also
  takes execution limits: a work budget (default 100,000,000 units), an optional deadline and a
  cancellation token; a generation stopped by them fails as a whole, with no partial image
  (`docs/execution-limits.md` in the SDK).
- **Out**: RGBA pixels and the outputs, in the root canvas's pixel coordinates: points, rects
  (`x, y, w, h`), circles (`x, y, r`) and lists of them. An `output list part` slot (0.9) holds
  dynamic parts: each one's shape (geometry with holes, or a raster), its fill or texture, its
  placement (quarter turns, mirrors, an integer translation), bounds, anchor and IDs, through the
  typed result API of every binding (in Python, `image.outputs` slots of kind `PART` with a
  `parts` tuple, and `image.resource(...)` for the shared shapes and textures). `ipgen`'s JSON
  cannot hold them: it renders such an asset with `--omit-part-outputs`.
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
- **Debris and pieces**: when the shield breaks, generate it again with `damage = 2` and spawn its
  `shards`: each record carries the shard's shape for a physics body, its texture from the drawn
  shield and where it lies, so the pieces match the sprite pixel for pixel.
- **Pre-rendering** for an engine without a runtime: render the seeds you need with
  `ipgen <file.iprop> --seed N -o out.png` (its JSON on stdout carries the outputs) or a strip with
  `ipsheet <file.iprop> --seed 1 --seeds 16 --columns 8 -o atlas.png`, and pack them.
- **Stable looks**: changing a family's weight, adding a roll before others or reordering streams
  changes what existing seeds produce. When saves depend on looks, keep the families' numbers
  stable, add new rolls in streams of their own, and version the asset when looks must change.
