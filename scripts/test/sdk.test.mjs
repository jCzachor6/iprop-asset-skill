// Integration tests with the SDK: skipped unless the SDK is already available (IPROP_SDK or the
// cache). Run `node scripts/sdk.mjs` once to download it.
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import { checkSource } from "../lib/render.mjs"
import { findSdk } from "../lib/sdk.mjs"

const skill = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
let sdk = null
try {
  sdk = findSdk(undefined, { fetch: false })
} catch {}
const options = { skip: sdk ? false : "no Infinite Props SDK in IPROP_SDK or the cache (run node scripts/sdk.mjs)" }

const check = (target, extra = []) => {
  const out = mkdtempSync(join(tmpdir(), "iprop-test-out-"))
  try {
    const result = spawnSync(process.execPath, [join(skill, "scripts", "check-asset.mjs"), target, "--json", "--scan", "24", "--seeds", "1-6", "--out", out, ...extra], { encoding: "utf8", maxBuffer: 64 << 20 })
    return { status: result.status, report: JSON.parse(result.stdout), stderr: result.stderr }
  } finally {
    rmSync(out, { recursive: true, force: true })
  }
}
const warnings = (report) => report.entries.flatMap((entry) => entry.checks).filter((item) => item.level === "warn").map((item) => item.label)

test("new-asset skeletons pass check-asset with no warnings", options, () => {
  const dir = mkdtempSync(join(tmpdir(), "iprop-test-"))
  try {
    const make = (...args) => assert.equal(spawnSync(process.execPath, [join(skill, "scripts", "new-asset.mjs"), dir, ...args]).status, 0)
    make("--name", "Stone")
    make("--name", "StreetLamp", "--size", "32x64", "--composed", "--features", "base,post,lamp-head")
    make("--name", "Lantern", "--size", "32x48", "--outputs", "anchor,collider,flame,glow:circle", "--variety", "low")
    make("--name", "Shrine", "--size", "48x64", "--composed", "--features", "base,roof", "--outputs", "anchor,hitbox,offering")
    const outputs = (report) => report.entries[0].checks.find((item) => item.label === "outputs").text
    for (const name of ["stone", "street-lamp", "lantern", "shrine"]) {
      const { status, report } = check(join(dir, name))
      assert.equal(status, 0, `${name}: ${report.log.join("\n")}`)
      assert.deepEqual(warnings(report), [], `${name}: ${report.log.join("\n")}`)
      if (name === "stone" || name === "street-lamp") assert.match(outputs(report), /none declared/)
      if (name === "lantern") assert.match(outputs(report), /anchor, collider, flame, glow set/)
      if (name === "shrine") assert.match(outputs(report), /anchor, hitbox, offering set/)
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("the language snippets compile and pass", options, () => {
  const { status, report } = check(join(skill, "references", "snippets"))
  assert.equal(status, 0, report.log.join("\n"))
  assert.deepEqual(warnings(report), [], report.log.join("\n"))
})

test("every model asset compiles with the SDK", options, () => {
  for (const entry of ["tree/tree.ips", "tree/spruce.ips", "sword/sword.ips", "potion/potion.ips", "butterfly/butterfly.ips", "butterfly/forewing.ips", "butterfly/hindwing.ips", "shield/shield.ips"]) {
    assert.deepEqual(checkSource(sdk, join(skill, "examples", entry)), [], entry)
  }
  assert.deepEqual(checkSource(sdk, join(skill, "examples", "potion", "materials.ips")), [])
})

test("the lint fixtures raise the check they show", options, () => {
  const expected = { noisy: "noise", dithered: "dither", spiky: "spurs", flat: "outline", soft: "alpha", backlit: "light", tiny: "canvas" }
  for (const [fixture, code] of Object.entries(expected)) {
    const { report } = check(join(skill, "scripts", "test", "fixtures", `${fixture}.ips`))
    assert.ok(warnings(report).includes(code), `${fixture} should warn ${code}: ${warnings(report).join(", ")}`)
  }
})
