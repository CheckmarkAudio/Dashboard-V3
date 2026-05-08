import { useCallback, useRef, useState } from 'react'
import { ImagePlus, Loader2, Trash2, Upload } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { Button } from '../ui'

/**
 * Reusable image upload component for the `member-media` Storage
 * bucket. Used by the profile editor for both avatar (square,
 * compact) and banner (wide, hero) uploads.
 *
 * Behavior
 *   - Click the preview / drag-drop a file → uploads to
 *     `<kind>/<userId>/<timestamp>-<original>.<ext>`
 *   - On success, calls `onUploaded(publicUrl)` so the parent can
 *     persist it to `team_members.{avatar_url|banner_url}`.
 *   - On a fresh upload to the same kind, the OLD file at
 *     `currentUrl` is deleted to keep the bucket from filling up.
 *   - "Remove" clears the value (sets `null` upstream) and deletes
 *     the file from Storage.
 *
 * RLS in the bucket allows writes only when
 * `auth.uid() === foldername(name)[2]` OR the caller is a team
 * admin, so passing the wrong `userId` will fail server-side. See
 * `supabase/migrations/20260508000100_member_media_storage_bucket.sql`.
 */
export interface ImageUploadProps {
  /** Storage path prefix — `'avatars'` or `'banners'`. */
  kind: 'avatars' | 'banners'
  /** The team_members.id row whose folder we'll write into. */
  userId: string
  /** Current public URL (if any) — shown as the preview. */
  currentUrl?: string | null
  /** Called with the new public URL after a successful upload. */
  onUploaded: (publicUrl: string) => void
  /** Called with `null` after the user clicks Remove. */
  onRemoved?: () => void
  /** Render variant: `avatar` = circle, `banner` = wide rectangle. */
  variant?: 'avatar' | 'banner'
  /** Accessible label override; defaults vary by variant. */
  label?: string
  /** Disable interactions (e.g. while a parent save is pending). */
  disabled?: boolean
  /** Fallback initial when no image is set. */
  fallbackInitial?: string
}

const MAX_BYTES = 5 * 1024 * 1024
const ACCEPTED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

function fileExtension(name: string, fallback = 'jpg'): string {
  const dot = name.lastIndexOf('.')
  if (dot < 0 || dot === name.length - 1) return fallback
  return name.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, '')
}

/** Best-effort: extract the storage path back out of a public URL.
 *  We use this to delete the OLD file when uploading a replacement
 *  so the bucket doesn't accumulate orphans. Returns null when the
 *  URL doesn't look like a Supabase public storage URL we own. */
function pathFromPublicUrl(url: string): string | null {
  // Format: https://<proj>.supabase.co/storage/v1/object/public/member-media/<path>
  const marker = '/storage/v1/object/public/member-media/'
  const idx = url.indexOf(marker)
  if (idx < 0) return null
  return url.slice(idx + marker.length)
}

export default function ImageUpload({
  kind,
  userId,
  currentUrl,
  onUploaded,
  onRemoved,
  variant = 'avatar',
  label,
  disabled,
  fallbackInitial,
}: ImageUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

  const triggerPicker = useCallback(() => {
    if (disabled || uploading) return
    fileInputRef.current?.click()
  }, [disabled, uploading])

  const upload = useCallback(
    async (file: File) => {
      setError(null)
      if (!ACCEPTED_MIME.includes(file.type)) {
        setError('Use a JPEG, PNG, WEBP, or GIF.')
        return
      }
      if (file.size > MAX_BYTES) {
        setError('Max file size is 5 MB.')
        return
      }

      setUploading(true)
      try {
        const ext = fileExtension(file.name)
        const path = `${kind}/${userId}/${Date.now()}.${ext}`

        const { error: uploadErr } = await supabase.storage
          .from('member-media')
          .upload(path, file, {
            cacheControl: '3600',
            upsert: false,
            contentType: file.type,
          })
        if (uploadErr) throw uploadErr

        const { data: urlData } = supabase.storage
          .from('member-media')
          .getPublicUrl(path)
        const publicUrl = urlData.publicUrl

        // Best-effort: delete the previous file so the bucket
        // doesn't accumulate orphans. RLS will reject this for any
        // path that isn't ours, which is the right behavior.
        if (currentUrl) {
          const oldPath = pathFromPublicUrl(currentUrl)
          if (oldPath && oldPath !== path) {
            void supabase.storage.from('member-media').remove([oldPath])
          }
        }

        onUploaded(publicUrl)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed')
      } finally {
        setUploading(false)
      }
    },
    [currentUrl, kind, onUploaded, userId],
  )

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      // Clear so re-selecting the same file still triggers onChange.
      e.target.value = ''
      if (file) void upload(file)
    },
    [upload],
  )

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      if (disabled || uploading) return
      const file = e.dataTransfer.files?.[0]
      if (file) void upload(file)
    },
    [disabled, uploading, upload],
  )

  const onRemove = useCallback(async () => {
    if (disabled || uploading || !currentUrl) return
    setError(null)
    const oldPath = pathFromPublicUrl(currentUrl)
    if (oldPath) {
      // Best-effort delete — even if Storage rejects we still clear
      // the URL upstream so the UI reflects the user's intent.
      void supabase.storage.from('member-media').remove([oldPath])
    }
    onRemoved?.()
  }, [currentUrl, disabled, onRemoved, uploading])

  const isAvatar = variant === 'avatar'
  const dimensions = isAvatar
    ? 'w-24 h-24 rounded-full'
    : 'w-full aspect-[3/1] rounded-xl'

  return (
    <div className="space-y-2">
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label={label ?? (isAvatar ? 'Upload avatar' : 'Upload banner')}
        onClick={triggerPicker}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            triggerPicker()
          }
        }}
        onDragOver={(e) => {
          e.preventDefault()
          if (!disabled && !uploading) setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={[
          'relative overflow-hidden border-2 border-dashed transition-colors',
          'flex items-center justify-center',
          dimensions,
          disabled || uploading
            ? 'cursor-not-allowed opacity-60'
            : 'cursor-pointer hover:border-gold/60',
          dragOver ? 'border-gold bg-gold/10' : 'border-border bg-surface-alt/40',
        ].join(' ')}
      >
        {currentUrl ? (
          <img
            src={currentUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            // Cache-buster so a fresh upload to the same kind shows
            // immediately even if the browser cached the old URL.
            key={currentUrl}
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-text-light">
            {fallbackInitial ? (
              <span className={isAvatar ? 'text-2xl font-bold text-gold' : 'text-3xl font-bold text-gold'}>
                {fallbackInitial}
              </span>
            ) : (
              <ImagePlus size={isAvatar ? 24 : 32} aria-hidden="true" />
            )}
            {!isAvatar && (
              <p className="text-[11px] mt-1.5">
                {dragOver ? 'Drop to upload' : 'Click or drag an image'}
              </p>
            )}
          </div>
        )}

        {uploading && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <Loader2 size={20} className="animate-spin text-white" aria-hidden="true" />
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={triggerPicker}
          disabled={disabled || uploading}
          iconLeft={<Upload size={13} aria-hidden="true" />}
        >
          {currentUrl ? 'Replace' : 'Upload'}
        </Button>
        {currentUrl && onRemoved && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void onRemove()}
            disabled={disabled || uploading}
            iconLeft={<Trash2 size={13} aria-hidden="true" />}
          >
            Remove
          </Button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_MIME.join(',')}
        onChange={onFileChange}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      />

      {error && (
        <p role="alert" className="text-[11px] text-red-400">
          {error}
        </p>
      )}
    </div>
  )
}
