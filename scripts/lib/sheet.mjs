// Contact sheets: many seeds side by side at an integer zoom (nearest neighbour, so pixels stay
// crisp), each labelled with its seed. Pages stay within MAX_SIDE so a model sees them unscaled.
import { createImage, parseColor } from "./png.mjs"
import { drawText, textWidth, TEXT_HEIGHT } from "./font.mjs"

export const MAX_SIDE = 1568
const GAP = 12
const LABEL_SCALE = 2
const LABEL_HEIGHT = TEXT_HEIGHT * LABEL_SCALE + 6
const BACKGROUNDS = { dark: "#1b1f24", light: "#eaeae6", mid: "#767b82" }
const OVERLAY = { rect: [255, 61, 240, 255], circle: [64, 224, 255, 255], point: [255, 214, 64, 255] }

/** The smallest zoom worth looking at: small props need more. */
export const minimumZoom = (width, height) => {
  const side = Math.max(width, height)
  return side <= 48 ? 4 : side <= 96 ? 3 : side <= 160 ? 2 : 1
}

const paintBackground = (image, background) => {
  if (background === "checker") {
    const [a, b] = [parseColor("#2c3036"), parseColor("#3a3f46")]
    for (let y = 0; y < image.height; y++) {
      for (let x = 0; x < image.width; x++) image.rgba.set(((x >> 3) + (y >> 3)) & 1 ? a : b, (y * image.width + x) * 4)
    }
    return
  }
  const colour = parseColor(BACKGROUNDS[background] ?? background)
  for (let i = 0; i < image.width * image.height; i++) image.rgba.set(colour, i * 4)
}

const textColour = (background) => {
  const [r, g, b] = background === "checker" ? [44, 48, 54] : parseColor(BACKGROUNDS[background] ?? background)
  return r * 0.3 + g * 0.59 + b * 0.11 > 140 ? [40, 40, 44, 255] : [200, 204, 210, 255]
}

/** Draws `image` scaled by `zoom` into `sheet` at (left, top), alpha over the background. */
export const blit = (sheet, image, left, top, zoom) => {
  for (let y = 0; y < image.height * zoom; y++) {
    const ty = top + y
    if (ty < 0 || ty >= sheet.height) continue
    for (let x = 0; x < image.width * zoom; x++) {
      const tx = left + x
      if (tx < 0 || tx >= sheet.width) continue
      const from = (Math.floor(y / zoom) * image.width + Math.floor(x / zoom)) * 4
      const alpha = image.rgba[from + 3] / 255
      if (!alpha) continue
      const to = (ty * sheet.width + tx) * 4
      for (let c = 0; c < 3; c++) sheet.rgba[to + c] = Math.round(image.rgba[from + c] * alpha + sheet.rgba[to + c] * (1 - alpha))
    }
  }
}

const plot = (sheet, x, y, colour) => {
  x = Math.round(x)
  y = Math.round(y)
  if (x >= 0 && y >= 0 && x < sheet.width && y < sheet.height) sheet.rgba.set(colour, (y * sheet.width + x) * 4)
}

/** Outlines of an asset's outputs (ipgen's outputs JSON) over a cell drawn at (left, top) with zoom. */
const drawOutputs = (sheet, outputs, left, top, zoom) => {
  for (const output of outputs ?? []) {
    const colour = OVERLAY[output.kind] ?? OVERLAY.point
    for (const value of output.values ?? []) {
      if (output.kind === "rect") {
        const [x0, y0, x1, y1] = [left + value.x * zoom, top + value.y * zoom, left + (value.x + value.w) * zoom - 1, top + (value.y + value.h) * zoom - 1]
        for (let x = x0; x <= x1; x++) [plot(sheet, x, y0, colour), plot(sheet, x, y1, colour)]
        for (let y = y0; y <= y1; y++) [plot(sheet, x0, y, colour), plot(sheet, x1, y, colour)]
      } else if (output.kind === "circle") {
        const steps = Math.max(24, Math.ceil(value.r * zoom * 6.3))
        for (let i = 0; i < steps; i++) {
          const angle = (i / steps) * Math.PI * 2
          plot(sheet, left + (value.x + Math.cos(angle) * value.r) * zoom, top + (value.y + Math.sin(angle) * value.r) * zoom, colour)
        }
      } else {
        const [cx, cy] = [left + value.x * zoom, top + value.y * zoom]
        for (let d = -4; d <= 4; d++) [plot(sheet, cx + d, cy, colour), plot(sheet, cx, cy + d, colour)]
      }
    }
  }
}

/**
 * Pages of a sheet. cells: [{ image, label, outputs }] in row-major order. With rowLabels (a sweep),
 * each row holds cells.length / rowLabels.length cells and keeps its label; otherwise the cells wrap
 * into as many columns as fit. Returns [{ image, cells, zoom, columns }].
 */
