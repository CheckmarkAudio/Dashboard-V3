// 2026-05-21 (PR B — forum drag/paste/parallel) — Shared forum file
// upload helper.
//
// Pulled out of MediaPicker so the +Media button AND the new
// drag-anywhere dropzone AND the Cmd+V paste-image handler all
// share one upload code path. Discord-style fast feel relies on
// running uploads in parallel + giving the user instant feedback,
// and that's easier when the call site is just `uploadForumFile()`.
//
// Errors throw so callers can `try/catch + toast` in component
// land. Returns the `ChatAttachment` ready to be appended to
// `pendingAttachments` in Content.tsx.

import { supabase } from '../supabase'
import {
  buildForumMediaPath,
  FORUM_AUDIO_MIME,
  FORUM_IMAGE_MIME,
  FORUM_MAX_BYTES,
  FORUM_MEDIA_BUCKET,
  FORUM_VIDEO_MIME,
  type AttachmentKind,
  type ChatAttachment,
} from './attachments'
import { compressImageIfBeneficial } from './compressImage'

export interface UploadForumFileOpts {
  file: File
  /** Force a specific kind. When omitted we infer from file.type. */
  kind?: 'image' | 'video' | 'audio'
  channelId: string
  userId: string
}

/**
 * Infer kind from the file's MIME type. Returns null if the file
 * doesn't look like image / video / audio — caller should reject.
 */
export function inferForumKind(file: File): 'image' | 'video' | 'audio' | null {
  const t = file.type
  if (!t) return null
  if (t.startsWith('image/')) return 'image'
  if (t.startsWith('video/')) return 'video'
  if (t.startsWith('audio/')) return 'audio'
  return null
}

/**
 * Upload one file to the forum-media bucket + return the
 * ChatAttachment ready for `pendingAttachments`. Throws on bad MIME,
 * oversized, or storage error so the caller can map → toast.
 */
export async function uploadForumFile(
  opts: UploadForumFileOpts,
): Promise<ChatAttachment> {
  const { channelId, userId } = opts
  // 2026-05-25 — Compress images client-side BEFORE MIME validation +
  // size check so a 4 MB phone photo is gated on its compressed size,
  // not the original. Compression returns the original file unchanged
  // for GIFs, sub-500KB files, or any decode failure, so non-image
  // kinds + edge cases flow through untouched.
  const file = opts.kind === 'image' || opts.kind === undefined
    ? await compressImageIfBeneficial(opts.file)
    : opts.file
  const kind: AttachmentKind | null = opts.kind ?? inferForumKind(file)
  if (kind !== 'image' && kind !== 'video' && kind !== 'audio') {
    throw new Error(`Unsupported file type${file.type ? ` (${file.type})` : ''}.`)
  }

  // Permissive MIME validation — explicit allow-list catches the
  // named variants; the `family/` prefix fallback rescues legitimate
  // files browsers report with unusual subtypes (e.g. `audio/mp3`
  // instead of `audio/mpeg`). Server-side bucket allow-list is the
  // real gate.
  const allowedMime =
    kind === 'image' ? FORUM_IMAGE_MIME :
    kind === 'video' ? FORUM_VIDEO_MIME :
    FORUM_AUDIO_MIME
  const familyPrefix = `${kind}/`
  const matches =
    allowedMime.includes(file.type) ||
    (file.type !== '' && file.type.startsWith(familyPrefix))
  if (!matches) {
    throw new Error(
      kind === 'image' ? 'Use a JPEG, PNG, WEBP, or GIF image.' :
      kind === 'video' ? 'Use an MP4, WEBM, or MOV video.' :
      'Use an MP3, WAV, M4A, AAC, OGG, or FLAC audio file.',
    )
  }

  if (file.size > FORUM_MAX_BYTES) {
    throw new Error(
      kind === 'video'
        ? 'Video is larger than 50 MB. Try compressing it, or paste a Loom/YouTube link instead.'
        : kind === 'audio'
          ? 'Audio is larger than 50 MB. Try a shorter clip or lower bitrate.'
          : 'File is larger than 50 MB.',
    )
  }

  const path = buildForumMediaPath({
    kind: kind === 'image' ? 'images' : kind === 'video' ? 'videos' : 'audio',
    channelId,
    userId,
    filename: file.name,
  })
  const { error: uploadErr } = await supabase.storage
    .from(FORUM_MEDIA_BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type,
    })
  if (uploadErr) throw uploadErr

  const { data: urlData } = supabase.storage.from(FORUM_MEDIA_BUCKET).getPublicUrl(path)

  return {
    kind,
    url: urlData.publicUrl,
    name: file.name,
    mime: file.type,
    size: file.size,
  }
}
