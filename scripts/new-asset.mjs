#!/usr/bin/env node
// Starts a new asset folder from the skill's templates: a single file, or a root with one part per
// characteristic feature and a material library. The result compiles, renders varied seeds and
// passes check-asset; replace its drawing with the real object.
// Usage: node new-asset.mjs <parent-dir> --name Lantern [--size 32x48] [--origin 16,46]
//          [--outputs anchor,collider,grip] [--variety low|medium|high|extreme]
//          [--composed [--features body,cage,top]] [--force]
// Outputs are opt-in: none by default. `collider`, `bounds`, `hitbox` and `footprint` are rects,
// other names points; `name:rect`, `name:circle` or `name:point` sets the kind.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const USAGE = "Usage: node new-asset.mjs <parent-dir> --name Lantern [--size 32x48] [--origin 16,46] [--outputs anchor,collider,grip] [--variety low|medium|high|extreme] [--composed [--features body,cage,top]] [--force]"
const VALUED = new Set(["--name", "--size", "--origin", "--features", "--outputs", "--variety"])
const LEVELS = ["low", "medium", "high", "extreme"]
const RECTS = new Set(["collider", "bounds", "hitbox", "footprint"])
const args = process.argv.slice(2)
// Names a template already uses, and words and builtins of the language.
const RESERVED = [
  "seed", "draw", "at", "size", "origin", "const", "to", "with", "distribution", "sampler", "stepper", "weighted",
  "density", "layer", "mask", "clip", "surface", "material", "input", "output", "import", "palette", "list", "if",
  "else", "for", "return", "color", "vec2", "hash", "roll", "choose", "pick", "chance", "index", "lerp", "clamp",
  "min", "max", "abs", "sin", "cos", "float", "int", "rect", "oval", "line", "poly", "dot", "curve",
  "kind", "tint", "typical", "kinds", "cx", "ground", "maxHalf", "maxTall", "start", "look", "half", "tall",
  "kindKey", "shapeKey", "colorKey", "rolledKind",
]
const SINGLE = ["bodies", "families", "lean", "markY", "base", "marked", "tones", "outline", "body", "rows", "toneAt"]
const COMPOSED = ["main", "accent", "mount", "looks"]
const composed = args.includes("--composed")
const TAKEN = new Set([...RESERVED, ...(composed ? COMPOSED : SINGLE)])
const option = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined)
const parent = args.find((arg, index) => !arg.startsWith("--") && !VALUED.has(args[index - 1]))
const name = option("--name")
const fail = (message) => {
  console.error(message)
  process.exit(2)
}
if (!parent || !name) fail(USAGE)
if (!/^[A-Z][A-Za-z0-9]*$/.test(name)) fail(`--name is the asset's name in PascalCase, such as Lantern or StreetLamp (got "${name}")`)
const size = (option("--size") ?? "32x32").match(/^(\d+)x(\d+)$/)
if (!size) fail("--size is WIDTHxHEIGHT, such as 32x48")
const [width, height] = [Number(size[1]), Number(size[2])]
const origin = (option("--origin") ?? `${Math.floor(width / 2)},${height - 2}`).match(/^(\d+),(\d+)$/)
if (!origin) fail("--origin is X,Y in pixels, such as 16,46 (where the prop stands)")
const [ox, oy] = [Number(origin[1]), Number(origin[2])]
const variety = option("--variety") ?? "medium"
if (!LEVELS.includes(variety)) fail(`--variety is one of ${LEVELS.join(", ")}`)
const outputs = (option("--outputs") ?? "").split(",").map((item) => item.trim()).filter(Boolean).map((item) => {
  const [output, kind = RECTS.has(output) ? "rect" : "point"] = item.split(":")
  if (!/^[a-z][A-Za-z0-9]*$/.test(output) || TAKEN.has(output)) fail(`--outputs: "${output}" is not a free camelCase name for an output`)
  if (!["point", "rect", "circle"].includes(kind)) fail(`--outputs: ${output}:${kind} is not a point, rect or circle`)
  return { name: output, kind }
})

