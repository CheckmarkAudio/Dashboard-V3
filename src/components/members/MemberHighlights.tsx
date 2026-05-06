import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { fetchTeamMembers, teamMemberKeys } from '../../lib/queries/teamMembers'
import type { TeamMember } from '../../types'

/**
 * MemberHighlights + social snapshot — horizontal pill strip.
 *
 * Left side : one pill per active team member (avatar + first name).
 * Right side: one pill per Checkmark Audio social channel — clickable
 *             link plus a follower-count snapshot, justified to the
 *             right edge so the rail reads as
 *             "people on the left, brand presence on the right."
 *
 * Follower counts are currently hardcoded constants (see
 * `SOCIAL_CHANNELS` below). Update them manually as the numbers
 * grow until we wire the strip to real platform APIs (deferred —
 * Instagram + TikTok + YouTube each require OAuth + token refresh
 * to read counts; not worth building until the dashboard sees more
 * employee traffic).
 */

// ─── Social channels ────────────────────────────────────────────────
//
// Update follower counts here when the brand grows. The icon circle
// + count format mirrors the member pill so the two reads as a single
// pill rail rather than separate widgets.

type SocialChannel = {
  platform: 'instagram' | 'tiktok' | 'youtube' | 'facebook'
  label: string
  href: string
  /** Follower / subscriber count. Manual until APIs wire up.
   * Update the numbers here whenever the brand counts shift —
   * each platform was last hand-checked 2026-05-06. */
  count: number
}

const SOCIAL_CHANNELS: SocialChannel[] = [
  {
    platform: 'instagram',
    label: 'Instagram',
    href: 'https://www.instagram.com/checkmark_audio',
    count: 502,
  },
  {
    platform: 'tiktok',
    label: 'TikTok',
    href: 'https://www.tiktok.com/@checkmarkaudio',
    count: 28,
  },
  {
    platform: 'youtube',
    label: 'YouTube',
    href: 'https://www.youtube.com/@checkmarkAudio',
    count: 8,
  },
  {
    platform: 'facebook',
    label: 'Facebook',
    href: 'https://www.facebook.com/CheckmarkAudio/',
    count: 75,
  },
]

function formatCount(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1) + 'K'
  return n.toLocaleString()
}

// Filled brand glyphs — Simple-Icons-style filled SVG paths so the
// social stat blocks read with visual weight ("less skinny, more
// meat" per user feedback). Each is a single <path> drawn with the
// official brand silhouette at 24×24 viewBox, painted in
// `currentColor` so theme tokens drive the tint.

function InstagramGlyph({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/>
    </svg>
  )
}

function TikTokGlyph({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5.8 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1.84-.1z"/>
    </svg>
  )
}

function YoutubeGlyph({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>
  )
}

function FacebookGlyph({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z"/>
    </svg>
  )
}

function PlatformIcon({ platform, size = 32 }: { platform: SocialChannel['platform']; size?: number }) {
  if (platform === 'instagram') return <InstagramGlyph size={size} />
  if (platform === 'youtube') return <YoutubeGlyph size={size} />
  if (platform === 'facebook') return <FacebookGlyph size={size} />
  return <TikTokGlyph size={size} />
}

// Brand-color tints per platform — used as the icon color inside the
// gold bubble so the four icons read as distinct brand identities
// instead of all-the-same monochrome (per user feedback). These
// Tailwind palette values aren't theme-tokenized; they render
// identically in light + dark which is what we want for brand
// recognizability.
const PLATFORM_COLOR: Record<SocialChannel['platform'], string> = {
  instagram: 'text-pink-500',
  tiktok: 'text-cyan-500',
  youtube: 'text-red-500',
  facebook: 'text-blue-500',
}

// ─── Member pill ────────────────────────────────────────────────────

function initialsFor(name: string | undefined): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  const first = parts[0]?.charAt(0) ?? ''
  const last = parts.length > 1 ? (parts[parts.length - 1]?.charAt(0) ?? '') : ''
  return (first + last).toUpperCase() || '?'
}

