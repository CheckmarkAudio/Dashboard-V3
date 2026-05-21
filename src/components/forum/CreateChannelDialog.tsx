// 2026-05-20 — Admin-only "Create channel" dialog for the Forum.
//
// Renders as a small floating popover anchored above the "+ New"
// trigger in the Content page sidebar. Admins set a name + optional
// description; we auto-derive the slug (Discord-style: lowercase
// kebab-case, alphanumerics + hyphens only). INSERT goes through
// supabase-js directly — the `admins_can_insert_channels` RLS
// policy (added in 20260501000000_chat_rls_tighten.sql) handles
// authorization, so no edge function is required.
//
// Uniqueness: both `name` and `slug` have UNIQUE constraints on
// `chat_channels`. We surface a friendly error if the user picks a
// name that collides instead of leaking the raw Postgres error.

import { useEffect, useMemo, useRef, useState } from 'react'
import { Hash, Loader2, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../Toast'

export interface ChannelLite {
  id: string
  name: string
  slug: string
}

interface CreateChannelDialogProps {
  /** Existing channels — used to surface a client-side preview of
   *  "this name's already taken" before the INSERT round trip. */
  existing: ChannelLite[]
  onClose: () => void
  onCreated: (channel: ChannelLite & { description: string | null }) => void
}

/**
 * Convert a free-form channel name to a Discord-style slug.
 *   "Music Production" → "music-production"
 *   "  #general  "     → "general"
 *   "let's-go!"        → "lets-go"
 */
export function slugifyChannel(name: string): string {
  return name
    .toLowerCase()
    .replace(/^#+/, '')             // drop leading '#' if user types one
    .replace(/'/g, '')              // drop apostrophes (don't slugify to hyphen)
    .replace(/[^a-z0-9]+/g, '-')    // anything else → hyphen
    .replace(/^-+|-+$/g, '')        // trim leading/trailing hyphens
    .slice(0, 60)                   // hard cap so slugs stay short
}

export default function CreateChannelDialog({
  existing,
  onClose,
  onCreated,
}: CreateChannelDialogProps) {
  const { toast } = useToast()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const nameInputRef = useRef<HTMLInputElement>(null)

  // Autofocus the name field on mount.
  useEffect(() => {
    nameInputRef.current?.focus()
  }, [])

  // Esc closes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const slug = useMemo(() => slugifyChannel(name), [name])
  const slugTaken = useMemo(
    () => slug.length > 0 && existing.some((c) => c.slug === slug),
    [slug, existing],
  )
  const nameTaken = useMemo(
    () =>
      name.trim().length > 0 &&
      existing.some((c) => c.name.toLowerCase() === name.trim().toLowerCase()),
    [name, existing],
  )

  const canSubmit = slug.length >= 2 && !slugTaken && !nameTaken && !submitting

  const submit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      const { data, error } = await supabase
        .from('chat_channels')
        .insert({
          name: name.trim(),
          slug,
          description: description.trim() || null,
        })
        .select('id, name, slug, description')
        .single()
      if (error) {
        // 23505 = unique_violation — surfaces if two admins race or
        // our client check missed something (e.g. case-insensitive
        // collision on a column without CITEXT).
        if (error.code === '23505') {
          toast('A channel with that name or slug already exists.', 'error')
        } else if (error.code === '42501') {
          toast('Only admins can create channels.', 'error')
        } else {
          toast(error.message, 'error')
        }
        return
      }
      toast(`#${data.name} created.`, 'success')
      onCreated(data as ChannelLite & { description: string | null })
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      // Backdrop — close on click-outside. The inner panel stops
      // propagation so clicks inside don't dismiss.
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-channel-title"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md mx-4 bg-surface rounded-2xl border border-border shadow-2xl overflow-hidden"
      >
        <header className="flex items-center justify-between px-5 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Hash size={14} className="text-gold" aria-hidden="true" />
            <h2 id="create-channel-title" className="text-[14px] font-bold text-text">
              Create a channel
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1 rounded-md text-text-muted hover:text-text hover:bg-surface-hover transition-colors focus-ring"
          >
            <X size={14} />
          </button>
        </header>

        <div className="p-5 space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="channel-name" className="block text-[11px] font-semibold uppercase tracking-wider text-text-muted">
              Channel name
            </label>
            <input
              id="channel-name"
              ref={nameInputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && canSubmit) {
                  e.preventDefault()
                  void submit()
                }
              }}
              placeholder="e.g. Music Production"
              maxLength={60}
              className="w-full px-3 py-2 rounded-lg bg-surface-alt border border-border text-[13px] text-text placeholder:text-text-light focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/30"
            />
            {/* Live slug preview + uniqueness feedback. */}
            {name.trim() && (
              <p
                className={`text-[11px] ${
                  nameTaken || slugTaken
                    ? 'text-rose-300'
                    : 'text-text-light'
                }`}
              >
                {nameTaken
                  ? 'A channel with this name already exists.'
                  : slugTaken
                    ? `Slug "#${slug}" already taken — pick another name.`
                    : slug.length >= 2
                      ? `Will appear as #${slug}`
                      : 'At least 2 letters / digits required.'}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="channel-desc" className="block text-[11px] font-semibold uppercase tracking-wider text-text-muted">
              Description (optional)
            </label>
            <input
              id="channel-desc"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && canSubmit) {
                  e.preventDefault()
                  void submit()
                }
              }}
              placeholder="What's this channel for?"
              maxLength={140}
              className="w-full px-3 py-2 rounded-lg bg-surface-alt border border-border text-[13px] text-text placeholder:text-text-light focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/30"
            />
          </div>
        </div>

        <footer className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border bg-surface-alt/30">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-3 py-2 rounded-lg text-[12px] font-semibold text-text-muted hover:text-text hover:bg-surface-hover transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={!canSubmit}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gold text-black text-[12px] font-bold hover:bg-gold-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-ring shadow-[0_2px_8px_rgba(0,0,0,0.08)]"
          >
            {submitting ? (
              <Loader2 size={12} className="animate-spin" aria-hidden="true" />
            ) : (
              <Hash size={12} aria-hidden="true" />
            )}
            Create
          </button>
        </footer>
      </div>
    </div>
  )
}
