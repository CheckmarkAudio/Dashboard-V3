import { useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  AlertCircle,
  ChevronLeft,
  Globe,
  Instagram,
  Loader2,
  LogOut,
  Mail,
  Pencil,
  Shield,
  Twitter,
  Youtube,
} from 'lucide-react'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useAuth } from '../contexts/AuthContext'
import { fetchTeamMembers, teamMemberKeys } from '../lib/queries/teamMembers'
import { getPositionLabel, getPositionVariant } from '../domain/positions'
import ChangePasswordPanel from '../components/auth/ChangePasswordPanel'
import MemberAvatar from '../components/members/MemberAvatar'
import ProfileEditor from '../components/members/ProfileEditor'
import LiveStatus from '../components/members/LiveStatus'
import StatsSidebar from '../components/members/StatsSidebar'
import ProfileWeeklySchedule from '../components/members/ProfileWeeklySchedule'
import { Badge, Button } from '../components/ui'
import type { MemberSocials, TeamMember } from '../types'
import { APP_ROUTES } from '../app/routes'

/**
 * Member profile page.
 *
 * Tier 1 (post-super-PR) layout:
 *   - max-w-5xl container so the page actually has room to breathe
 *   - Banner spans the full card width (3:1 hero)
 *   - Hero row: avatar (overlapping the banner) + identity column
 *     with name, pronouns, role pills, live status, and (own-only)
 *     Edit profile action
 *   - Below the hero: 2-column grid (main left + stats sidebar right)
 *     · Left main: About, Socials, Security (own only), Team list
 *     · Right sidebar: stats card + achievements placeholder
 *
 * Editing swaps the whole card body into `<ProfileEditor />`. Admins
 * editing OTHER members still go through `/admin/my-team`
 * (TeamManager) — this page only edits your own profile.
 */
