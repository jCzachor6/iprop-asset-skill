#!/usr/bin/env node
// Checks an asset the way a game uses it: every file compiles, every seed renders without a trap,
// seeds differ, renders repeat exactly, fuel stays in budget, outputs are set and on the canvas, and
// inputs documented as "0 rolls" / "transparent rolls" reproduce what the seed rolls. It measures
// the variety against the level the header asks for ("// Variety: high"), lints the pixel art and
// writes a contact sheet to look at. Exits with 1 when something is broken.
// Usage: node check-asset.mjs <asset-folder|entry.ips> [--seeds 1-24 | --seed-file seeds.txt]
//          [--scan 200] [--variety low|medium|high|extreme] [--style pixel|realistic]
//          [--lint-off code,code] [--uniform name=value]... [--baseline old.iprop] [--emit]
//          [--allow-edge] [--outputs] [--out out/<name>] [--json]
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, relative, resolve } from "node:path"
import { CODES, measure, summarize } from "./lib/lint.mjs"
import { encodePng, isEmpty, parseColor, pixelHash, silhouetteHash } from "./lib/png.mjs"
import { checkSource, compile, generate, optionPairs, parseSeeds, readSeedFile, readSources, rolledInputs, stemOf, validate } from "./lib/render.mjs"
import { requireSdk, versionAtLeast } from "./lib/sdk.mjs"
import { buildSheets } from "./lib/sheet.mjs"
import { LEVELS, judgeVariety, measureVariety, varietyTarget } from "./lib/variety.mjs"

const USAGE = "Usage: node check-asset.mjs <asset-folder|entry.ips> [--seeds 1-24|--seed-file seeds.txt] [--scan 200] [--variety low|medium|high|extreme] [--style pixel|realistic] [--lint-off code,code] [--uniform name=value]... [--baseline old.iprop] [--emit] [--allow-edge] [--outputs] [--out dir] [--json]"
const VALUED = new Set(["--seeds", "--seed-file", "--scan", "--variety", "--style", "--lint-off", "--uniform", "--baseline", "--out", "--sdk-version"])
const args = process.argv.slice(2)
const option = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined)
const target = args.find((arg, index) => !arg.startsWith("--") && !VALUED.has(args[index - 1]))
if (!target || !existsSync(target)) {
  console.error(target ? `${target} does not exist` : USAGE)
  process.exit(2)
}
const style = option("--style") ?? "pixel"
const off = (option("--lint-off") ?? "").split(",").map((code) => code.trim()).filter(Boolean)
if (!["pixel", "realistic"].includes(style) || off.some((code) => !CODES.includes(code))) {
  console.error(`--style is pixel or realistic; --lint-off takes ${CODES.join(", ")}`)
  process.exit(2)
}
if (option("--variety") && !LEVELS.includes(option("--variety"))) {
  console.error(`--variety is one of ${LEVELS.join(", ")}`)
  process.exit(2)
}
const json = args.includes("--json")
const scanCount = Number(option("--scan") ?? 200)
const uniforms = optionPairs(args, "--uniform")
const sdk = requireSdk(option("--sdk-version"))

const lines = []
const say = (text = "") => (json ? lines.push(text) : console.log(text))
let errors = 0
let warnings = 0
const result = (level, label, text) => {
  if (level === "error") errors++
  if (level === "warn") warnings++
  say(`  ${level.padEnd(5)} ${label.padEnd(12)} ${text}`)
  return { level, label, text }
}
const plural = (count, word) => `${count} ${count === 1 ? word : word.replace(/([^aeiou])y$/, "$1ie") + "s"}`
const show = (path) => (relative(process.cwd(), path).startsWith("..") ? path : relative(process.cwd(), path))
const number = (value) => Math.round(value).toLocaleString("en-US")

const sources = readSources(target)
const report = { sdk: { version: sdk.version, dir: sdk.dir }, target: resolve(target), style, entries: [], checks: [] }
say(`Infinite Props ${sdk.version} (${sdk.dir})`)
const names = (files) => files.map((file) => file.path).join(", ")
say(`${show(sources.root) || "."}: ${plural(sources.files.length, ".ips file")}: ` +
  `${plural(sources.entries.length, "entry")}${sources.entries.length ? ` (${names(sources.entries)})` : ""}, ` +
  `${plural(sources.parts.length, "part")}, ${plural(sources.libraries.length, "material library")}${sources.libraries.length ? ` (${names(sources.libraries)})` : ""}`)