const stem = name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase()
const pascal = (text) => text.split("-").map((part) => part[0].toUpperCase() + part.slice(1)).join("")
const camel = (text) => pascal(text)[0].toLowerCase() + pascal(text).slice(1)
const target = resolve(parent, stem)
if (existsSync(target) && !args.includes("--force")) fail(`${target} exists; choose another name or add --force`)

const templates = join(dirname(fileURLToPath(import.meta.url)), "..", "templates")
const values = {
  __NAME__: name,
  __STEM__: stem,
  __W__: String(width),
  __H__: String(height),
  __OX__: String(ox),
  __OY__: String(oy),
  __HALF__: String(Math.max(2, Math.min(ox, width - ox) - 3)),
  __TALL__: String(Math.max(2, oy - 3)),
  __VARIETY__: variety,
}
const fill = (text, extra = {}) => Object.entries({ ...values, ...extra }).reduce((out, [key, value]) => out.split(key).join(value), text)
const write = (path, text) => {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, text)
  console.log(`wrote ${path}`)
}

// Where each kind of output starts, per template: the anchor where the prop stands, a rect around it,
// any other point at its top, a circle over it. Move them where the game needs them.
const place = composed
  ? { anchor: "{cx, ground}", point: "{mount.x, mount.y}", rect: "{cx - half - 1.0, mount.y - 1.0, half * 2.0 + 2.0, ground - mount.y + 1.0}", circle: "{cx, (ground + mount.y) * 0.5, max(half, (ground - mount.y) * 0.5)}" }
  : { anchor: "{cx, ground}", point: "{cx, ground - tall}", rect: "{cx - half - 1.0, ground - tall - 1.0, half * 2.0 + 2.0, tall + 1.0}", circle: "{cx, ground - tall * 0.5, max(half, tall * 0.5)}" }
const meaning = (output) =>
  output.name === "anchor" ? "where it stands on the ground"
    : output.kind === "rect" ? "its bounds"
    : output.kind === "circle" ? "<what the game reads here; it starts over the whole prop>"
    : "<what the game reads here; it starts at the top of the prop>"
const outputFill = {
  "//__OUTPUT_DOCS__": outputs.length ? outputs.map((output) => `//   ${output.name.padEnd(9)} ${meaning(output)}`).join("\n") : "//   none: the game reads only the image",
  "  //__OUTPUT_DECLS__\n": outputs.map((output) => `  output ${output.kind} ${output.name}\n`).join(""),
  "    //__OUTPUT_SETS__\n": outputs.length
    ? `\n${outputs.map((output) => `    ${output.name} = ${output.name === "anchor" && output.kind === "point" ? place.anchor : place[output.kind]}`).join("\n")}\n`
    : "",
}
const withOutputs = (text) => Object.entries(outputFill).reduce((out, [marker, value]) => out.split(marker).join(value), text)

