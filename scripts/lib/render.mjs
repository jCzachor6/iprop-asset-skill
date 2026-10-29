// Reading the .ips tree around an asset, and compiling, validating and rendering it with the SDK.
import { spawnSync } from "node:child_process"
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { dirname, join, posix, relative, resolve, sep } from "node:path"
import { decodePng } from "./png.mjs"

const IMPORT = /^\s*import\s+(\w+)\s+from\s+"([^"]+)"/gm
const MATERIAL = /^\s*material\s+[A-Za-z_]\w*\s*\{/m
const ASSET = /^\s*asset\s+[A-Za-z_]\w*/m
const INPUT = /\binput\s+(u32|i32|f32|color)\s+([A-Za-z_]\w*)/g

const toPosix = (path) => path.split(sep).join("/")

/** A material file defines materials and no asset; it only works when an asset imports it. */
export const isMaterialLibrary = (content) => MATERIAL.test(content) && !ASSET.test(content)

/**
 * The .ips files of an asset folder (or of the folder around one entry file), split into entries
 * (assets no other file imports), parts (imported assets) and material libraries. Paths are relative
 * to the folder.
 */
export const readSources = (target) => {
  const path = resolve(target)
  const single = statSync(path).isFile()
  const root = single ? dirname(path) : path
  const files = []
  const visit = (dir) => {
    for (const name of readdirSync(dir).sort()) {
      if (name.startsWith(".") || name === "out" || name === "node_modules") continue
      const full = join(dir, name)
      if (statSync(full).isDirectory()) visit(full)
      else if (name.endsWith(".ips")) files.push({ path: toPosix(relative(root, full)), file: full, content: readFileSync(full, "utf8") })
    }
  }
  visit(root)
  const known = new Map(files.map((file) => [file.path, file]))
  const imported = new Set()
  const missing = []
  for (const file of files) {
    file.imports = []
    for (const match of file.content.matchAll(IMPORT)) {
      const target = posix.normalize(posix.join(posix.dirname(file.path), match[2]))
      file.imports.push(target)
      if (known.has(target)) imported.add(target)
      else if (!existsSync(resolve(dirname(file.file), match[2]))) missing.push({ from: file.path, import: match[2] })
    }
    file.library = isMaterialLibrary(file.content)
  }
  let entries = files.filter((file) => !file.library && !imported.has(file.path))
  if (single) entries = files.filter((file) => file.file === path)
  return {
    root,
    files,
    entries,
    parts: files.filter((file) => !file.library && imported.has(file.path)),
    libraries: files.filter((file) => file.library),
    unusedLibraries: files.filter((file) => file.library && !imported.has(file.path)),
    missing,
  }
}

/** Inputs whose comments say their default rolls from the seed ("0 rolls", "transparent rolls one"). */
export const rolledInputs = (content) => {
  const lines = content.split("\n")
  const comment = (line) => (line.includes("//") ? line.slice(line.indexOf("//") + 2) : "")
  const declared = new Set()
  const rolled = new Set()
  lines.forEach((line, index) => {
    for (const match of line.matchAll(INPUT)) {
      declared.add(match[2])
      let notes = comment(line)
      for (let above = index - 1; above >= 0 && /^\s*\/\//.test(lines[above]); above--) notes += " " + comment(lines[above])
      if (/\broll/i.test(notes)) rolled.add(match[2])
    }
  })
  // Prose in the header, such as "style  0 rolls a style" or "tint   transparent rolls the colour".
  for (const line of lines) {
    const text = comment(line)
    if (!/\broll/i.test(text)) continue
    for (const name of declared) if (new RegExp(`\\b${name}\\b[^.]*\\broll`, "i").test(text)) rolled.add(name)
  }
  return rolled
}

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, { encoding: "utf8", maxBuffer: 64 << 20, ...options })
  return { status: result.status ?? 1, stdout: result.stdout ?? "", stderr: result.stderr ?? "", error: result.error }
}