for (const missing of sources.missing) report.checks.push(result("error", "import", `${missing.from} imports "${missing.import}", which does not exist`))
for (const library of sources.unusedLibraries) report.checks.push(result("warn", "materials", `${library.path} is a material library no asset imports`))
if (sources.libraries.length && !versionAtLeast(sdk.version, "0.8.0")) {
  report.checks.push(result("error", "materials", `material libraries need Infinite Props 0.8.0 or newer; this SDK is ${sdk.version}`))
}
if (!sources.entries.length) report.checks.push(result("error", "entry", "no asset entry: every .ips here is imported by another file or is a material library"))

// Compile checks: each entry with everything it imports, plus libraries no entry reaches.
const diagnostics = []
const seen = new Set()
for (const file of [...sources.entries, ...sources.unusedLibraries]) {
  for (const diagnostic of checkSource(sdk, file.file)) {
    const key = `${diagnostic.file}:${diagnostic.line}:${diagnostic.column}:${diagnostic.code}:${diagnostic.message}`
    if (seen.has(key)) continue
    seen.add(key)
    diagnostics.push(diagnostic)
  }
}
if (diagnostics.length) {
  for (const diagnostic of diagnostics) {
    const where = diagnostic.line ? `${diagnostic.file}:${diagnostic.line}:${diagnostic.column}` : diagnostic.file
    report.checks.push(result(diagnostic.severity === "warning" ? "warn" : "error", diagnostic.code, `${where}: ${diagnostic.message}`))
    for (const suggestion of diagnostic.suggestions) say(`        ${" ".repeat(12)} suggestion: ${typeof suggestion === "string" ? suggestion : JSON.stringify(suggestion)}`)
  }
} else if (sources.entries.length) {
  report.checks.push(result("ok", "compile", `${plural(sources.files.length, "file")}, no diagnostics`))
}
report.diagnostics = diagnostics

if (!errors) for (const entry of sources.entries) report.entries.push(checkEntry(entry))

say()
say(`${plural(errors, "error")}, ${plural(warnings, "warning")}`)
report.errors = errors
report.warnings = warnings
if (json) console.log(JSON.stringify({ ...report, log: lines }, null, 2))
process.exit(errors ? 1 : 0)

