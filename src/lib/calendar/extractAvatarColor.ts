// 2026-05-27 — Avatar dominant-color extraction.
//
// Per Bridget: "lets make the colors designated to each profile change
// color to match the overall color of our profile pictures, make that
// change dynamically so when we change our image, our designated color
// shifts to fit the color of it."
//
// Loads a member's avatar into a 32×32 canvas and computes a
// saturation-weighted average of the foreground pixels. Skips
// near-black + near-white pixels so transparent backgrounds + edges
// don't pull the average toward gray. Returns null on any failure
// (CORS-tainted canvas, image load error, mostly-blank avatar) so
// callers can fall back to the hashed palette.
//
// Cache lives at module level keyed by URL, so a member's color is
// extracted exactly once per session per avatar — and when they
// re-upload, the new URL becomes a new cache key and a new color is
// derived on the spot.

export interface RGB {
  r: number
  g: number
  b: number
}

// ─── HSL helpers (color-saturation boost) ─────────────────────────
//
// 2026-05-27 — Per Bridget: "matthan and richard's are very murky."
// Their avatars (dark-sphere logo + raccoon photo) extract to
// gray/brown when averaged naively, so blocks look muddy. After the
// weighted average we convert RGB → HSL, clamp saturation to a
// minimum (so washed-out grays snap to a recognizable hue) and
// clamp lightness into a mid range (so very dark or very bright
// dominants don't collapse to near-black/near-white). Then back to
// RGB for the final color string.

interface HSL { h: number; s: number; l: number }

function rgbToHsl(rgb: RGB): HSL {
  const r = rgb.r / 255
  const g = rgb.g / 255
  const b = rgb.b / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  let h = 0
  let s = 0
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0)
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h /= 6
  }
  return { h, s, l }
}

function hslToRgb(hsl: HSL): RGB {
  const { h, s, l } = hsl
  if (s === 0) {
    const v = Math.round(l * 255)
    return { r: v, g: v, b: v }
  }
  const hue2rgb = (p: number, q: number, t: number): number => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  return {
    r: Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    g: Math.round(hue2rgb(p, q, h) * 255),
    b: Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  }
}

/**
 * Boost a sampled RGB toward a vivid display tint:
 *   - Saturation clamps to ≥ minSat so gray/brown averages snap to
 *     a recognizable hue
 *   - Lightness clamps into [minL, maxL] so very dark/bright pixels
 *     don't collapse the block to near-black/near-white
 */
function boostSaturation(rgb: RGB, minSat = 0.55, minL = 0.45, maxL = 0.65): RGB {
  const hsl = rgbToHsl(rgb)
  return hslToRgb({
    h: hsl.h,
    s: Math.max(hsl.s, minSat),
    l: Math.min(maxL, Math.max(minL, hsl.l)),
  })
}

const cache = new Map<string, RGB | null>()
const inFlight = new Map<string, Promise<RGB | null>>()

export async function extractDominantColor(url: string): Promise<RGB | null> {
  if (cache.has(url)) return cache.get(url) ?? null
  const existing = inFlight.get(url)
  if (existing) return existing

  const promise = new Promise<RGB | null>((resolve) => {
    const img = new Image()
    // Required so we can read pixel data from the canvas. Most
    // Supabase Storage public URLs return permissive CORS headers;
    // failures here fall through to null + the hashed palette.
    img.crossOrigin = 'anonymous'
    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      resolve(null)
    }, 6000)

    img.onload = () => {
      if (settled) return
      clearTimeout(timer)
      settled = true
      try {
        const canvas = document.createElement('canvas')
        const size = 32
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        if (!ctx) return resolve(null)
        ctx.drawImage(img, 0, 0, size, size)
        const data = ctx.getImageData(0, 0, size, size).data
        // Weighted average — saturated mid-luminance pixels carry
        // more weight than washed-out / very dark / very light ones,
        // so logos with one dominant accent (Checkmark's gold mic)
        // surface that accent instead of the surrounding chrome.
        //
        // 2026-05-27 — tightened to drop near-gray pixels entirely
        // (sat < 0.18) so a raccoon photo / dark logo isn't sampled
        // as a wash of brown-gray. Surviving pixels get weighted by
        // sat^2 instead of (1 + sat*4) so the few truly colorful
        // pixels in a mostly-gray image still dominate the average.
        let rSum = 0
        let gSum = 0
        let bSum = 0
        let weight = 0
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i] ?? 0
          const g = data[i + 1] ?? 0
          const b = data[i + 2] ?? 0
          const a = data[i + 3] ?? 0
          if (a < 200) continue
          const mx = Math.max(r, g, b)
          const mn = Math.min(r, g, b)
          const sat = mx === 0 ? 0 : (mx - mn) / mx
          const lum = (r + g + b) / 3
          if (lum < 25 || lum > 235) continue
          if (sat < 0.18) continue
          const w = sat * sat
          rSum += r * w
          gSum += g * w
          bSum += b * w
          weight += w
        }
        if (weight < 0.5) return resolve(null)
        const avg = {
          r: Math.round(rSum / weight),
          g: Math.round(gSum / weight),
          b: Math.round(bSum / weight),
        }
        // Snap the result into a vivid display tint — washed-out
        // averages get pulled to recognizable hues, very dark / very
        // bright dominants clamped to a mid lightness band.
        resolve(boostSaturation(avg))
      } catch {
        // Tainted canvas (CORS) or any other paint failure.
        resolve(null)
      }
    }

    img.onerror = () => {
      if (settled) return
      clearTimeout(timer)
      settled = true
      resolve(null)
    }

    img.src = url
  })

  inFlight.set(url, promise)
  promise.then((result) => {
    cache.set(url, result)
    inFlight.delete(url)
  })
  return promise
}
