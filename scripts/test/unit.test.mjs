// Unit tests: PNG, the lint metrics on synthetic images, the variety measure, seeds, the source
// reader and the scaffold's argument checks. No SDK needed.
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import { measure, summarize } from "../lib/lint.mjs"
import { createImage, decodePng, encodePng, parseColor, pixelHash, silhouetteHash } from "../lib/png.mjs"
import { parseSeeds, readSeedFile, readSources, rolledInputs } from "../lib/render.mjs"
import { judgeVariety, levelOf, measureVariety, varietyTarget } from "../lib/variety.mjs"

const paint = (image, x, y, colour) => image.rgba.set(colour, (y * image.width + x) * 4)
const disc = (image, cx, cy, r, colour) => {
  for (let y = 0; y < image.height; y++) for (let x = 0; x < image.width; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) paint(image, x, y, colour)
}
// A lit, outlined disc: the kind of image the lint must accept.
const goodDisc = () => {
  const image = createImage(32, 32)
  disc(image, 16, 16, 11, [24, 28, 36, 255])
  disc(image, 16, 16, 10, [80, 90, 110, 255])
  disc(image, 14, 14, 7, [120, 132, 150, 255])
  disc(image, 12, 12, 3, [180, 186, 170, 255])
  return image
}

test("PNG round trip keeps every pixel", () => {
  const image = goodDisc()
  const back = decodePng(encodePng(image))
  assert.equal(back.width, 32)
  assert.equal(pixelHash(back), pixelHash(image))
  assert.equal(silhouetteHash(back), silhouetteHash(image))
  assert.deepEqual(parseColor("#9dc"), [0x99, 0xdd, 0xcc, 255])
  assert.deepEqual(parseColor("#00000000"), [0, 0, 0, 0])
})

test("a lit, outlined disc passes every lint check", () => {
  const results = summarize([1, 2, 3].map((seed) => ({ seed, metrics: measure(goodDisc()) })))
  assert.deepEqual(results.filter((item) => item.level === "warn").map((item) => item.code), [])
})

test("the lint flags noise, dithering, combs, flat shapes and backlight", () => {
  const warns = (make) => summarize([1, 2].map((seed) => ({ seed, metrics: measure(make(seed)) }))).filter((item) => item.level === "warn").map((item) => item.code)

  const noisy = (seed) => {
    const image = createImage(32, 32)
    let state = seed * 7919
    for (let y = 4; y < 28; y++) for (let x = 4; x < 28; x++) {
      state = (state * 1103515245 + 12345) >>> 0
      paint(image, x, y, [state & 255, (state >> 8) & 255, (state >> 16) & 255, 255])
    }
    return image
  }
  assert.ok(warns(noisy).includes("noise"))
  assert.ok(warns(noisy).includes("palette"))

  const dithered = () => {
    const image = createImage(32, 32)
    for (let y = 4; y < 28; y++) for (let x = 4; x < 28; x++) paint(image, x, y, (x + y) % 2 ? [60, 90, 120, 255] : [140, 170, 200, 255])
    return image
  }
  assert.ok(warns(dithered).includes("dither"))

  const comb = () => {
    const image = createImage(32, 32)
    for (let x = 4; x < 28; x++) for (let y = 22; y < 28; y++) paint(image, x, y, [100, 80, 60, 255])
    for (let x = 4; x < 28; x += 2) for (let y = 6; y < 22; y++) paint(image, x, y, [100, 80, 60, 255])
    return image
  }
  assert.ok(warns(comb).includes("spurs"))

  const flat = () => {
    const image = createImage(32, 32)
    disc(image, 16, 16, 10, [120, 130, 140, 255])
    return image
  }
  assert.ok(warns(flat).includes("outline"))

  const backlit = () => {
    const image = createImage(32, 32)
    disc(image, 16, 16, 11, [28, 38, 48, 255])
    disc(image, 16, 16, 10, [58, 74, 90, 255])
    disc(image, 19, 19, 5, [160, 176, 192, 255])
    return image
  }
  assert.ok(warns(backlit).includes("light"))
})