function checkEntry(entry) {
  const stem = stemOf(entry.path)
  const out = resolve(option("--out") ? (sources.entries.length > 1 ? join(option("--out"), stem) : option("--out")) : join("out", stem))
  mkdirSync(join(out, "seeds"), { recursive: true })
  const checks = []
  const add = (level, label, text) => checks.push(result(level, label, text))
  const binary = join(out, `${stem}.iprop`)
  const previous = join(out, `${stem}-previous.iprop`)
  if (existsSync(binary)) renameSync(binary, previous)
  for (const name of ["sheet.png", "sheet-2.png", "sheet-3.png"]) {
    if (existsSync(join(out, name))) renameSync(join(out, name), join(out, name.replace("sheet", "sheet-previous")))
  }
  const summary = { entry: entry.path, out, checks }
  say()

  const compiled = compile(sdk, entry.file, binary)
  if (!compiled.ok) {
    say(`${entry.path}`)
    add("error", "compile", compiled.error)
    return summary
  }
  const valid = validate(sdk, binary)
  const work = mkdtempSync(join(tmpdir(), "iprop-check-"))
  try {
    // Scan: every seed must render; collect fuel, outputs, variety and edges.
    const traps = []
    const empty = []
    const touching = []
    const unset = new Map()
    const outside = new Map()
    const broken = []
    const images = new Set()
    const silhouettes = new Set()
    const scanned = []
    const fuel = []
    // Outputs the entry declares itself. Part outputs reach the host too, but they belong to the part.
    const own = new Set([...entry.content.matchAll(/\boutput\s+(?:list\s+)?(?:point|rect|circle)\s+([A-Za-z_]\w*)/g)].map((match) => match[1]))
    const origin = entry.content.match(/^\s*origin\s+(-?[\d.]+)\s*[, ]\s*(-?[\d.]+)/m)
    let info = null
    for (let seed = 1; seed <= scanCount; seed++) {
      const render = generate(sdk, binary, seed, join(work, "scan.png"), uniforms)
      if (!render.ok) {
        traps.push({ seed, error: render.error })
        continue
      }
      info ??= render.info
      fuel.push({ seed, spent: render.info.fuel.spent, budget: render.info.fuel.budget })
      if (isEmpty(render.image)) empty.push(seed)
      images.add(pixelHash(render.image))
      silhouettes.add(silhouetteHash(render.image))
      scanned.push(render.image)
      const sides = touchedSides(render.image, origin ? Number(origin[2]) : null)
      if (sides.length) touching.push({ seed, sides })
      inspectOutputs(render.info, seed, own, { unset, outside, broken })
    }

    const canvas = info ? `${info.size.x}x${info.size.y}` : "?"
    const inputs = info?.inputs.map((input) => `${input.name}:${input.type}=${input.default}`).join(" ") || "none"
    const outputNames = info?.outputs.filter((output) => own.has(output.name)).map((output) => output.name + (output.list ? "[]" : "")).join(", ") || "none"
    say(`${entry.path} · ${canvas} · inputs ${inputs} · outputs ${outputNames}`)
    summary.canvas = info?.size
    summary.inputs = info?.inputs
    add(valid.ok ? "ok" : "error", "ipval", valid.ok ? "valid" : valid.violations.map((v) => v.message).join("; "))

    const rendered = scanCount - traps.length
    if (traps.length) {
      const reasons = [...new Set(traps.map((trap) => trap.error))]
      add("error", "traps", `${traps.length}/${scanCount} seeds trap (${traps.slice(0, 8).map((trap) => trap.seed).join(" ")}${traps.length > 8 ? " ..." : ""}): ${reasons.slice(0, 3).join("; ")}`)
    }
    if (empty.length) add("error", "empty", `${empty.length} seeds render nothing (${empty.slice(0, 8).join(" ")})`)
    if (!traps.length && !empty.length) add("ok", "seeds", `1-${scanCount}: all render, none empty`)

    if (rendered > 1) {
      if (images.size === 1) add("error", "variety", `all ${rendered} seeds render the same image: draw the look from the seed`)
      else {
        const share = images.size / rendered
        add(share < 0.9 ? "warn" : "ok", "variety", `${images.size}/${rendered} distinct images, ${silhouettes.size} distinct silhouettes`)
        if (silhouettes.size === 1) add("warn", "silhouette", "every seed has the same silhouette; only colours vary (roll the shape too)")
        else if (silhouettes.size < rendered * 0.5) add("warn", "silhouette", `only ${silhouettes.size} silhouettes across ${rendered} seeds: most seeds share their shape (roll families and proportions)`)
      }
    }

    // The variety level: --variety, or the "// Variety: <level>" line of the header. The bands assume
    // about 200 seeds, so a short scan reports the measure without judging it.
    if (rendered > 1) {
      const target = option("--variety") ?? varietyTarget(entry.content)
      const measured = measureVariety(scanned)
      summary.variety = { target, ...measured }
      const [level, text] = rendered >= 100 ? judgeVariety(measured, target) : ["ok", `${judgeVariety(measured, null)[1]}; over ${rendered} seeds, not judged (the levels assume 200)`]
      add(level, "level", text)
    }
    scanned.length = 0

    if (fuel.length) {
      const budget = fuel[0].budget
      const heaviest = [...fuel].sort((a, b) => b.spent - a.spent)
      const mean = fuel.reduce((sum, item) => sum + item.spent, 0) / fuel.length
      const peak = heaviest[0]
      add(peak.spent > budget * 0.8 ? "warn" : "ok", "fuel",
        `mean ${number(mean)}, max ${number(peak.spent)} (${Math.round((peak.spent / budget) * 100)}% of ${number(budget)}) at seed ${peak.seed}; heaviest ${heaviest.slice(0, 5).map((item) => item.seed).join(" ")}`)
      summary.fuel = { mean: Math.round(mean), max: peak.spent, budget, heaviest: heaviest.slice(0, 5).map((item) => item.seed) }
    }

    if (broken.length) add("error", "outputs", broken.slice(0, 3).join("; "))
    const outputIssues = [
      ...[...unset].map(([name, seeds]) => `${name} unset on ${seeds.length} seeds (${seeds.slice(0, 6).join(" ")})`),
      ...[...outside].map(([name, seeds]) => `${name} off the canvas on ${seeds.length} seeds (${seeds.slice(0, 6).join(" ")})`),
    ]
    if (outputIssues.length) add("warn", "outputs", outputIssues.join("; "))
    else if (own.size && !broken.length) add("ok", "outputs", `${outputNames} set and on the canvas`)
    else if (info && !own.size) add("ok", "outputs", "none declared: the game reads only the image")

    if (touching.length && !args.includes("--allow-edge")) {
      const sides = [...new Set(touching.flatMap((item) => item.sides))].join(", ")
      add("warn", "edge", `${touching.length}/${rendered} seeds touch the ${sides} edge (${touching.slice(0, 8).map((item) => item.seed).join(" ")}): the prop may be cut off`)
    }

    // The seeds to look at: --seeds, --seed-file, seeds.txt next to the entry, or 1-24.
    const nearby = join(dirname(entry.file), "seeds.txt")
    const seedFile = option("--seed-file") ?? (existsSync(nearby) ? nearby : null)
    const seeds = option("--seeds") ? parseSeeds(option("--seeds")) : seedFile ? readSeedFile(seedFile) : parseSeeds("1-24")
    const renders = []
    for (const seed of seeds) {
      const png = join(out, "seeds", `${stem}-${seed}.png`)
      const render = generate(sdk, binary, seed, png, uniforms)
      if (render.ok) renders.push({ seed, png, image: render.image, info: render.info, hash: pixelHash(render.image), metrics: measure(render.image) })
    }

    // Determinism: the same seed renders the same pixels and outputs.
    const repeat = renders.slice(0, 3)
    const differs = repeat.filter((render) => {
      const again = generate(sdk, binary, render.seed, join(work, "again.png"), uniforms)
      return !again.ok || pixelHash(again.image) !== render.hash || JSON.stringify(again.info.outputs) !== JSON.stringify(render.info.outputs)
    })
    if (repeat.length) {
      add(differs.length ? "error" : "ok", "determinism", differs.length ? `seeds ${differs.map((r) => r.seed).join(" ")} render differently twice` : `seeds ${repeat.map((r) => r.seed).join(" ")} render identically twice`)
    }

    // Inputs documented as rolling from the seed must reproduce the rolled look when forced.
    if (info) for (const check of inputContracts(entry, info, binary, renders.slice(0, 3), work, own)) add(...check)

    // A refactor should not move pixels: compare with --baseline, or report the change since the last run.
    const baseline = option("--baseline") ? resolve(option("--baseline")) : existsSync(previous) ? previous : null
    if (baseline) {
      const changed = renders.filter((render) => {
        const old = generate(sdk, baseline, render.seed, join(work, "old.png"), uniforms)
        return !old.ok || pixelHash(old.image) !== render.hash || JSON.stringify(old.info.outputs) !== JSON.stringify(render.info.outputs)
      })
      const level = option("--baseline") && changed.length ? "warn" : "ok"
      add(level, "baseline", `${changed.length}/${renders.length} seeds changed since ${option("--baseline") ? show(baseline) : "the last run"}${changed.length ? ` (${changed.slice(0, 10).map((r) => r.seed).join(" ")})` : ""}`)
    }

    // Lint and the sheet.
    say(`  lint (${style}, ${plural(renders.length, "seed")}${off.length ? `, off: ${off.join(",")}` : ""})`)
    const lint = summarize(renders, { style, off })
    for (const item of lint) add(item.level, item.code, item.text)
    summary.lint = lint

    const pages = buildSheets(renders.map((render) => ({ image: render.image, label: String(render.seed), outputs: render.info.outputs.filter((output) => own.has(output.name)) })), { overlay: args.includes("--outputs") })
    pages.forEach((page, index) => {
      const path = join(out, index ? `sheet-${index + 1}.png` : "sheet.png")
      writeFileSync(path, encodePng(page.image))
      say(`  sheet: ${show(path)} (${plural(page.cells.length, "seed")}, zoom ${page.zoom}x)`)
    })
    summary.sheets = pages.map((_, index) => join(out, index ? `sheet-${index + 1}.png` : "sheet.png"))

    if (args.includes("--emit")) {
      const target = entry.file.replace(/\.ips$/, ".iprop")
      copyFileSync(binary, target)
      say(`  emit: ${show(target)}`)
    }
  } finally {
    rmSync(work, { recursive: true, force: true })
  }
  writeFileSync(join(out, "report.json"), JSON.stringify(summary, null, 2))
  say(`  report: ${show(join(out, "report.json"))}`)
  return summary
}