const files = []
if (!composed) {
  write(join(target, `${stem}.ips`), withOutputs(fill(readFileSync(join(templates, "single", "prop.ips"), "utf8"))))
  files.push(`| \`${stem}.ips\` | the whole prop |`)
} else {
  const features = (option("--features") ?? "body,top").split(",").map((feature) => feature.trim()).filter(Boolean)
  if (!features.length || features.some((feature) => !/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(feature))) {
    fail("--features lists lower-case feature names, such as body,cage,top")
  }
  const names = (feature) => ["", "Key", "Width", "Share", "Half", "Tall"].map((suffix) => camel(feature) + suffix)
  const clash = features.find((feature) => names(feature).some((local) => TAKEN.has(local)) || outputs.some((output) => output.name === camel(feature)))
  if (clash) fail(`--features: "${clash}" is a name the template or an output already uses; call the feature something else`)
  // Keys from well-mixed constants of known hashes (MurmurHash3, xxHash, Bob Jenkins, the golden ratio).
  const keys = ["0x85ebca6b", "0xc2b2ae35", "0x27d4eb2f", "0x165667b1", "0xd3a2646c", "0xfd7046c5", "0xb55a4f09", "0x9e3779b9"]
  if (features.length > keys.length) fail(`--features takes up to ${keys.length} features; add more parts by hand, each with a key of its own`)
  const share = (0.95 / features.length).toFixed(3)
  const lines = { list: [], imports: [], keys: [], shape: [], sizes: [], calls: [] }
  features.forEach((feature, index) => {
    const alias = camel(feature)
    const material = index === 0 ? "Main" : "Accent"
    lines.list.push(`//   parts/${feature}.ips — the ${feature.replaceAll("-", " ")}`)
    lines.imports.push(`import ${alias} from "parts/${feature}.ips"`)
    lines.keys.push(`  const i32 ${alias}Key = ${keys[index]}`)
    lines.shape.push(`    ${alias}Width = 0.85 to 1.0 with typical`, `    ${alias}Share = 0.85 to 1.1 with typical`)
    lines.sizes.push(`    ${alias}Half = half * ${index === 0 ? "1.0" : "0.75"} * ${alias}Width`, `    ${alias}Tall = tall * ${share} * ${alias}Share`)
    lines.calls.push(
      `    ${alias}.draw(hash(start ^ ${alias}Key), at = mount, half = ${alias}Half, tall = ${alias}Tall, base = ${material === "Main" ? "main" : "accent"}.base)`,
      `    mount = ${alias}.outputs.top`,
    )
    write(join(target, "parts", `${feature}.ips`), fill(readFileSync(join(templates, "composed", "parts", "feature.ips"), "utf8"), {
      __FEATURE__: feature,
      __PART__: name + pascal(feature),
      __MATERIAL__: material,
    }))
    files.push(`| \`parts/${feature}.ips\` | the ${feature.replaceAll("-", " ")} |`)
  })
  let root = withOutputs(fill(readFileSync(join(templates, "composed", "prop.ips"), "utf8")))
  root = root
    .replace("//__FEATURE_LIST__", lines.list.join("\n"))
    .replace("//__IMPORTS__", lines.imports.join("\n"))
    .replace("  //__KEYS__", lines.keys.join("\n"))
    .replace("    //__SHAPE__", lines.shape.join("\n"))
    .replace("    //__SIZES__", lines.sizes.join("\n"))
    .replace("    //__CALLS__", lines.calls.join("\n"))
  write(join(target, `${stem}.ips`), root)
  write(join(target, "materials.ips"), fill(readFileSync(join(templates, "composed", "materials.ips"), "utf8")))
  files.unshift(`| \`${stem}.ips\` | the root: rolls the design, stacks the features${outputs.length ? ", reports the outputs" : ""} |`)
  files.push("| `materials.ips` | the looks the features share |")
}
const readmeOutputs = outputs.length
  ? outputs.map((output) => `- \`${output.name}\` (${output.kind}): ${output.name === "anchor" ? "where it stands on the ground" : output.kind === "rect" ? "its bounds" : "<what the game reads here>"}.`).join("\n")
  : "None: the game uses only the image."
write(join(target, "README.md"), fill(readFileSync(join(templates, "README.md"), "utf8"), { __FILES__: files.join("\n"), __OUTPUTS__: readmeOutputs }))
write(join(target, "seeds.txt"), "# Seeds to compare across revisions; add seeds that once looked wrong.\n1-24\n")

const skill = dirname(dirname(fileURLToPath(import.meta.url)))
console.log(`\nNext:\n  node ${join(skill, "scripts", "check-asset.mjs")} ${target}\n  then replace the placeholder drawing with the real object, feature by feature,\n  and add variety up to "${variety}" once it looks right (references/variety.md).`)
