// Measures how far seeds differ, for the variety levels of references/variety.md. Two axes, each a
// greedy grouping of the scanned seeds:
// - silhouettes: two seeds share a group when their covered pixels overlap by SHAPE_OVERLAP or more
//   (intersection over union), so proportions that drift a little stay in one group;
// - colours: two seeds share a scheme when their colour histograms (neutral tones in four lightness
//   bins, weighted down; coloured ones in twelve hues times two lightness bins) have COLOUR_OVERLAP
//   or more in common.
// An axis counts the groups that cover 90% of the seeds: the looks a player meets often. Rare looks
// show in the total. The bands were set on the skill's examples over 200 seeds: the scaffolds and
// the crate are medium, the shield and the sword high, the potion, the tree and the butterfly extreme.

export const LEVELS = ["low", "medium", "high", "extreme"]
export const SHAPE_OVERLAP = 0.8
export const COLOUR_OVERLAP = 0.7
// The most common groups an axis may have at each level: up to 3 is low, up to 7 medium, up to 19 high.
const BANDS = [3, 7, 19]
const COMMON = 0.9
const SOLID = 128
const NEUTRAL_WEIGHT = 0.35

/** The covered pixels of an image (alpha >= 128), one byte each. */
export const coverage = ({ width, height, rgba }) => {
  const mask = new Uint8Array(width * height)
  for (let i = 0; i < mask.length; i++) mask[i] = rgba[i * 4 + 3] >= SOLID ? 1 : 0
  return mask
}

/** Intersection over union of two coverage masks (1 when both are empty). */
export const overlapOfShapes = (a, b) => {
  let both = 0
  let either = 0
  for (let i = 0; i < a.length; i++) {
    if (a[i] | b[i]) {
      either++
      both += a[i] & b[i]
    }
  }
  return either ? both / either : 1
}

/** A normalised colour histogram of the covered pixels: 4 neutral bins, then 12 hues x 2 lightness. */
export const colourHistogram = ({ rgba }) => {
  const bins = new Float64Array(28)
  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i + 3] < SOLID) continue
    const r = rgba[i] / 255
    const g = rgba[i + 1] / 255
    const b = rgba[i + 2] / 255
    const max = Math.max(r, g, b)
    const chroma = max - Math.min(r, g, b)
    if (chroma < 0.12 || max < 0.12) {
      bins[Math.min(3, Math.floor(max * 4))] += NEUTRAL_WEIGHT
      continue
    }
    let hue = max === r ? (g - b) / chroma : max === g ? 2 + (b - r) / chroma : 4 + (r - g) / chroma
    hue = (((hue / 6) % 1) + 1) % 1
    bins[4 + (Math.floor(hue * 12) % 12) + (max < 0.55 ? 0 : 12)] += 1
  }
  const total = bins.reduce((sum, value) => sum + value, 0)
  if (total) for (let i = 0; i < bins.length; i++) bins[i] /= total
  return bins
}

/** The share two colour histograms have in common, from 0 to 1. */
export const overlapOfColours = (a, b) => {
  let shared = 0
  for (let i = 0; i < a.length; i++) shared += Math.min(a[i], b[i])
  return shared
}

/** Greedy groups: each item joins the first group whose first item it resembles. Sizes, largest first. */
export const group = (items, resembles) => {
  const firsts = []
  const sizes = []
  for (const item of items) {
    const index = firsts.findIndex((first) => resembles(first, item))
    if (index < 0) {
      firsts.push(item)
      sizes.push(1)
    } else sizes[index]++
  }
  return sizes.sort((a, b) => b - a)
}

/** How many of the largest groups it takes to cover `share` of the items. */
const covering = (sizes, share) => {
  const total = sizes.reduce((sum, size) => sum + size, 0)
  let covered = 0
  for (let i = 0; i < sizes.length; i++) {
    covered += sizes[i]
    if (covered >= total * share) return i + 1
  }
  return sizes.length
}

/** The level index (0 low .. 3 extreme) of an axis with this many common groups. */
export const levelOf = (common) => {
  const index = BANDS.findIndex((most) => common <= most)
  return index < 0 ? BANDS.length : index
}

/** Silhouette groups and colour schemes among rendered seeds, and the level each axis reaches. */
export const measureVariety = (images) => {
  const axis = (sizes) => {
    const common = covering(sizes, COMMON)
    return { groups: sizes.length, common, largest: images.length ? sizes[0] / images.length : 0, level: levelOf(common) }
  }
  const shapes = axis(group(images.map(coverage), (a, b) => overlapOfShapes(a, b) >= SHAPE_OVERLAP))
  const colours = axis(group(images.map(colourHistogram), (a, b) => overlapOfColours(a, b) >= COLOUR_OVERLAP))
  // A prop reaches a level through both axes: the mean of the two, rounded up, so a shape-rich prop
  // in one colour (or a colour-rich prop with one shape) sits a level below its richer axis.
  const level = Math.ceil((shapes.level + colours.level) / 2)
  return { seeds: images.length, shapes, colours, level: LEVELS[level] }
}

/** The target level named in an entry's header comment ("// Variety: high"), or null. */
export const varietyTarget = (content) => content.match(/^\s*\/\/\s*Variety:\s*(low|medium|high|extreme)\b/im)?.[1].toLowerCase() ?? null

/** [level, text] for a check line: the measured variety against the target. */
export const judgeVariety = (measured, target) => {
  const count = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`
  const describe = (name, word, axis) =>
    `${name} ${LEVELS[axis.level]} (${count(axis.common, word)} for 90% of seeds, ${axis.groups} in all, the largest ${Math.round(axis.largest * 100)}%)`
  const text = `${measured.level}: ${describe("silhouettes", "group", measured.shapes)}, ${describe("colours", "scheme", measured.colours)}`
  if (!target) return ["ok", text]
  const want = LEVELS.indexOf(target)
  const got = LEVELS.indexOf(measured.level)
  if (got < want) {
    const poorer = measured.shapes.level <= measured.colours.level ? "shape families and proportions" : "colour families and materials"
    return ["warn", `${target} asked, ${text}; add ${poorer} (references/variety.md)`]
  }
  if (got > want + 1) return ["warn", `${target} asked, ${text}; seeds differ more than asked: narrow the families or the colour ranges`]
  return ["ok", `${target} asked, ${text}`]
}