// Sides of the canvas the drawing touches. With the origin on the bottom rows the prop stands on the
// ground there, so the bottom edge is where it belongs.
function touchedSides({ width, height, rgba }, originY) {
  const solid = (x, y) => rgba[(y * width + x) * 4 + 3] >= 64
  const columns = Array.from({ length: width }, (_, x) => x)
  const rows = Array.from({ length: height }, (_, y) => y)
  const sides = []
  if (columns.some((x) => solid(x, 0))) sides.push("top")
  if ((originY == null || originY < height - 6) && columns.some((x) => solid(x, height - 1))) sides.push("bottom")
  if (rows.some((y) => solid(0, y))) sides.push("left")
  if (rows.some((y) => solid(width - 1, y))) sides.push("right")
  return sides
}

function inspectOutputs(info, seed, own, { unset, outside, broken }) {
  const [w, h] = [info.size.x, info.size.y]
  for (const output of info.outputs.filter((item) => own.has(item.name))) {
    if (!output.values.length) {
      if (!output.list) unset.set(output.name, [...(unset.get(output.name) ?? []), seed])
      continue
    }
    for (const value of output.values) {
      const numbers = Object.values(value)
      if (numbers.some((n) => !Number.isFinite(n))) {
        broken.push(`${output.name} is not finite at seed ${seed}`)
        continue
      }
      const away = output.kind === "rect"
        ? value.w < 0 || value.h < 0 || value.x + value.w < -1 || value.y + value.h < -1 || value.x > w + 1 || value.y > h + 1
        : value.x < -1 || value.y < -1 || value.x > w + 1 || value.y > h + 1
      if (away) outside.set(output.name, [...new Set([...(outside.get(output.name) ?? []), seed])])
    }
  }
}