export const buildSheets = (cells, options = {}) => {
  const { rowLabels = null, background = "dark", overlay = false, realSize = false, maxSide = MAX_SIDE } = options
  if (!cells.length) return []
  const width = Math.max(...cells.map((cell) => cell.image.width))
  const height = Math.max(...cells.map((cell) => cell.image.height))
  const left = rowLabels ? Math.max(...rowLabels.map((label) => textWidth(label, LABEL_SCALE))) + GAP : 0
  const strip = realSize ? height + LABEL_HEIGHT + GAP : 0
  const size = (zoom, columns, rows) => ({
    width: left + columns * (width * zoom + GAP) + GAP,
    height: rows * (height * zoom + LABEL_HEIGHT + GAP) + GAP + strip,
  })
  const fits = (box) => box.width <= maxSide && box.height <= maxSide
  const smallest = Math.min(options.zoom ?? minimumZoom(width, height), Math.max(1, Math.floor((maxSide - 2 * GAP - left) / width)))
  const largest = options.zoom ?? 8

  // Sweeps keep one row per value; plain sheets wrap. Prefer one page at the largest zoom, roughly 4:3.
  const perRow = rowLabels ? cells.length / rowLabels.length : null
  for (let zoom = largest; zoom >= smallest; zoom--) {
    let best = null
    const candidates = perRow ? [perRow] : options.columns ? [options.columns] : Array.from({ length: cells.length }, (_, i) => i + 1)
    for (const columns of candidates) {
      const box = size(zoom, columns, rowLabels ? rowLabels.length : Math.ceil(cells.length / columns))
      if (!fits(box)) continue
      const score = Math.abs(box.width / box.height - 4 / 3)
      if (!best || score < best.score) best = { columns, score }
    }
    if (best) return [renderPage(cells, { ...options, zoom, columns: best.columns, width, height, left })]
  }

  // Too many for one page: split at the smallest zoom.
  const zoom = smallest
  let columns = perRow ?? options.columns ?? 1
  if (!perRow && !options.columns) while (fits(size(zoom, columns + 1, 1))) columns++
  let rows = 1
  while (fits(size(zoom, columns, rows + 1))) rows++
  const pages = []
  if (perRow) {
    // A sweep too large for one page: split its seeds (columns) and its rows.
    const seedsPerPage = Math.max(1, Math.min(perRow, Math.floor((maxSide - left - GAP) / (width * zoom + GAP))))
    for (let r = 0; r < rowLabels.length; r += rows) {
      for (let c = 0; c < perRow; c += seedsPerPage) {
        const pageRows = rowLabels.slice(r, r + rows)
        const pageCells = pageRows.flatMap((_, i) => cells.slice((r + i) * perRow + c, (r + i) * perRow + Math.min(perRow, c + seedsPerPage)))
        pages.push(renderPage(pageCells, { ...options, rowLabels: pageRows, zoom, columns: pageCells.length / pageRows.length, width, height, left }))
      }
    }
  } else {
    for (let start = 0; start < cells.length; start += columns * rows) {
      pages.push(renderPage(cells.slice(start, start + columns * rows), { ...options, zoom, columns, width, height, left: 0 }))
    }
  }
  return pages
}

const renderPage = (cells, { rowLabels, background = "dark", overlay, realSize, zoom, columns, width, height, left }) => {
  const rows = Math.ceil(cells.length / columns)
  const strip = realSize ? height + LABEL_HEIGHT + GAP : 0
  const sheet = createImage(left + columns * (width * zoom + GAP) + GAP, rows * (height * zoom + LABEL_HEIGHT + GAP) + GAP + strip)
  paintBackground(sheet, background)
  const ink = textColour(background)
  cells.forEach((cell, index) => {
    const [column, row] = [index % columns, Math.floor(index / columns)]
    const x = left + GAP + column * (width * zoom + GAP)
    const y = GAP + row * (height * zoom + LABEL_HEIGHT + GAP)
    if (cell.label != null) drawText(sheet, cell.label, x, y, ink, LABEL_SCALE)
    const [ox, oy] = [x + Math.floor(((width - cell.image.width) * zoom) / 2), y + LABEL_HEIGHT + Math.floor(((height - cell.image.height) * zoom) / 2)]
    blit(sheet, cell.image, ox, oy, zoom)
    if (overlay) drawOutputs(sheet, cell.outputs, ox, oy, zoom)
  })
  rowLabels?.forEach((label, row) => drawText(sheet, label, GAP, GAP + row * (height * zoom + LABEL_HEIGHT + GAP) + LABEL_HEIGHT + 2, ink, LABEL_SCALE))
  if (realSize) {
    const top = rows * (height * zoom + LABEL_HEIGHT + GAP) + GAP
    drawText(sheet, "1X", GAP, top, ink, LABEL_SCALE)
    let x = left + GAP
    for (const cell of cells) {
      if (x + cell.image.width > sheet.width - GAP) break
      blit(sheet, cell.image, x, top + LABEL_HEIGHT, 1)
      x += cell.image.width + 4
    }
  }
  return { image: sheet, cells: cells.map((cell) => cell.label), zoom, columns }
}
