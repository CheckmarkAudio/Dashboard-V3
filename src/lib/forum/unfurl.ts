// 2026-05-20 — Client wrapper for the `unfurl-link` edge function.
//
// Used by MediaPicker when an admin adds a link attachment so the
// resulting `ChatAttachment` carries `{preview: {title, description,
// image, site_name}}` for rich rendering in the message bubble.
// Best-effort: failures resolve to `null` so the link still gets
// added (it'll render as the basic link card without preview).

import { supabase } from '../supabase'

export interface UnfurledPreview {
  title?: string | null
  description?: string | null
  image?: string | null
  site_name?: string | null
}

/**
 * Fetch OG/Twitter metadata for a URL via our edge function.
 * Returns null on any error so the caller can degrade gracefully.
 */
export async function unfurlLink(url: string): Promise<UnfurledPreview | null> {
  try {
    const { data, error } = await supabase.functions.invoke<{
      ok: boolean
      preview?: UnfurledPreview & { url: string }
      error?: string
    }>('unfurl-link', { body: { url } })
    if (error) return null
    if (data?.preview) {
      const p = data.preview
      // Only return a preview if at least one field is populated;
      // otherwise the caller gets a fully-empty object that adds
      // nothing to the render.
      if (p.title || p.description || p.image || p.site_name) {
        return {
          title: p.title ?? null,
          description: p.description ?? null,
          image: p.image ?? null,
          site_name: p.site_name ?? null,
        }
      }
    }
    return null
  } catch {
    return null
  }
}