function inputContracts(entry, info, binary, renders, work, own) {
  const geometry = (outputs) => JSON.stringify(outputs.filter((output) => own.has(output.name)))
  const rolled = rolledInputs(entry.content)
  const forced = new Set(uniforms.map(([name]) => name))
  const checks = []
  for (const input of info.inputs) {
    if (!rolled.has(input.name) || forced.has(input.name) || !renders.length) continue
    if (input.type === "color") {
      if (parseColor(input.default)[3] !== 0) continue
      const problems = []
      let changes = false
      for (const render of renders) {
        for (const colour of ["#b03a2e", "#2e6db0"]) {
          const tinted = generate(sdk, binary, render.seed, join(work, "tint.png"), [...uniforms, [input.name, colour]])
          if (!tinted.ok) {
            problems.push(`seed ${render.seed} traps with ${input.name}=${colour}`)
            continue
          }
          if (pixelHash(tinted.image) !== render.hash) changes = true
          if (silhouetteHash(tinted.image) !== silhouetteHash(render.image)) problems.push(`${input.name}=${colour} moves the silhouette of seed ${render.seed}`)
          if (geometry(tinted.info.outputs) !== geometry(render.info.outputs)) problems.push(`${input.name}=${colour} moves the outputs of seed ${render.seed}`)
        }
      }
      if (!changes) problems.push(`forcing ${input.name} changes nothing`)
      checks.push(problems.length
        ? ["warn", `input ${input.name}`, `${[...new Set(problems)].slice(0, 3).join("; ")} (roll colours on their own stream, after the shape)`]
        : ["ok", `input ${input.name}`, "transparent rolls a colour; forced colours keep the silhouette and outputs"])
    } else if ((input.type === "u32" || input.type === "i32") && Number(input.default) === 0) {
      const matches = []
      const missing = []
      for (const render of renders) {
        let found = null
        for (let value = 1; value <= 64 && found == null; value++) {
          const forcedRender = generate(sdk, binary, render.seed, join(work, "forced.png"), [...uniforms, [input.name, String(value)]])
          if (forcedRender.ok && pixelHash(forcedRender.image) === render.hash && geometry(forcedRender.info.outputs) === geometry(render.info.outputs)) found = value
        }
        if (found == null) missing.push(render.seed)
        else matches.push(`${render.seed}→${found}`)
      }
      checks.push(missing.length
        ? ["warn", `input ${input.name}`, `0 rolls, but no value 1-64 reproduces seeds ${missing.join(" ")} (choose by hashing the seed, roll every value unconditionally)`]
        : ["ok", `input ${input.name}`, `0 rolls; forced values reproduce it (seed→value ${matches.join(" ")})`])
    }
  }
  return checks
}