test("seed lists, seed files and rolled inputs", () => {
  assert.deepEqual(parseSeeds("1-3,7, 9"), [1, 2, 3, 7, 9])
  assert.throws(() => parseSeeds("a-b"))
  const dir = mkdtempSync(join(tmpdir(), "iprop-unit-"))
  try {
    writeFileSync(join(dir, "seeds.txt"), "# keep these\n7\n19 37\n1-2\n")
    assert.deepEqual(readSeedFile(join(dir, "seeds.txt")), [7, 19, 37, 1, 2])
    const rolled = rolledInputs(`// style  0 rolls a style; 1 a, 2 b
asset A {
  input u32 style = 0
  input u32 kind = 0          // 0 rolls; 1 big
  input color tint = #00000000 // transparent rolls one
  input u32 shadow = 1        // 1 casts a shadow
  draw { }
}`)
    assert.deepEqual([...rolled].sort(), ["kind", "style", "tint"])
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("the source reader finds entries, parts, libraries and missing imports", () => {
  const dir = mkdtempSync(join(tmpdir(), "iprop-unit-"))
  try {
    mkdirSync(join(dir, "parts"))
    writeFileSync(join(dir, "lamp.ips"), 'import head from "parts/head.ips"\nimport looks from "materials.ips"\nasset Lamp { size 8x8 draw { } }\n')
    writeFileSync(join(dir, "parts", "head.ips"), 'import ghost from "ghost.ips"\nasset Head { size 8x8 draw { } }\n')
    writeFileSync(join(dir, "materials.ips"), "material Brass {\n  base = #a07a40\n}\n")
    writeFileSync(join(dir, "spare.ips"), "material Unused {\n  base = #ffffff\n}\n")
    const sources = readSources(dir)
    assert.deepEqual(sources.entries.map((file) => file.path), ["lamp.ips"])
    assert.deepEqual(sources.parts.map((file) => file.path), ["parts/head.ips"])
    assert.deepEqual(sources.libraries.map((file) => file.path).sort(), ["materials.ips", "spare.ips"])
    assert.deepEqual(sources.unusedLibraries.map((file) => file.path), ["spare.ips"])
    assert.deepEqual(sources.missing, [{ from: "parts/head.ips", import: "ghost.ips" }])
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("the variety measure counts silhouette groups and colour schemes", () => {
  // One disc in one colour, seed after seed: low on both axes.
  const same = Array.from({ length: 40 }, () => goodDisc())
  const low = measureVariety(same)
  assert.equal(low.shapes.groups, 1)
  assert.equal(low.colours.groups, 1)
  assert.equal(low.level, "low")
  // Discs that move across the canvas in many hues: many groups on both axes.
  const varied = Array.from({ length: 40 }, (_, i) => {
    const image = createImage(64, 64)
    const hue = (i * 47) % 360
    const rgb = [0, 120, 240].map((shift) => Math.round(127 + 120 * Math.cos(((hue - shift) * Math.PI) / 180)))
    disc(image, 8 + (i % 8) * 6, 8 + Math.floor(i / 8) * 10, 6, [...rgb, 255])
    return image
  })
  const rich = measureVariety(varied)
  assert.ok(rich.shapes.common >= 20, JSON.stringify(rich.shapes))
  assert.ok(rich.colours.common >= 8, JSON.stringify(rich.colours))
  assert.equal(rich.level, "extreme")
  assert.deepEqual([3, 4, 7, 8, 19, 20].map(levelOf), [0, 1, 1, 2, 2, 3])
})

test("the variety target comes from the header and is judged both ways", () => {
  assert.equal(varietyTarget("// shield.ips\n// Variety: High (see references)\nasset Shield {"), "high")
  assert.equal(varietyTarget("asset Shield {}"), null)
  const at = (level) => ({ level, shapes: { common: 5, groups: 9, largest: 0.4, level: 1 }, colours: { common: 5, groups: 9, largest: 0.4, level: 1 } })
  assert.equal(judgeVariety(at("medium"), "high")[0], "warn")
  assert.match(judgeVariety(at("medium"), "high")[1], /add shape families/)
  assert.equal(judgeVariety(at("medium"), "medium")[0], "ok")
  assert.equal(judgeVariety(at("medium"), null)[0], "ok")
  assert.equal(judgeVariety(at("extreme"), "medium")[0], "warn")
  assert.equal(judgeVariety(at("high"), "medium")[0], "ok")
})

test("new-asset refuses names the template already uses and unknown levels", () => {
  const script = join(dirname(fileURLToPath(import.meta.url)), "..", "new-asset.mjs")
  const dir = mkdtempSync(join(tmpdir(), "iprop-unit-"))
  try {
    const run = (...args) => spawnSync(process.execPath, [script, dir, "--name", "Totem", ...args], { encoding: "utf8" })
    assert.equal(run("--composed", "--features", "shape,post").status, 2)
    assert.equal(run("--composed", "--features", "main").status, 2)
    assert.equal(run("--outputs", "half").status, 2)
    assert.equal(run("--outputs", "glow:sphere").status, 2)
    assert.equal(run("--variety", "huge").status, 2)
    assert.equal(run("--composed", "--features", "base,post", "--outputs", "anchor,grip").status, 0)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
