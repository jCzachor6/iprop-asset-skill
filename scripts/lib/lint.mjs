// Pixel-art lint: measurable symptoms of the mistakes that make generated props look worse. It is
// advice for the review, never a gate. references/pixel-art.md explains every code and its fixes.
//
// "Solid" pixels have alpha >= 128. An edge pixel is a solid pixel next to a non-solid 4-neighbour.

// Per-image limits; a check warns when enough seeds pass them (see summarize).
export const LIMITS = {
  noise: 0.12, // most: share of interior pixels unlike all 8 neighbours
  dither: 0.01, // most: share of 3x3 windows alternating two colours like a checkerboard
  spurs: 0.12, // most: share of solid pixels one pixel thin across
  palette: 0.12, // most: share of solid pixels in colours used at most twice
  alpha: 0.25, // most: share of the outer boundary that fades out in an alpha gradient
  outline: 0.35, // least: share of edge pixels that contrast with the tone inside them
  light: -0.2, // least: how far the bright pixels sit towards the upper left, in sprite radii
  canvas: 0.08, // least: share of the canvas covered by the drawing's bounding box
}
const LEAST = new Set(["outline", "light", "canvas"])

export const CODES = Object.keys(LIMITS)
// The realistic style (soft gradients, glows, fine strands) keeps only the checks that apply to it.
export const STYLE_CODES = { pixel: CODES, realistic: ["light", "canvas"] }

const SPECK = 30 // RGB distance below which two pixels count as the same tone
const CONTRAST = 8 // luminance step between an edge and the tone inside it

const luma = (rgba, i) => rgba[i] * 0.299 + rgba[i + 1] * 0.587 + rgba[i + 2] * 0.114
const distance = (rgba, i, j) => Math.hypot(rgba[i] - rgba[j], rgba[i + 1] - rgba[j + 1], rgba[i + 2] - rgba[j + 2])

/** Metrics of one image ({ width, height, rgba }), each with an example position where it applies. */
export const measure = ({ width, height, rgba }) => {
  const at = (x, y) => (y * width + x) * 4
  const inside = (x, y) => x >= 0 && y >= 0 && x < width && y < height
  const solid = (x, y) => inside(x, y) && rgba[at(x, y) + 3] >= 128
  const empty = (x, y) => !inside(x, y) || !rgba[at(x, y) + 3]
  const colour = (x, y) => rgba.readUInt32BE(at(x, y))
  const counts = new Map()
  let solidCount = 0, sumX = 0, sumY = 0, sumLuma = 0
  let minX = width, minY = height, maxX = -1, maxY = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = at(x, y)
      if (rgba[i + 3]) [minX, minY, maxX, maxY] = [Math.min(minX, x), Math.min(minY, y), Math.max(maxX, x), Math.max(maxY, y)]
      if (!solid(x, y)) continue
      solidCount++
      sumX += x
      sumY += y
      sumLuma += luma(rgba, i)
      counts.set(colour(x, y), (counts.get(colour(x, y)) ?? 0) + 1)
    }
  }
  const metrics = { solid: solidCount, colours: counts.size }
  if (!solidCount) return metrics

  const meanLuma = sumLuma / solidCount
  const [cx, cy] = [sumX / solidCount, sumY / solidCount]
  let interior = 0, specks = 0, speckAt = null
  let windows = 0, checks = 0, checkAt = null
  let thin = 0, thinAt = null
  let rare = 0, rareAt = null
  let edges = 0, soft = 0, softAt = null, contrasted = 0, compared = 0, flatAt = null
  let weight = 0, wx = 0, wy = 0
  const neighbours = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]]
  const sides = [[0, -1], [-1, 0], [0, 1], [1, 0]]

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = at(x, y)
      // Soft, anti-aliased edges: a semi-transparent pixel on the outside of the drawing whose
      // alpha changes towards a neighbour. A flat translucent shadow keeps one alpha and passes.
      const alphaAt = (px, py) => (empty(px, py) ? 0 : rgba[at(px, py) + 3])
      if (rgba[i + 3] && rgba[i + 3] < 255 && sides.some(([dx, dy]) => empty(x + dx, y + dy)) &&
        sides.some(([dx, dy]) => alphaAt(x + dx, y + dy) && alphaAt(x + dx, y + dy) !== rgba[i + 3])) {
        soft++
        softAt ??= [x, y]
      }
      if (!solid(x, y)) continue
      const tone = luma(rgba, i)
      // Light: where the brighter-than-average pixels sit relative to the whole shape.
      if (tone > meanLuma) [weight, wx, wy] = [weight + tone - meanLuma, wx + (tone - meanLuma) * x, wy + (tone - meanLuma) * y]
      if (counts.get(colour(x, y)) <= 2) {
        rare++
        rareAt ??= [x, y]
      }
      if ((!solid(x - 1, y) && !solid(x + 1, y)) || (!solid(x, y - 1) && !solid(x, y + 1))) {
        thin++
        thinAt ??= [x, y]
      }
      if (neighbours.every(([dx, dy]) => solid(x + dx, y + dy))) {
        interior++
        if (neighbours.every(([dx, dy]) => distance(rgba, i, at(x + dx, y + dy)) > SPECK)) {
          specks++
          speckAt ??= [x, y]
        }
      }
      // Dithering: a 3x3 block alternating two colours like a checkerboard.
      if (solid(x + 2, y + 2) && solid(x + 2, y) && solid(x, y + 2)) {
        windows++
        const [a, b] = [colour(x, y), colour(x + 1, y)]
        let alternating = a !== b
        for (let j = 0; j < 3 && alternating; j++) {
          for (let k = 0; k < 3 && alternating; k++) {
            if (!solid(x + k, y + j) || colour(x + k, y + j) !== ((j + k) % 2 ? b : a)) alternating = false
          }
        }
        if (alternating) {
          checks++
          checkAt ??= [x, y]
        }
      }
      // Edge contrast: an outline (darker) or a rim light (lighter) against the tone inside it.
      // Thick outlines are skipped over: walk inwards past the edge colour, up to three pixels.
      const side = sides.find(([dx, dy]) => !solid(x + dx, y + dy))
      if (side) {
        edges++
        let [ix, iy, steps] = [x - side[0], y - side[1], 0]
        while (steps < 3 && solid(ix, iy) && colour(ix, iy) === colour(x, y)) [ix, iy, steps] = [ix - side[0], iy - side[1], steps + 1]
        if (solid(ix, iy)) {
          compared++
          if (colour(ix, iy) !== colour(x, y) && Math.abs(tone - luma(rgba, at(ix, iy))) >= CONTRAST) contrasted++
          else flatAt ??= [x, y]
        }
      }
    }
  }

  const radius = Math.sqrt(solidCount / Math.PI)
  const light = weight ? (-(wx / weight - cx) - (wy / weight - cy)) / Math.SQRT2 / radius : 0
  const covered = (maxX - minX + 1) * (maxY - minY + 1)
  return {
    ...metrics,
    noise: { value: interior ? specks / interior : 0, at: speckAt },
    dither: { value: windows ? checks / windows : 0, at: checkAt },
    spurs: { value: thin / solidCount, at: thinAt },
    palette: { value: rare / solidCount, at: rareAt },
    alpha: { value: soft + edges ? soft / (soft + edges) : 0, at: softAt },
    outline: { value: compared ? contrasted / compared : 1, at: flatAt },
    light: { value: light, at: null },
    canvas: { value: covered / (width * height), at: null },
  }
}