export default function Profile() {
  const { memberId } = useParams<{ memberId: string }>()
  const navigate = useNavigate()
  const { profile: viewerProfile, signOut } = useAuth()
  const [editing, setEditing] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  const teamQuery = useQuery({
    queryKey: teamMemberKeys.list(),
    queryFn: fetchTeamMembers,
  })
  const members: TeamMember[] = teamQuery.data ?? []
  const member = members.find((m) => m.id === memberId)

  const isOwnProfile = Boolean(viewerProfile && member && viewerProfile.id === member.id)

  useDocumentTitle(member ? `${member.display_name} - Checkmark Workspace` : 'Profile - Checkmark Workspace')

  if (teamQuery.isLoading) {
    return (
      <div className="max-w-5xl mx-auto py-16 flex items-center justify-center text-text-light">
        <Loader2 size={18} className="animate-spin mr-2" />
        Loading profile…
      </div>
    )
  }

  if (teamQuery.error) {
    return (
      <div className="max-w-5xl mx-auto py-16 flex items-start gap-2 text-amber-300">
        <AlertCircle size={16} className="mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-medium">Could not load profile</p>
          <p className="text-xs text-text-light mt-0.5">{(teamQuery.error as Error).message}</p>
        </div>
      </div>
    )
  }

  if (!member) {
    return (
      <div className="max-w-5xl mx-auto py-16 text-center animate-fade-in">
        <p className="text-[16px] text-text-muted">Profile not found.</p>
        <Link to="/" className="text-[13px] text-gold hover:underline mt-3 inline-block">
          Back to Overview
        </Link>
      </div>
    )
  }

  const otherMembers = members.filter((m) => m.id !== member.id)
  const isAdmin = member.role === 'admin'
  const positionLabel = getPositionLabel(member.position)
  const positionVariant = getPositionVariant(member.position)

  const handleSignOut = async () => {
    setSigningOut(true)
    try {
      await signOut()
    } finally {
      setSigningOut(false)
      navigate(APP_ROUTES.auth.login, { replace: true })
    }
  }

  return (
    <div className="max-w-5xl mx-auto animate-fade-in">
      {/* Back link */}
      <Link to="/" className="flex items-center gap-1 text-[12px] text-text-light hover:text-gold transition-colors mb-6">
        <ChevronLeft size={14} /> Back to Dashboard
      </Link>

      {/* Profile card — banner + hero live INSIDE this card. */}
      <div className="bg-surface rounded-2xl border border-border overflow-hidden">
        {/* Banner — full card width when set, otherwise a thin
            tinted strip so the avatar still has something to
            overlap. Hidden in edit mode to keep the editor focused. */}
        {!editing && (
          member.banner_url ? (
            <div className="aspect-[4/1] w-full overflow-hidden bg-surface-alt">
              <img
                src={member.banner_url}
                alt=""
                className="w-full h-full object-cover"
                key={member.banner_url}
              />
            </div>
          ) : (
            <div className="h-20 w-full bg-gradient-to-br from-gold/15 via-surface-alt to-surface-alt" />
          )
        )}

        {editing ? (
          <div className="px-8 py-7">
            <ProfileEditor member={member} onClose={() => setEditing(false)} />
          </div>
        ) : (
          <>
            {/* Hero row */}
            <div className="px-8 pt-5 pb-6">
              <div className="flex items-start gap-5">
                {/* Avatar — lifted up to overlap the banner edge.
                    Ring around it provides separation from any
                    busy banner image underneath. */}
                <div className="-mt-14 shrink-0">
                  <div className="ring-4 ring-surface rounded-full">
                    <MemberAvatar member={member} size="xl" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-2">
                      {/* Name + pronouns */}
                      <h1 className="text-[24px] font-extrabold text-text tracking-tight leading-tight">
                        {member.display_name}
                        {member.pronouns && (
                          <span className="ml-2 text-[13px] font-medium text-text-light">
                            ({member.pronouns})
                          </span>
                        )}
                      </h1>
                      {/* Role pills — position color + admin shield */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge variant={positionVariant} size="sm">{positionLabel}</Badge>
                        {isAdmin && (
                          <Badge variant="gold" size="sm">
                            <span className="inline-flex items-center gap-1">
                              <Shield size={10} aria-hidden="true" />
                              Admin
                            </span>
                          </Badge>
                        )}
                        {member.department && (
                          <span className="text-[12px] text-text-light">
                            · {member.department}
                          </span>
                        )}
                      </div>
                      {/* Live status row */}
                      <div className="pt-0.5">
                        <LiveStatus memberId={member.id} />
                      </div>
                    </div>
                    {isOwnProfile && (
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          size="sm"
                          variant="secondary"
                          iconLeft={<Pencil size={13} aria-hidden="true" />}
                          onClick={() => setEditing(true)}
                        >
                          Edit profile
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          loading={signingOut}
                          iconLeft={!signingOut ? <LogOut size={13} aria-hidden="true" /> : undefined}
                          onClick={() => void handleSignOut()}
                        >
                          Log out
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Body — 2-column grid below the hero */}
            <div className="px-8 pb-8 grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-8">
              {/* Left: main content */}
              <div className="space-y-6 min-w-0">
                {/* Bio */}
                {member.bio && (
                  <div>
                    <h2 className="text-[11px] font-semibold text-gold uppercase tracking-wider mb-2">About</h2>
                    <p className="text-[14px] text-text-muted whitespace-pre-wrap leading-relaxed">
                      {member.bio}
                    </p>
                  </div>
                )}

                {/* Contact */}
                <div>
                  <h2 className="text-[11px] font-semibold text-gold uppercase tracking-wider mb-3">Contact</h2>
                  <div className="space-y-2">
                    <a
                      href={`mailto:${member.email}`}
                      className="flex items-center gap-3 text-[14px] text-text-muted hover:text-gold transition-colors"
                    >
                      <Mail size={15} className="text-text-light" />
                      {member.email}
                    </a>
                  </div>
                </div>

                {/* Socials */}
                <SocialsBlock socials={member.socials} />

                {/* 2026-05-23 — Weekly Schedule (PR 4 of scheduler).
                    Read-only display of this member's recurring weekly
                    hours + upcoming approved one-off exceptions.
                    Admin edits from Members → Work Scheduler; member
                    proposes from Overview → My Schedule widget. */}
                <ProfileWeeklySchedule memberId={member.id} />

                {/* Self-serve change-password (Lean 3) — own profile only */}
                {isOwnProfile && <ChangePasswordPanel />}

                {/* Team list */}
                {otherMembers.length > 0 && (
                  <div>
                    <h2 className="text-[11px] font-semibold text-gold uppercase tracking-wider mb-3">Team</h2>
                    <div className="space-y-0">
                      {otherMembers.map((m) => (
                        <Link
                          key={m.id}
                          to={`/profile/${m.id}`}
                          className="flex items-center gap-2.5 py-2 border-b border-border/20 last:border-0 hover:opacity-80 transition-opacity"
                        >
                          <MemberAvatar member={m} size="sm" />
                          <span className="text-[13px] text-text-muted tracking-tight">{m.display_name}</span>
                          {m.position && (
                            <span className="text-[11px] text-text-light ml-auto">
                              {getPositionLabel(m.position)}
                            </span>
                          )}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Right: stats sidebar */}
              <StatsSidebar member={member} />
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Local helper: socials read view ──────────────────────────────

interface SocialMeta {
  Icon: typeof Globe
  href: (handle: string) => string
  label: string
}

const WEBSITE_META: SocialMeta = {
  Icon: Globe,
  label: 'Website',
  href: (h) => (h.startsWith('http') ? h : `https://${h}`),
}

const SOCIAL_ICON_MAP: Record<string, SocialMeta> = {
  instagram:  { Icon: Instagram, label: 'Instagram',   href: (h) => h.startsWith('http') ? h : `https://instagram.com/${h.replace(/^@/, '')}` },
  twitter:    { Icon: Twitter,   label: 'Twitter / X', href: (h) => h.startsWith('http') ? h : `https://x.com/${h.replace(/^@/, '')}` },
  tiktok:     { Icon: Globe,     label: 'TikTok',      href: (h) => h.startsWith('http') ? h : `https://tiktok.com/@${h.replace(/^@/, '')}` },
  youtube:    { Icon: Youtube,   label: 'YouTube',     href: (h) => h.startsWith('http') ? h : `https://youtube.com/${h.replace(/^@/, '')}` },
  soundcloud: { Icon: Globe,     label: 'SoundCloud',  href: (h) => h.startsWith('http') ? h : `https://soundcloud.com/${h.replace(/^@/, '')}` },
  spotify:    { Icon: Globe,     label: 'Spotify',     href: (h) => h.startsWith('http') ? h : `https://open.spotify.com/${h.replace(/^@/, '')}` },
  website:    WEBSITE_META,
}

function SocialsBlock({ socials }: { socials?: MemberSocials | null }) {
  if (!socials) return null
  const entries = Object.entries(socials).filter(([, v]) => Boolean(v && v.trim()))
  if (entries.length === 0) return null
  return (
    <div>
      <h2 className="text-[11px] font-semibold text-gold uppercase tracking-wider mb-3">Socials</h2>
      <div className="flex flex-wrap gap-2">
        {entries.map(([key, value]) => {
          const meta: SocialMeta = SOCIAL_ICON_MAP[key] ?? WEBSITE_META
          const { Icon, label } = meta
          return (
            <a
              key={key}
              href={meta.href(value as string)}
              target="_blank"
              rel="noopener noreferrer"
              title={`${label}: ${value}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-surface-alt/40 hover:bg-surface-alt hover:border-gold/40 hover:text-gold text-[12px] text-text-muted transition-colors"
            >
              <Icon size={13} aria-hidden="true" />
              <span>{label}</span>
            </a>
          )
        })}
      </div>
    </div>
  )
}
