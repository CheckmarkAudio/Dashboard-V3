// 2026-05-25 — Client-side image compression for forum uploads.
//
// Phone photos routinely arrive at 3–5 MB. At chat-bubble resolution we
// never need more than ~1920px on the long edge, and JPEG q=0.82 is
// visually identical to the original at that size. Compressing in the
// browser before upload preserves Supabase free-tier storage (~95%
// reduction on typical phone photos) and cuts upload time on slow
// mobile connections.
//
// Skip conditions:
//   - GIF: animation would be lost on canvas re-encode
//   - already-small files (<500 KB): savings not worth the CPU
//   - decode failure (HEIC, exotic format): return original, let the
//     server-side bucket allow-list reject if needed
//   - re-encoded blob ends up larger than the original: return original

const MAX_LONG_EDGE = 1920
const JPEG_QUALITY = 0.82
const WEBP_QUALITY = 0.82
const SKIP_BELOW_BYTES = 500 * 1024

/**
 * Return a compressed copy of `file` when beneficial, otherwise the
 * original file. Never throws — any failure falls back to the original
 * so an exotic encoding can't break the upload path.
 */
export async function compressImageIfBeneficial(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file
  if (file.type === 'image/gif') return file
  if (file.size < SKIP_BELOW_BYTES) return file

  try {
    const bitmap = await createImageBitmap(file)
    const longEdge = Math.max(bitmap.width, bitmap.height)
    const scale = longEdge > MAX_LONG_EDGE ? MAX_LONG_EDGE / longEdge : 1
    const targetW = Math.round(bitmap.width * scale)
    const targetH = Math.round(bitmap.height * scale)

    // PNG stays PNG to preserve alpha; everything else encodes to JPEG.
    // (WEBP source → WEBP output keeps it slim while honoring alpha too.)
    const outMime =
      file.type === 'image/png' ? 'image/png' :
      file.type === 'image/webp' ? 'image/webp' :
      'image/jpeg'
    const quality =
      outMime === 'image/jpeg' ? JPEG_QUALITY :
      outMime === 'image/webp' ? WEBP_QUALITY :
      undefined // PNG: quality arg is ignored

    const canvas = document.createElement('canvas')
    canvas.width = targetW
    canvas.height = targetH
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      bitmap.close()
      return file
    }
    ctx.drawImage(bitmap, 0, 0, targetW, targetH)
    bitmap.close()

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, outMime, quality),
    )
    if (!blob) return file
    if (blob.size >= file.size) return file

    return new File([blob], file.name, {
      type: outMime,
      lastModified: file.lastModified,
    })
  } catch {
    return file
  }
}