const passes = (code, value) => (LEAST.has(code) ? value < LIMITS[code] : value > LIMITS[code])
const farPast = (code, value) => (code === "light" ? value < LIMITS.light * 2 : LEAST.has(code) ? value < LIMITS[code] / 2 : value > LIMITS[code] * 2)

const MESSAGES = {
  noise: "isolated single pixels (texture reads as static)",
  dither: "checkerboard dithering",
  spurs: "one-pixel-thin strands and spikes",
  palette: "many colours used by one or two pixels (smooth gradients or noise, not a tone ramp)",
  alpha: "soft, semi-transparent silhouette edges",
  outline: "silhouette edge blends into the inside (no outline or rim light)",
  light: "the bright side faces the lower right instead of the upper left",
  canvas: "the drawing covers a small part of the canvas",
}

const format = (code, value) =>
  code === "light" ? value.toFixed(2) : LEAST.has(code) ? `${Math.round(value * 100)}%` : `${(value * 100).toFixed(1)}%`

/**
 * Lint results for a set of renders: [{ seed, metrics }]. A check warns when at least a fifth of the
 * seeds (and at least two) pass its limit, or one seed passes it far.
 */
export const summarize = (renders, { style = "pixel", off = [] } = {}) => {
  const codes = (STYLE_CODES[style] ?? CODES).filter((code) => !off.includes(code))
  const results = []
  for (const code of codes) {
    const values = renders.filter((render) => render.metrics[code]).map((render) => ({ seed: render.seed, ...render.metrics[code] }))
    if (!values.length) continue
    const bad = values.filter((entry) => passes(code, entry.value))
    const warn = bad.length >= Math.max(2, values.length / 5) || bad.some((entry) => farPast(code, entry.value))
    const typical = values.map((entry) => entry.value).sort((a, b) => a - b)[Math.floor(values.length / 2)]
    bad.sort((a, b) => (LEAST.has(code) ? a.value - b.value : b.value - a.value))
    results.push({
      code,
      level: warn ? "warn" : "ok",
      typical,
      limit: LIMITS[code],
      seeds: bad.map((entry) => entry.seed),
      text: warn
        ? `${MESSAGES[code]}: ${bad.length}/${values.length} seeds past ${format(code, LIMITS[code])}, worst seed ${bad[0].seed} ${format(code, bad[0].value)}${bad[0].at ? ` at (${bad[0].at.join(",")})` : ""}`
        : `typical ${format(code, typical)} (limit ${format(code, LIMITS[code])})`,
    })
  }
  return results
}
