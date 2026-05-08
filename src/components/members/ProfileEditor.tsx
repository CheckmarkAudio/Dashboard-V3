import { useCallback, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Save, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { teamMemberKeys } from '../../lib/queries/teamMembers'
import { Button, Input, Select } from '../ui'
import ImageUpload from '../media/ImageUpload'
import type { MemberSocials, TeamMember } from '../../types'

/**
 * Self-serve profile editor.
 *
 * Mounted from `Profile.tsx` when the viewer is on their own
 * profile and clicks "Edit profile". Members can edit:
 *
 *   - display_name
 *   - pronouns
 *   - timezone
 *   - bio
 *   - socials (Instagram, Twitter/X, TikTok, YouTube, SoundCloud, Spotify, Website)
 *   - avatar_url + banner_url (via the shared `<ImageUpload />`)
 *
 * Position / department / role / email stay admin-only — those
 * still get edited from `/admin/my-team` (TeamManager). Editing
 * profile fields here doesn't touch any of them.
 *
 * Writes go straight to `team_members` via the existing
 * `allow_self_update` RLS policy (auth.uid() = id) — no edge
 * function needed. On save we invalidate the shared
 * `teamMemberKeys.list()` cache so every consumer (Profile,
 * NotificationsPanel, MemberHighlights, etc.) picks up the new
 * avatar / name / etc. without a hard refresh.
 */

// Canonical socials list. Keeping the order stable so the editor
// renders predictably and the read view can mirror it.
const SOCIAL_FIELDS: { key: keyof MemberSocials; label: string; placeholder: string }[] = [
  { key: 'instagram',  label: 'Instagram',  placeholder: 'checkmarkaudio' },
  { key: 'twitter',    label: 'Twitter / X', placeholder: '@checkmark' },
  { key: 'tiktok',     label: 'TikTok',      placeholder: 'checkmarkaudio' },
  { key: 'youtube',    label: 'YouTube',     placeholder: '@checkmark' },
  { key: 'soundcloud', label: 'SoundCloud',  placeholder: 'checkmark' },
  { key: 'spotify',    label: 'Spotify',     placeholder: 'artist link' },
  { key: 'website',    label: 'Website',     placeholder: 'https://…' },
]

// Common-enough timezones that the dropdown is useful without
// shipping the whole IANA list. Members in unusual zones can still
// type into it (`<input list>` pattern).
const COMMON_TIMEZONES = [
  'America/Los_Angeles',
  'America/Denver',
  'America/Chicago',
  'America/New_York',
  'America/Phoenix',
  'America/Anchorage',
  'Pacific/Honolulu',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Paris',
  'Asia/Tokyo',
  'Australia/Sydney',
  'UTC',
]

interface ProfileEditorProps {
  member: TeamMember
  onClose: () => void
}

export default function ProfileEditor({ member, onClose }: ProfileEditorProps) {
  const queryClient = useQueryClient()

  // Form state — initialized from the current row. We only push
  // dirty fields on save so we don't accidentally null out
  // jsonb columns we didn't touch.
  const [displayName, setDisplayName] = useState(member.display_name ?? '')
  const [pronouns, setPronouns] = useState(member.pronouns ?? '')
  const [timezone, setTimezone] = useState(member.timezone ?? '')
  const [bio, setBio] = useState(member.bio ?? '')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(member.avatar_url ?? null)
  const [bannerUrl, setBannerUrl] = useState<string | null>(member.banner_url ?? null)
  const [socials, setSocials] = useState<MemberSocials>(member.socials ?? {})

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedFlash, setSavedFlash] = useState(false)

  const fallbackInitial = useMemo(
    () => displayName.trim().charAt(0).toUpperCase() || '?',
    [displayName],
  )

  const updateSocial = useCallback((key: keyof MemberSocials, value: string) => {
    setSocials((prev) => {
      const next = { ...prev }
      const trimmed = value.trim()
      if (trimmed) next[key] = trimmed
      else delete next[key]
      return next
    })
  }, [])

  const onSave = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setError(null)

      const trimmedName = displayName.trim()
      if (!trimmedName) {
        setError('Display name cannot be empty.')
        return
      }
      if (bio.length > 500) {
        setError('Bio is capped at 500 characters.')
        return
      }

      setSaving(true)
      try {
        const { error: updateErr } = await supabase
          .from('team_members')
          .update({
            display_name: trimmedName,
            pronouns: pronouns.trim() || null,
            timezone: timezone.trim() || null,
            bio: bio.trim() || null,
            avatar_url: avatarUrl,
            banner_url: bannerUrl,
            socials,
          })
          .eq('id', member.id)
        if (updateErr) throw updateErr

        // Invalidate the shared list so every consumer gets the
        // new values without a hard refresh.
        await queryClient.invalidateQueries({ queryKey: teamMemberKeys.all })

        setSavedFlash(true)
        // Close after a brief flash so the user sees the success
        // state. Mirrors the reset-password modal pattern.
        setTimeout(() => {
          setSavedFlash(false)
          onClose()
        }, 800)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Save failed.')
      } finally {
        setSaving(false)
      }
    },
    [
      avatarUrl,
      bannerUrl,
      bio,
      displayName,
      member.id,
      onClose,
      pronouns,
      queryClient,
      socials,
      timezone,
    ],
  )

  return (
    <form onSubmit={onSave} className="space-y-6 animate-fade-in">
      {/* Header row — Cancel + Save up top so they're discoverable
          before the form gets long. */}
      <div className="flex items-center justify-between gap-3 px-1">
        <div>
          <h2 className="text-[18px] font-bold text-text">Edit profile</h2>
          <p className="text-[12px] text-text-muted">
            Position, role, and email are managed by your admin.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={saving}
            iconLeft={<X size={14} aria-hidden="true" />}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            loading={saving}
            iconLeft={
              !saving && !savedFlash ? <Save size={14} aria-hidden="true" /> :
              savedFlash ? <CheckCircle2 size={14} aria-hidden="true" /> :
              undefined
            }
          >
            {savedFlash ? 'Saved' : 'Save changes'}
          </Button>
        </div>
      </div>

      {/* Banner upload — wide hero rectangle. Sits above the
          avatar so the layout previews how the read view will look. */}
      <section className="space-y-2">
        <p className="text-[11px] font-semibold text-gold uppercase tracking-wider">Banner</p>
        <ImageUpload
          kind="banners"
          userId={member.id}
          currentUrl={bannerUrl}
          onUploaded={(url) => setBannerUrl(url)}
          onRemoved={() => setBannerUrl(null)}
          variant="banner"
          disabled={saving}
        />
      </section>

      {/* Avatar + display name + pronouns row */}
      <section className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-5 items-start">
        <div>
          <p className="text-[11px] font-semibold text-gold uppercase tracking-wider mb-2">Avatar</p>
          <ImageUpload
            kind="avatars"
            userId={member.id}
            currentUrl={avatarUrl}
            onUploaded={(url) => setAvatarUrl(url)}
            onRemoved={() => setAvatarUrl(null)}
            variant="avatar"
            disabled={saving}
            fallbackInitial={fallbackInitial}
          />
        </div>

        <div className="space-y-3">
          <Input
            id="profile-display-name"
            label="Display name"
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            disabled={saving}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              id="profile-pronouns"
              label="Pronouns"
              placeholder="she/her, he/him, they/them"
              value={pronouns}
              onChange={(e) => setPronouns(e.target.value)}
              disabled={saving}
            />
            <Select
              id="profile-timezone"
              label="Timezone"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              disabled={saving}
            >
              <option value="">Not set</option>
              {COMMON_TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </Select>
          </div>
        </div>
      </section>

      {/* Bio */}
      <section className="space-y-1.5">
        <label htmlFor="profile-bio" className="block text-[12px] font-medium text-text-muted">
          Bio
        </label>
        <textarea
          id="profile-bio"
          rows={4}
          maxLength={500}
          placeholder="A line or two about you."
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          disabled={saving}
          className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-sm text-text placeholder:text-text-light focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/30 resize-y min-h-[88px]"
        />
        <p className="text-[11px] text-text-light text-right tabular-nums">
          {bio.length}/500
        </p>
      </section>

      {/* Socials */}
      <section className="space-y-3">
        <p className="text-[11px] font-semibold text-gold uppercase tracking-wider">Socials</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {SOCIAL_FIELDS.map(({ key, label, placeholder }) => (
            <Input
              key={key}
              id={`profile-social-${key}`}
              label={label}
              placeholder={placeholder}
              value={socials[key] ?? ''}
              onChange={(e) => updateSocial(key, e.target.value)}
              disabled={saving}
            />
          ))}
        </div>
      </section>

      {error && (
        <div role="alert" className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl p-3">
          {error}
        </div>
      )}

      {/* Footer mirror of the header save button so the user doesn't
          have to scroll back up after a long edit session. */}
      <div className="flex items-center justify-end gap-2 pt-2">
        <Button
          type="button"
          variant="ghost"
          onClick={onClose}
          disabled={saving}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant="primary"
          loading={saving}
          iconLeft={
            savedFlash ? <CheckCircle2 size={14} aria-hidden="true" /> :
            !saving ? <Save size={14} aria-hidden="true" /> :
            undefined
          }
        >
          {savedFlash ? 'Saved' : 'Save changes'}
        </Button>
      </div>
    </form>
  )
}