function MemberPill({ member }: { member: TeamMember }) {
  const initials = initialsFor(member.display_name)
  const firstName = member.display_name?.split(' ')[0] ?? '—'

  // Skin pass 2026-05-06 — per-pill border dropped; the parent
  // MemberHighlights wraps the whole row in a single bordered
  // panel so members live inside one container instead of as
  // separate floating chips. Avatar gets a thicker bevel
  // (ring-2 + offset + shadow) so it reads as a raised disc on
  // the panel surface.
  return (
    <Link
      to={`/profile/${member.id}`}
      className="group flex items-center gap-2.5 shrink-0 pl-1.5 pr-4 py-1.5 rounded-xl hover:bg-surface-hover transition-colors focus-ring"
      aria-label={`View ${member.display_name}'s profile`}
    >
      <span className="block w-10 h-10 rounded-full overflow-hidden shrink-0 ring-2 ring-surface ring-offset-2 ring-offset-border-light shadow-[0_2px_4px_rgba(0,0,0,0.08)]">
        {member.avatar_url ? (
          <img src={member.avatar_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="w-full h-full flex items-center justify-center bg-surface-alt text-text text-[13px] font-bold">
            {initials}
          </span>
        )}
      </span>
      <span className="text-[13px] font-medium text-text whitespace-nowrap">{firstName}</span>
    </Link>
  )
}

// ─── Social pill ────────────────────────────────────────────────────

/**
 * SocialStat — circular bubble holding a brand-colored glyph above
 * the follower count, both INSIDE the same bubble. Per user direction
 * 2026-05-06:
 *   • circular (rounded-full)
 *   • icon stacked above count, both in the bubble
 *   • brand colors (not all black)
 *   • reduced kerning between bubbles (gap dropped from 16px → 8px
 *     in the parent SocialStatsBar)
 *
 * Bubble bg stays the soft `bg-gold/15` + `ring-gold/30` — gives a
 * consistent Checkmark-gold container that reads in both light + dark
 * while the brand-colored glyph inside provides per-platform identity.
 */
function SocialStat({ channel }: { channel: SocialChannel }) {
  return (
    <a
      href={channel.href}
      target="_blank"
      rel="noopener noreferrer"
      className="group inline-flex shrink-0 rounded-full focus-ring"
      aria-label={`${channel.label} — ${formatCount(channel.count)} followers`}
      title={`${channel.label} — ${formatCount(channel.count)} followers`}
    >
      <span className="flex flex-col items-center justify-center w-14 h-14 rounded-full bg-gold/15 ring-1 ring-gold/30 group-hover:bg-gold/25 group-hover:ring-gold/50 transition-colors shrink-0 leading-none">
        <span className={PLATFORM_COLOR[channel.platform]}>
          <PlatformIcon platform={channel.platform} size={18} />
        </span>
        <span className="text-[10px] font-bold text-text tabular-nums whitespace-nowrap mt-0.5">
          {formatCount(channel.count)}
        </span>
      </span>
    </a>
  )
}

// ─── Strip ──────────────────────────────────────────────────────────
//
// 2026-05-06 — split: <MemberHighlights /> renders ONLY member pills
// now (its own row beneath the page title). <SocialStatsBar /> is a
// named export that renders the social tiles standalone — the
// Dashboard / Hub page wires it into PageHeader's `actions` slot so
// social sits right-justified on the title row.

/**
 * SocialStatsBar — the four social media bubbles + counts as a
 * standalone bar. Used inside PageHeader's `actions` slot on
 * Dashboard + Hub so they read on the same row as the page title.
 * Self-contained: no props, queries nothing — just maps
 * SOCIAL_CHANNELS to <SocialStat /> rows.
 */
export function SocialStatsBar() {
  return (
    <div
      className="flex items-center gap-2 shrink-0"
      aria-label="Checkmark Audio social media snapshot"
    >
      {SOCIAL_CHANNELS.map((channel) => (
        <SocialStat key={channel.platform} channel={channel} />
      ))}
    </div>
  )
}

/**
 * MemberHighlights — the row of member pills (avatar + first name)
 * inside a single bordered panel beneath the page title.
 *
 * Optional `actions` slot renders to the right of the panel on the
 * same row (used by Dashboard to put +Book a Session right next to
 * the team avatars). When `actions` is set, the panel only takes
 * its content width — the actions sit immediately to the right
 * with `gap-3` between, leaving the rest of the row free.
 */
export default function MemberHighlights({ actions }: { actions?: ReactNode } = {}) {
  const { data: members = [] } = useQuery({
    queryKey: teamMemberKeys.list(),
    queryFn: fetchTeamMembers,
    staleTime: 60_000,
  })

  const active = members.filter((m) => (m.status ?? 'active') === 'active')
  if (active.length === 0 && !actions) return null

  // Skin pass 2026-05-06 — outer flex container so the bordered
  // member panel auto-sizes to its content (members), and the
  // optional `actions` slot is RIGHT-justified to the far edge
  // of the row via `ml-auto`. `min-w-0` on the panel still allows
  // it to shrink (with internal overflow-x-auto handling many
  // members) before the actions get crowded off-row.
  return (
    <div className="flex items-center gap-3">
      <div className="rounded-xl border border-border bg-surface px-2 py-1.5 min-w-0">
        <div className="flex gap-1 overflow-x-auto [scrollbar-width:thin]">
          {active.map((member) => (
            <MemberPill key={member.id} member={member} />
          ))}
        </div>
      </div>
      {actions && <div className="shrink-0 ml-auto">{actions}</div>}
    </div>
  )
}
