import { useState } from 'react'
import { LayoutDashboard, Plus } from 'lucide-react'
import { MemberOverviewProvider, useMemberOverviewContext } from '../contexts/MemberOverviewContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useAuth } from '../contexts/AuthContext'
import WorkspacePanel from '../components/dashboard/WorkspacePanel'
import { MEMBER_WIDGET_DEFINITIONS } from '../components/dashboard/widgetRegistry'
import { PageHeader } from '../components/ui'
import MemberHighlights, { SocialStatsBar } from '../components/members/MemberHighlights'
import CreateBookingModal from '../components/CreateBookingModal'

const MEMBER_SCOPE = 'member_overview' as const

/**
 * BookButton — local CTA pill rendered to the right of the member
 * panel via MemberHighlights' `actions` slot. Same gold pill chrome
 * as the Sessions page Book a Session button so the action looks
 * consistent across surfaces. Refetches the member-overview context
 * on close so any newly-created booking lights up its widget.
 */
function BookButton() {
  const { refetch } = useMemberOverviewContext()
  const [showBooking, setShowBooking] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setShowBooking(true)}
        className="inline-flex items-center gap-2 h-10 px-4 rounded-2xl bg-gold text-black text-[13px] font-extrabold tracking-tight ring-1 ring-gold-muted hover:bg-gold-muted hover:ring-gold-dim transition-colors shadow-[0_4px_12px_rgba(0,0,0,0.08)] focus-ring"
      >
        <Plus size={14} strokeWidth={2.4} aria-hidden="true" />
        Book a Session
      </button>
      {showBooking && (
        <CreateBookingModal
          onClose={() => {
            setShowBooking(false)
            void refetch()
          }}
        />
      )}
    </>
  )
}

export default function Dashboard() {
  useDocumentTitle('Overview - Checkmark Workspace')
  const { profile, appRole } = useAuth()

  return (
    <div className="max-w-[1440px] mx-auto animate-fade-in space-y-3">
      <MemberOverviewProvider>
        {/* Skin pass 2026-05-06 — swapped: +Book a Session moved
            UP to the page-header actions (top-right, beside the
            "Overview" title); SocialStatsBar moved DOWN to the
            member-row actions (right-justified next to the member
            panel). Per user direction. */}
        <PageHeader
          icon={LayoutDashboard}
          title="Overview"
          actions={<BookButton />}
        />
        <MemberHighlights actions={<SocialStatsBar />} />
        <WorkspacePanel
          role={appRole}
          userId={profile?.id ?? 'guest'}
          scope={MEMBER_SCOPE}
          definitions={MEMBER_WIDGET_DEFINITIONS}
          controlsDescription=""
          showControls={false}
        />
      </MemberOverviewProvider>
    </div>
  )
}
