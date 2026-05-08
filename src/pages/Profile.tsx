import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  AlertCircle,
  ChevronLeft,
  Globe,
  Instagram,
  Loader2,
  Mail,
  Pencil,
  Twitter,
  Youtube,
} from 'lucide-react'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useAuth } from '../contexts/AuthContext'
import { fetchTeamMembers, teamMemberKeys } from '../lib/queries/teamMembers'
import ChangePasswordPanel from '../components/auth/ChangePasswordPanel'
import MemberAvatar from '../components/members/MemberAvatar'
import ProfileEditor from '../components/members/ProfileEditor'
import { Button } from '../components/ui'
import type { MemberSocials, TeamMember } from '../types'

/**
 * Member profile page.
 *
 * Read view shows: banner (if set), avatar + name + position +
 * pronouns, contact, bio, socials, the security panel (own
 * profile only), and the team list.
 *
 * Own-profile viewers get an "Edit profile" button that swaps the
 * page into the inline `<ProfileEditor />`. Admins editing OTHER
 * members still go through `/admin/my-team` (TeamManager).
 */
export default function Profile() {
  const { memberId } = useParams<{ memberId: string }>()
  const { profile: viewerProfile } = useAuth()
  const [editing, setEditing] = useState(false)

  const teamQuery = useQuery({
    queryKey: teamMemberKeys.list(),
    queryFn: fetchTeamMembers,
  })
  const members: TeamMember[] = teamQuery.data ?? []
  const member = members.find((m) => m.id === memberId)

  // Lean 3 — show the self-serve security panel only when the
  // signed-in user is looking at their OWN profile. Admins viewing
  // another member's profile don't get the change-password UI here
  // (the canonical admin path for resetting another member's
  // password lives at /admin/settings → Account Access).
  const isOwnProfile = Boolean(viewerProfile && member && viewerProfile.id === member.id)

  useDocumentTitle(member ? `${member.display_name} - Checkmark Workspace` : 'Profile - Checkmark Workspace')

  if (teamQuery.isLoading) {
    return (
      <div className="max-w-2xl mx-auto py-16 flex items-center justify-center text-text-light">
        <Loader2 size={18} className="animate-spin mr-2" />
        Loading profile…
      </div>
    )
  }

  if (teamQuery.error) {
    return (
      <div className="max-w-2xl mx-auto py-16 flex items-start gap-2 text-amber-300">
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
      <div className="max-w-2xl mx-auto py-16 text-center animate-fade-in">
        <p className="text-[16px] text-text-muted">Profile not found.</p>
        <Link to="/" className="text-[13px] text-gold hover:underline mt-3 inline-block">
          Back to Overview
        </Link>
      </div>
    )
  }

  const otherMembers = members.filter((m) => m.id !== member.id)

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      {/* Back link */}
      <Link to="/" className="flex items-center gap-1 text-[12px] text-text-light hover:text-gold transition-colors mb-6">
        <ChevronLeft size={14} /> Back to Dashboard
      </Link>

      {/* Profile card */}
      <div className="bg-surface rounded-2xl border border-border overflow-hidden">
        {/* Banner — wide hero image when set, otherwise the existing
            tinted strip. Renders BEFORE the hero so it sits at the top.
            Hidden in edit mode to keep the editor focused. */}
        {member.banner_url && !editing && (
          <div className="aspect-[3/1] w-full overflow-hidden">
            <img
              src={member.banner_url}
              alt=""
              className="w-full h-full object-cover"
              key={member.banner_url}
            />
          </div>
        )}

        {/* Hero / Editor */}
        {editing ? (
          <div className="px-8 py-7">
            <ProfileEditor member={member} onClose={() => setEditing(false)} />
          </div>
        ) : (
          <>
            <div className={member.banner_url ? 'px-8 pt-5 pb-6' : 'bg-surface-alt px-8 pt-8 pb-6'}>
              <div className="flex items-start gap-5">
                {/* When there's a banner, lift the avatar up so it
                    overlaps the banner edge — matches the standard
                    profile-card pattern (Notion / Linear / etc.). */}
                <div className={member.banner_url ? '-mt-12' : ''}>
                  <div className="ring-4 ring-surface rounded-full">
                    <MemberAvatar member={member} size="xl" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h1 className="text-[24px] font-extrabold text-text tracking-tight">
                        {member.display_name}
                        {member.pronouns && (
                          <span className="ml-2 text-[13px] font-medium text-text-light">
                            ({member.pronouns})
                          </span>
                        )}
                      </h1>
                      {member.position && (
                        <p className="text-[14px] text-text-muted mt-0.5">{member.position}</p>
                      )}
                      {member.department && (
                        <p className="text-[12px] text-text-light mt-0.5">{member.department}</p>
                      )}
                    </div>
                    {isOwnProfile && (
                      <Button
                        size="sm"
                        variant="secondary"
                        iconLeft={<Pencil size={13} aria-hidden="true" />}
                        onClick={() => setEditing(true)}
                      >
                        Edit profile
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="px-8 py-6 space-y-6">
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

              {/* Lean 3 — self-serve change-password panel. Renders only
                  when the viewer is on their own profile. Admins
                  resetting another member's password go through
                  /admin/settings → Account Access. */}
              {isOwnProfile && <ChangePasswordPanel />}

              {/* Team — other members, clickable to their profiles */}
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
                          <span className="text-[11px] text-text-light ml-auto">{m.position}</span>
                        )}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
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
          // Fall back to a known-defined meta so noUncheckedIndexedAccess
          // can prove `meta` is never undefined.
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
