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
          const w = 1 + sat * 4
          rSum += r * w
          gSum += g * w
          bSum += b * w
          weight += w
        }
        if (weight < 5) return resolve(null)
        resolve({
          r: Math.round(rSum / weight),
          g: Math.round(gSum / weight),
          b: Math.round(bSum / weight),
        })
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
