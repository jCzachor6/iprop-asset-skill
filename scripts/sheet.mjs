#!/usr/bin/env node
// Renders seeds of an asset side by side, zoomed and labelled, as PNG pages small enough to look at
// whole. With --sweep, each row forces one value of an input, so you see what the input does.
// Usage: node sheet.mjs <entry.ips|file.iprop> [--seeds 1-24 | --seed-file seeds.txt]
//          [--sweep name=v1,v2,...] [--uniform name=value]... [--zoom N] [--columns N]
//          [--bg dark|light|mid|checker|#rrggbb] [--outputs] [--real-size] [--out sheet.png]
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { basename, dirname, join, resolve } from "node:path"
import { createImage, encodePng } from "./lib/png.mjs"
import { compile, generate, optionPairs, parseSeeds, readSeedFile } from "./lib/render.mjs"
import { requireSdk } from "./lib/sdk.mjs"
import { buildSheets } from "./lib/sheet.mjs"

const USAGE = "Usage: node sheet.mjs <entry.ips|file.iprop> [--seeds 1-24|--seed-file seeds.txt] [--sweep name=v1,v2,...] [--uniform name=value]... [--zoom N] [--columns N] [--bg dark|light|mid|checker|#rrggbb] [--outputs] [--real-size] [--out sheet.png]"
const VALUED = new Set(["--seeds", "--seed-file", "--sweep", "--uniform", "--zoom", "--columns", "--bg", "--out", "--sdk-version"])
const args = process.argv.slice(2)
const option = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined)
const target = args.find((arg, index) => !arg.startsWith("--") && !VALUED.has(args[index - 1]))
if (!target || !existsSync(target)) {
  console.error(target ? `${target} does not exist` : USAGE)
  process.exit(2)
}

const sdk = requireSdk(option("--sdk-version"))
const source = resolve(target)
const stem = basename(source).replace(/\.(ips|iprop)$/, "")
const work = mkdtempSync(join(tmpdir(), "iprop-sheet-"))
let failed = 0
try {
  let binary = source
  if (source.endsWith(".ips")) {
    binary = join(work, `${stem}.iprop`)
    const result = compile(sdk, source, binary)
    if (!result.ok) {
      console.error(result.error)
      process.exit(1)
    }
  }
  const nearby = join(dirname(source), "seeds.txt")
  const seedFile = option("--seed-file") ?? (existsSync(nearby) ? nearby : null)
  const seeds = option("--seeds") ? parseSeeds(option("--seeds")) : seedFile ? readSeedFile(seedFile) : parseSeeds("1-24")
  const uniforms = optionPairs(args, "--uniform")
  // The overlay shows the outputs the entry declares; its parts report more, often data points.
  const own = source.endsWith(".ips")
    ? new Set([...readFileSync(source, "utf8").matchAll(/\boutput\s+(?:list\s+)?(?:point|rect|circle)\s+([A-Za-z_]\w*)/g)].map((match) => match[1]))
    : null

  let rows = [{ label: null, uniforms }]
  const sweep = option("--sweep")
  if (sweep) {
    const at = sweep.indexOf("=")
    const [name, values] = [sweep.slice(0, at), sweep.slice(at + 1)]
    if (at < 1 || !values) throw new Error(`--sweep takes name=v1,v2,..., got "${sweep}"`)
    rows = values.split(",").map((value) => ({ label: `${name}=${value}`, uniforms: [...uniforms.filter(([key]) => key !== name), [name, value]] }))
  }

  const cells = []
  let canvas = null
  for (const row of rows) {
    for (const seed of seeds) {
      const result = generate(sdk, binary, seed, join(work, `${cells.length}.png`), row.uniforms)
      if (result.ok) {
        canvas ??= result.image
        cells.push({ image: result.image, label: String(seed), outputs: result.info.outputs.filter((output) => !own || own.has(output.name)) })
      } else {
        failed++
        console.error(`seed ${seed}${row.label ? ` (${row.label})` : ""}: ${result.error}`)
        cells.push({ image: null, label: `${seed} TRAP` })
      }
    }
  }
  for (const cell of cells) cell.image ??= createImage(canvas?.width ?? 16, canvas?.height ?? 16)

  const pages = buildSheets(cells, {
    rowLabels: sweep ? rows.map((row) => row.label) : null,
    zoom: option("--zoom") ? Number(option("--zoom")) : undefined,
    columns: option("--columns") ? Number(option("--columns")) : undefined,
    background: option("--bg") ?? "dark",
    overlay: args.includes("--outputs"),
    realSize: args.includes("--real-size"),
  })
  const out = resolve(option("--out") ?? join("out", stem, sweep ? `sweep-${sweep.slice(0, sweep.indexOf("="))}.png` : "sheet.png"))
  mkdirSync(dirname(out), { recursive: true })
  pages.forEach((page, index) => {
    const path = index ? out.replace(/\.png$/, `-${index + 1}.png`) : out
    writeFileSync(path, encodePng(page.image))
    console.log(`sheet: ${path} (${page.image.width}x${page.image.height}, zoom ${page.zoom}x, seeds ${[...new Set(page.cells.map((label) => label.split(" ")[0]))].join(" ")}${sweep ? `, rows ${rows.map((row) => row.label).join(" | ")}` : ""})`)
  })
} catch (cause) {
  console.error(cause.message)
  process.exit(2)
} finally {
  rmSync(work, { recursive: true, force: true })
}
if (failed) {
  console.error(`${failed} render(s) failed; the cells say TRAP`)
  process.exit(1)
}