/** ipc --check with JSON diagnostics: [] when the file and everything it imports compile. */
export const checkSource = (sdk, file) => {
  const result = run(sdk.ipc, [file, "--check", "--diagnostics=json"], { cwd: dirname(file) })
  try {
    const report = JSON.parse(result.stdout)
    return report.diagnostics.map((diagnostic) => ({
      code: diagnostic.code,
      severity: diagnostic.severity,
      message: diagnostic.message,
      file: diagnostic.file,
      line: diagnostic.location?.line,
      column: diagnostic.location?.column,
      suggestions: diagnostic.suggestions ?? [],
    }))
  } catch {
    if (result.status === 0) return []
    return [{ code: "IPC", severity: "error", message: (result.stderr || result.stdout || String(result.error)).trim(), file }]
  }
}

export const compile = (sdk, file, output) => {
  const result = run(sdk.ipc, [file, "-o", output], { cwd: dirname(file) })
  return result.status === 0 ? { ok: true } : { ok: false, error: (result.stderr || result.stdout).trim() }
}

export const validate = (sdk, binary) => {
  if (!sdk.ipval) return { ok: true, skipped: true }
  const result = run(sdk.ipval, ["--json", binary])
  try {
    const report = JSON.parse(result.stdout)
    return { ok: report.valid, violations: report.violations ?? [] }
  } catch {
    return { ok: result.status === 0, violations: [{ message: (result.stderr || result.stdout).trim() }] }
  }
}

// ipgen takes a negative i32 as its unsigned 32-bit pattern.
const uniformValue = (value) => (/^-\d+$/.test(value) ? String((Number(value) + 2 ** 32) >>> 0) : String(value))

/**
 * Renders one seed to `png`. Returns { ok, info, image } where info is ipgen's JSON (seed, size, fuel,
 * inputs, outputs), or { ok: false, error } for a trap or a bad file.
 */
export const generate = (sdk, binary, seed, png, uniforms = []) => {
  const args = [binary, "--seed", String(seed >>> 0)]
  for (const [name, value] of uniforms) args.push("--uniform", `${name}=${uniformValue(value)}`)
  args.push("-o", png)
  const result = run(sdk.ipgen, args)
  if (result.status !== 0) return { ok: false, error: (result.stderr || result.stdout || String(result.error)).trim().replace(/^ipgen:\s*/, "") }
  const info = JSON.parse(result.stdout)
  const image = decodePng(readFileSync(png))
  return { ok: true, info, image }
}

/** "1-24", "3,7,19", "1-5,40" → [1, ..., 24]. */
export const parseSeeds = (text) => {
  const seeds = []
  for (const part of String(text).split(",").map((value) => value.trim()).filter(Boolean)) {
    const range = part.match(/^(\d+)\s*-\s*(\d+)$/)
    if (range) for (let seed = Number(range[1]); seed <= Number(range[2]); seed++) seeds.push(seed)
    else if (/^\d+$/.test(part)) seeds.push(Number(part))
    else throw new Error(`not a seed or a range: "${part}"`)
  }
  return seeds
}

/** Seeds from a seeds.txt file: numbers separated by spaces, commas or lines; # starts a comment. */
export const readSeedFile = (path) =>
  parseSeeds(readFileSync(path, "utf8").split("\n").map((line) => line.replace(/#.*/, "").trim()).filter(Boolean).join(",").replace(/\s+/g, ","))

/** "name=value" arguments of a repeated option. */
export const optionPairs = (args, name) =>
  args.flatMap((arg, index) => (arg === name && args[index + 1] ? [args[index + 1]] : [])).map((pair) => {
    const at = pair.indexOf("=")
    if (at < 1) throw new Error(`${name} takes name=value, got "${pair}"`)
    return [pair.slice(0, at), pair.slice(at + 1)]
  })

/** Stem of an entry file: "sword/sword.ips" → "sword". */
export const stemOf = (path) => posix.basename(toPosix(path)).replace(/\.ips$/, "")
